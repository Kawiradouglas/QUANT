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

type ActionClientResult =
  | { error: string }
  | { supabase: Awaited<ReturnType<typeof createSupabaseActionClient>> };

async function getActionClient(): Promise<ActionClientResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Account access is not configured yet." };
  }
  const supabase = await createSupabaseActionClient();
  const { data, error } = await supabase.auth.getUser();
  if (error?.name === "AuthSessionMissingError") {
    return { error: "Sign in to manage project progress." };
  }
  if (error) return { error: `Unable to verify your account: ${error.message}` };
  if (!data.user) return { error: "Sign in to manage project progress." };
  return { supabase };
}

function isMissingProgressSchema(error: { code?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "42883" ||
    error.code === "PGRST202" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205"
  );
}

function missingSchemaMessage() {
  return "Project milestones and events are not set up yet. Apply the project milestones, activity, and events migration in Supabase.";
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function readProgressAttachment(formData: FormData) {
  const value = formData.get("file");
  if (!(value instanceof File) || value.size === 0) {
    return { file: null, fileName: null } as const;
  }
  if (value.size > projectDocumentMaxFileSize) {
    return { error: "Progress attachments must be 10 MB or smaller." } as const;
  }
  if (!allowedContentTypes.has(value.type)) {
    return {
      error:
        "Use a PDF, Word, Excel, PowerPoint, PNG, JPEG, or plain-text attachment.",
    } as const;
  }
  const fileName =
    value.name
      .replace(/[/\\]/g, "_")
      .replace(/[^a-zA-Z0-9._() -]/g, "_")
      .replace(/^[. ]+/, "")
      .slice(0, 200) || "progress-update";
  return { file: value, fileName } as const;
}

async function cleanupUpload(
  supabase: Awaited<ReturnType<typeof createSupabaseActionClient>>,
  storagePath: string,
  error: string,
) {
  const { error: cleanupError } = await supabase.storage
    .from("project-documents")
    .remove([storagePath]);
  return {
    error: cleanupError
      ? `${error} The unregistered attachment could not be removed: ${cleanupError.message}`
      : error,
  };
}

function revalidatePortals() {
  revalidatePath("/owner");
  revalidatePath("/member");
}

export async function createProjectMilestoneAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const responsibleUserId = String(formData.get("responsibleUserId") ?? "");
  const plannedStart = String(formData.get("plannedStart") ?? "");
  const plannedFinish = String(formData.get("plannedFinish") ?? "");
  if (!uuidPattern.test(projectId) || !uuidPattern.test(responsibleUserId)) {
    return { error: "Choose a project and active responsible member." };
  }
  if (title.length < 2 || title.length > 200) {
    return { error: "Milestone titles must be between 2 and 200 characters." };
  }
  if (description.length > 2000) {
    return { error: "Milestone details must be 2000 characters or fewer." };
  }
  if (
    !isValidDate(plannedStart) ||
    !isValidDate(plannedFinish) ||
    plannedFinish < plannedStart
  ) {
    return { error: "Choose a valid planned start and finish date." };
  }
  const result = await getActionClient();
  if ("error" in result) return result;
  const { error } = await result.supabase.rpc("create_project_milestone", {
    p_project_id: projectId,
    p_title: title,
    p_description: description,
    p_responsible_user_id: responsibleUserId,
    p_planned_start: plannedStart,
    p_planned_finish: plannedFinish,
  });
  if (error) {
    return {
      error: isMissingProgressSchema(error)
        ? missingSchemaMessage()
        : error.message,
    };
  }
  revalidatePortals();
  return { message: `Milestone created: ${title}.` };
}

