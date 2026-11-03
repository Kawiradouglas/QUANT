"use server";

import { revalidatePath } from "next/cache";
import type { AuthActionState } from "@/app/auth/actions";
import { projectDocumentMaxFileSize } from "@/lib/project-document-types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseActionClient } from "@/lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const allowedContentTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "text/plain",
]);

type SignedInResult =
  | { error: string }
  | { supabase: Awaited<ReturnType<typeof createSupabaseActionClient>> };

async function getSignedInClient(): Promise<SignedInResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Account access is not configured yet." };
  }

  const supabase = await createSupabaseActionClient();
  const { data, error } = await supabase.auth.getUser();
  if (error?.name === "AuthSessionMissingError") {
    return { error: "Sign in to manage project tasks." };
  }
  if (error) {
    return { error: `Unable to verify your account: ${error.message}` };
  }
  if (!data.user) return { error: "Sign in to manage project tasks." };
  return { supabase };
}

function isMissingTaskSchema(error: { code?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "42883" ||
    error.code === "42703" ||
    error.code === "PGRST202" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205"
  );
}

function readSubmissionFile(formData: FormData) {
  const value = formData.get("file");
  if (!(value instanceof File) || value.size === 0) {
    return { error: "Choose the task document to submit." } as const;
  }
  if (value.size > projectDocumentMaxFileSize) {
    return { error: "Task documents must be 10 MB or smaller." } as const;
  }
  if (!allowedContentTypes.has(value.type)) {
    return {
      error:
        "Use a PDF, Word, Excel, PowerPoint, PNG, JPEG, or plain-text file.",
    } as const;
  }

  const fileName =
    value.name
      .replace(/[/\\]/g, "_")
      .replace(/[^a-zA-Z0-9._() -]/g, "_")
      .replace(/^[. ]+/, "")
      .slice(0, 200) || "task-submission";
  return { file: value, fileName } as const;
}

async function removeUnregisteredFile(
  supabase: Awaited<ReturnType<typeof createSupabaseActionClient>>,
  storagePath: string,
  failureMessage: string,
) {
  const { error } = await supabase.storage
    .from("project-documents")
    .remove([storagePath]);
  return {
    error: error
      ? `${failureMessage} The uploaded file could not be removed: ${error.message}`
      : failureMessage,
  };
}

export async function createProjectTaskAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const assigneeUserId = String(formData.get("assigneeUserId") ?? "");
  const workflow = String(formData.get("workflow") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "").trim();

  if (!uuidPattern.test(projectId)) {
    return { error: "Choose a valid project." };
  }
  if (title.length < 2 || title.length > 200) {
    return { error: "Task titles must be between 2 and 200 characters." };
  }
  if (description.length > 2000) {
    return { error: "Task instructions must be 2000 characters or fewer." };
  }
  if (!uuidPattern.test(assigneeUserId)) {
    return { error: "Choose an active project member to assign this task to." };
  }
  if (workflow !== "management" && workflow !== "delegated") {
    return { error: "Choose a project-managed or member-delegated workflow." };
  }
  if (dueDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return { error: "Choose a valid due date." };
    }
    const parsedDate = new Date(`${dueDate}T00:00:00.000Z`);
    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== dueDate
    ) {
      return { error: "Choose a valid due date." };
    }
  }

  const result = await getSignedInClient();
  if ("error" in result) return result;

  const { error } = await result.supabase.rpc("create_project_task", {
    p_project_id: projectId,
    p_workflow: workflow,
    p_title: title,
    p_description: description,
    p_assignee_user_id: assigneeUserId,
    p_due_date: dueDate || null,
  });
  if (error) {
    return {
      error: isMissingTaskSchema(error)
        ? "Project task workflows are not set up yet. Apply the member task delegation migration in Supabase."
        : error.message,
    };
  }

  revalidatePath("/owner");
  revalidatePath("/member");
  return {
    message: workflow === "management"
      ? `Management task assigned: ${title}.`
      : `Delegated task assigned: ${title}.`,
  };
}

export async function submitProjectTaskAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const taskId = String(formData.get("taskId") ?? "");
  if (!uuidPattern.test(taskId)) {
    return { error: "Choose a valid project task." };
  }
  const fileResult = readSubmissionFile(formData);
  if ("error" in fileResult) return fileResult;

  const result = await getSignedInClient();
  if ("error" in result) return result;

  const { data: task, error: taskError } = await result.supabase
    .from("project_tasks")
    .select("id, project_id")
    .eq("id", taskId)
    .maybeSingle();
  if (taskError) {
    return {
      error: isMissingTaskSchema(taskError)
        ? "Project task workflows are not set up yet. Apply the member task delegation migration in Supabase."
        : `Unable to load the task: ${taskError.message}`,
    };
  }
  if (!task) return { error: "The project task was not found." };

  const storagePath =
    `${task.project_id}/${task.id}/${crypto.randomUUID()}-${fileResult.fileName}`;
  const { error: uploadError } = await result.supabase.storage
    .from("project-documents")
    .upload(storagePath, fileResult.file, {
      contentType: fileResult.file.type,
      upsert: false,
    });
  if (uploadError) {
    return { error: `Unable to upload the task document: ${uploadError.message}` };
  }

  const { error } = await result.supabase.rpc("submit_project_task", {
    p_task_id: taskId,
    p_storage_path: storagePath,
    p_file_name: fileResult.fileName,
    p_content_type: fileResult.file.type,
    p_file_size: fileResult.file.size,
  });
  if (error) {
    const message = isMissingTaskSchema(error)
      ? "Project task workflows are not set up yet. Apply the member task delegation migration in Supabase."
      : error.message;
    return removeUnregisteredFile(
      result.supabase,
      storagePath,
      `Unable to submit the task document: ${message}`,
    );
  }

  revalidatePath("/member");
  revalidatePath("/owner");
  return { message: "Your task document was submitted for review." };
}

export async function reviewProjectTaskAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const taskId = String(formData.get("taskId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const reviewNote = String(formData.get("reviewNote") ?? "").trim();

  if (!uuidPattern.test(taskId)) {
    return { error: "Choose a valid project task." };
  }
  if (decision !== "accept" && decision !== "request_changes") {
    return { error: "Choose whether to accept or request changes." };
  }
  if (
    reviewNote.length > 1000 ||
    (decision === "request_changes" && reviewNote.length < 2)
  ) {
    return {
      error:
        decision === "request_changes"
          ? "Give the member review instructions between 2 and 1000 characters."
          : "Review notes must be 1000 characters or fewer.",
    };
  }

  const result = await getSignedInClient();
  if ("error" in result) return result;

  const { error } = await result.supabase.rpc("review_project_task", {
    p_task_id: taskId,
    p_decision: decision,
    p_review_note: reviewNote,
  });
  if (error) {
    return {
      error: isMissingTaskSchema(error)
        ? "Project task workflows are not set up yet. Apply the member task delegation migration in Supabase."
        : error.message,
    };
  }

  revalidatePath("/owner");
  revalidatePath("/member");
  return {
    message:
      decision === "accept"
        ? "Task accepted and marked completed."
        : "Changes requested. The member can upload a revised submission.",
  };
}
