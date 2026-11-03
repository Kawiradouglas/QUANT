"use server";

import { revalidatePath } from "next/cache";
import type { AuthActionState } from "@/app/auth/actions";
import {
  projectDocumentCategories,
  projectDocumentMaxFileSize,
} from "@/lib/project-document-types";
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
  | {
      supabase: Awaited<ReturnType<typeof createSupabaseActionClient>>;
      user: { id: string; email?: string };
    };

async function getSignedInClient(): Promise<SignedInResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Account access is not configured yet." };
  }

  const supabase = await createSupabaseActionClient();
  const { data, error } = await supabase.auth.getUser();
  if (error?.name === "AuthSessionMissingError" || !data.user) {
    return { error: "Sign in to manage project documents." };
  }
  if (error) {
    return { error: `Unable to verify your account: ${error.message}` };
  }
  return {
    supabase,
    user: { id: data.user.id, email: data.user.email },
  };
}

function readDocumentFile(formData: FormData) {
  const value = formData.get("file");
  if (!(value instanceof File) || value.size === 0) {
    return { error: "Choose a file to upload." } as const;
  }
  if (value.size > projectDocumentMaxFileSize) {
    return { error: "Files must be 10 MB or smaller." } as const;
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
      .slice(0, 200) || "project-document";

  return { file: value, fileName } as const;
}

async function uploadFile(
  supabase: Awaited<ReturnType<typeof createSupabaseActionClient>>,
  file: File,
  fileName: string,
  projectId: string,
  documentId: string,
) {
  const storagePath = `${projectId}/${documentId}/${crypto.randomUUID()}-${fileName}`;
  const { error } = await supabase.storage
    .from("project-documents")
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) return { error: error.message } as const;
  return { storagePath } as const;
}

async function cleanupUploadedFile(
  supabase: Awaited<ReturnType<typeof createSupabaseActionClient>>,
  storagePath: string,
  operationError: string,
) {
  const { error: cleanupError } = await supabase.storage
    .from("project-documents")
    .remove([storagePath]);
  return {
    error: cleanupError
      ? `${operationError} The unregistered file could not be removed: ${cleanupError.message}`
      : operationError,
  };
}

function isMissingDocumentSchema(error: { code?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "42883" ||
    error.code === "42703" ||
    error.code === "PGRST202" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205"
  );
}

export async function createProjectDocumentAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const referenceNumber = String(
    formData.get("referenceNumber") ?? "",
  ).trim();
  const category = String(formData.get("category") ?? "");
  const description = String(formData.get("description") ?? "").trim();

  if (!uuidPattern.test(projectId)) {
    return { error: "Choose a valid project." };
  }
  if (title.length < 2 || title.length > 200) {
    return { error: "Document titles must be between 2 and 200 characters." };
  }
  if (referenceNumber.length > 100) {
    return { error: "Document references must be 100 characters or fewer." };
  }
  if (
    !projectDocumentCategories.some((allowedCategory) =>
      allowedCategory === category
    )
  ) {
    return { error: "Choose a valid document category." };
  }
  if (description.length > 1000) {
    return { error: "Descriptions must be 1000 characters or fewer." };
  }

  const fileResult = readDocumentFile(formData);
  if ("error" in fileResult) return fileResult;
  const result = await getSignedInClient();
  if ("error" in result) return result;

  const documentId = crypto.randomUUID();
  const upload = await uploadFile(
    result.supabase,
    fileResult.file,
    fileResult.fileName,
    projectId,
    documentId,
  );
  if ("error" in upload) {
    return { error: `Unable to upload the file: ${upload.error}` };
  }

  const { error } = await result.supabase.rpc("create_project_document", {
    p_project_id: projectId,
    p_document_id: documentId,
    p_title: title,
    p_reference_number: referenceNumber,
    p_category: category,
    p_description: description,
    p_storage_path: upload.storagePath,
    p_file_name: fileResult.fileName,
    p_content_type: fileResult.file.type,
    p_file_size: fileResult.file.size,
  });
  if (error) {
    const message = isMissingDocumentSchema(error)
      ? "The document register is not set up yet. Apply the project document register migration in Supabase."
      : error.message;
    return cleanupUploadedFile(
      result.supabase,
      upload.storagePath,
      `Unable to register the document: ${message}`,
    );
  }

  revalidatePath("/owner");
  revalidatePath("/member");
  return { message: `${title} was added to the project document register.` };
}

export async function addProjectDocumentVersionAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const documentId = String(formData.get("documentId") ?? "");
  if (!uuidPattern.test(documentId)) {
    return { error: "Choose a valid project document." };
  }

  const fileResult = readDocumentFile(formData);
  if ("error" in fileResult) return fileResult;
  const result = await getSignedInClient();
  if ("error" in result) return result;

  const { data: document, error: documentError } = await result.supabase
    .from("project_documents")
    .select("id, project_id")
    .eq("id", documentId)
    .maybeSingle();
  if (documentError) {
    return {
      error: isMissingDocumentSchema(documentError)
        ? "The document register is not set up yet. Apply the project document register migration in Supabase."
        : `Unable to load the document: ${documentError.message}`,
    };
  }
  if (!document) return { error: "The project document was not found." };

  const upload = await uploadFile(
    result.supabase,
    fileResult.file,
    fileResult.fileName,
    document.project_id,
    document.id,
  );
  if ("error" in upload) {
    return { error: `Unable to upload the revision: ${upload.error}` };
  }

  const { data: versionNumber, error } = await result.supabase.rpc(
    "add_project_document_version",
    {
      p_document_id: documentId,
      p_storage_path: upload.storagePath,
      p_file_name: fileResult.fileName,
      p_content_type: fileResult.file.type,
      p_file_size: fileResult.file.size,
    },
  );
  if (error) {
    const message = isMissingDocumentSchema(error)
      ? "The document register is not set up yet. Apply the project document register migration in Supabase."
      : error.message;
    return cleanupUploadedFile(
      result.supabase,
      upload.storagePath,
      `Unable to register the revision: ${message}`,
    );
  }

  revalidatePath("/owner");
  revalidatePath("/member");
  return { message: `Revision ${versionNumber} was added.` };
}