export async function updateProjectMilestoneAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const responsibleUserId = String(formData.get("responsibleUserId") ?? "");
  const plannedStart = String(formData.get("plannedStart") ?? "");
  const plannedFinish = String(formData.get("plannedFinish") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!uuidPattern.test(milestoneId) || !uuidPattern.test(responsibleUserId)) {
    return { error: "Choose a valid milestone and responsible member." };
  }
  if (title.length < 2 || title.length > 200) {
    return { error: "Milestone titles must be between 2 and 200 characters." };
  }
  if (description.length > 2000) {
    return { error: "Milestone details must be 2000 characters or fewer." };
  }
  if (
    !isValidDate(plannedStart) ||
    !isValidDate(plannedFinish) ||
    plannedFinish < plannedStart
  ) {
    return { error: "Choose a valid planned start and finish date." };
  }
  if (!["planned", "in_progress", "at_risk", "completed"].includes(status)) {
    return { error: "Choose a valid milestone status." };
  }
  const result = await getActionClient();
  if ("error" in result) return result;
  const { error } = await result.supabase.rpc("update_project_milestone", {
    p_milestone_id: milestoneId,
    p_title: title,
    p_description: description,
    p_responsible_user_id: responsibleUserId,
    p_planned_start: plannedStart,
    p_planned_finish: plannedFinish,
    p_status: status,
  });
  if (error) {
    return {
      error: isMissingProgressSchema(error)
        ? missingSchemaMessage()
        : error.message,
    };
  }
  revalidatePortals();
  return { message: "Milestone details updated." };
}

export async function submitMilestoneProgressAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const progressValue = String(formData.get("progressPercent") ?? "");
  const progress = Number(progressValue);
  const note = String(formData.get("updateNote") ?? "").trim();
  if (!uuidPattern.test(milestoneId)) {
    return { error: "Choose a valid project milestone." };
  }
  if (
    !/^\d{1,3}$/.test(progressValue) ||
    !Number.isInteger(progress) ||
    progress < 0 ||
    progress > 100
  ) {
    return { error: "Progress must be a whole number from 0 to 100." };
  }
  if (note.length < 2 || note.length > 2000) {
    return { error: "Progress notes must be between 2 and 2000 characters." };
  }
  const attachment = readProgressAttachment(formData);
  if ("error" in attachment) return attachment;
  const result = await getActionClient();
  if ("error" in result) return result;

  let storagePath: string | null = null;
  if (attachment.file && attachment.fileName) {
    const { data: milestone, error: milestoneError } = await result.supabase
      .from("project_milestones")
      .select("id, project_id")
      .eq("id", milestoneId)
      .maybeSingle();
    if (milestoneError) {
      return {
        error: isMissingProgressSchema(milestoneError)
          ? missingSchemaMessage()
          : `Unable to load the milestone: ${milestoneError.message}`,
      };
    }
    if (!milestone) return { error: "The project milestone was not found." };
    storagePath =
      `${milestone.project_id}/milestone-updates/${milestone.id}/${crypto.randomUUID()}-${attachment.fileName}`;
    const { error: uploadError } = await result.supabase.storage
      .from("project-documents")
      .upload(storagePath, attachment.file, {
        contentType: attachment.file.type,
        upsert: false,
      });
    if (uploadError) {
      return { error: `Unable to upload the progress attachment: ${uploadError.message}` };
    }
  }

  const { error } = await result.supabase.rpc(
    "submit_project_milestone_update",
    {
      p_milestone_id: milestoneId,
      p_progress_percent: progress,
      p_update_note: note,
      p_storage_path: storagePath,
      p_file_name: attachment.fileName,
      p_content_type: attachment.file?.type ?? null,
      p_file_size: attachment.file?.size ?? null,
    },
  );
  if (error) {
    const message = isMissingProgressSchema(error)
      ? missingSchemaMessage()
      : error.message;
    return storagePath
      ? cleanupUpload(
          result.supabase,
          storagePath,
          `Unable to submit milestone progress: ${message}`,
        )
      : { error: `Unable to submit milestone progress: ${message}` };
  }
  revalidatePortals();
  return { message: "Your milestone progress was submitted for review." };
}

export async function reviewMilestoneProgressAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const updateId = String(formData.get("updateId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const reviewNote = String(formData.get("reviewNote") ?? "").trim();
  if (!uuidPattern.test(updateId)) {
    return { error: "Choose a valid milestone update." };
  }
  if (decision !== "approve" && decision !== "request_changes") {
    return { error: "Choose approve or request changes." };
  }
  if (
    reviewNote.length > 1000 ||
    (decision === "request_changes" &&
      (reviewNote.length < 2 || reviewNote.length > 1000))
  ) {
    return { error: "Review instructions must be between 2 and 1000 characters." };
  }
  const result = await getActionClient();
  if ("error" in result) return result;
  const { error } = await result.supabase.rpc(
    "review_project_milestone_update",
    {
      p_update_id: updateId,
      p_decision: decision,
      p_review_note: reviewNote,
    },
  );
  if (error) {
    return {
      error: isMissingProgressSchema(error)
        ? missingSchemaMessage()
        : error.message,
    };
  }
  revalidatePortals();
  return {
    message:
      decision === "approve"
        ? "Milestone progress approved."
        : "Changes requested from the responsible member.",
  };
}

export async function createProjectEventAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const startsAtValue = String(formData.get("startsAt") ?? "");
  if (!uuidPattern.test(projectId)) {
    return { error: "Choose a valid project." };
  }
  if (!["announcement", "meeting", "site_visit", "other"].includes(kind)) {
    return { error: "Choose a valid event type." };
  }
  if (title.length < 2 || title.length > 200) {
    return { error: "Titles must be between 2 and 200 characters." };
  }
  if (details.length > 4000 || location.length > 300) {
    return { error: "Event details or location exceed the allowed length." };
  }
  if (kind !== "announcement" && !startsAtValue) {
    return { error: "Choose a date and time for this event." };
  }
  if (
    startsAtValue &&
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startsAtValue)
  ) {
    return { error: "Choose a valid event date and time." };
  }
  const startsAt = startsAtValue
    ? new Date(`${startsAtValue}:00Z`)
    : null;
  if (
    startsAt &&
    (Number.isNaN(startsAt.getTime()) ||
      startsAt.toISOString().slice(0, 16) !== startsAtValue)
  ) {
    return { error: "Choose a valid event date and time." };
  }
  const result = await getActionClient();
  if ("error" in result) return result;
  const { error } = await result.supabase.rpc("create_project_event", {
    p_project_id: projectId,
    p_kind: kind,
    p_title: title,
    p_details: details,
    p_starts_at: startsAt?.toISOString() ?? null,
    p_location: location,
  });
  if (error) {
    return {
      error: isMissingProgressSchema(error)
        ? missingSchemaMessage()
        : error.message,
    };
  }
  revalidatePortals();
  return {
    message:
      kind === "announcement"
        ? "Announcement published."
        : "Project event scheduled.",
  };
}

export async function markProjectNotificationReadAction(formData: FormData) {
  const notificationId = String(formData.get("notificationId") ?? "");
  if (!uuidPattern.test(notificationId)) {
    throw new Error("Choose a valid notification.");
  }
  const result = await getActionClient();
  if ("error" in result) throw new Error(result.error);
  const { error } = await result.supabase.rpc(
    "mark_project_notification_read",
    { p_notification_id: notificationId },
  );
  if (error) {
    throw new Error(
      isMissingProgressSchema(error)
        ? missingSchemaMessage()
        : `Unable to mark the notification as read: ${error.message}`,
    );
  }
  revalidatePortals();
}

export async function markAllProjectNotificationsReadAction() {
  const result = await getActionClient();
  if ("error" in result) throw new Error(result.error);
  const { error } = await result.supabase.rpc(
    "mark_all_project_notifications_read",
  );
  if (error) {
    throw new Error(
      isMissingProgressSchema(error)
        ? missingSchemaMessage()
        : `Unable to mark notifications as read: ${error.message}`,
    );
  }
  revalidatePortals();
}
