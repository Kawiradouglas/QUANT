import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ProjectDocument,
  ProjectDocumentCategory,
  ProjectDocumentVersion,
} from "@/lib/project-document-types";

function isMissingDocumentSchema(error: { code?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205"
  );
}

export async function getProjectDocuments(projectIds: string[]) {
  if (projectIds.length === 0) {
    return { ready: true, documents: [] as ProjectDocument[] };
  }

  const supabase = await createSupabaseServerClient();
  const { data: documentRows, error: documentsError } = await supabase
    .from("project_documents")
    .select(
      "id, project_id, title, reference_number, category, description, created_at",
    )
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });

  if (documentsError) {
    if (isMissingDocumentSchema(documentsError)) {
      return { ready: false, documents: [] as ProjectDocument[] };
    }
    throw new Error(
      `Unable to load project document registers: ${documentsError.message}`,
    );
  }

  if (documentRows.length === 0) {
    return { ready: true, documents: [] as ProjectDocument[] };
  }

  const documentIds = documentRows.map((document) => document.id);
  const { data: versionRows, error: versionsError } = await supabase
    .from("project_document_versions")
    .select(
      "id, document_id, version_number, file_name, content_type, file_size, uploaded_by_email, created_at",
    )
    .in("document_id", documentIds)
    .order("version_number", { ascending: false });

  if (versionsError) {
    if (isMissingDocumentSchema(versionsError)) {
      return { ready: false, documents: [] as ProjectDocument[] };
    }
    throw new Error(
      `Unable to load project document versions: ${versionsError.message}`,
    );
  }

  const versionsByDocument = new Map<string, ProjectDocumentVersion[]>();
  for (const version of versionRows) {
    const versions = versionsByDocument.get(version.document_id) ?? [];
    versions.push({
      id: version.id,
      version_number: version.version_number,
      file_name: version.file_name,
      content_type: version.content_type,
      file_size: version.file_size,
      uploaded_by_email: version.uploaded_by_email,
      created_at: version.created_at,
    });
    versionsByDocument.set(version.document_id, versions);
  }

  const documents: ProjectDocument[] = documentRows.map((document) => ({
    id: document.id,
    project_id: document.project_id,
    title: document.title,
    reference_number: document.reference_number,
    category: document.category as ProjectDocumentCategory,
    description: document.description,
    created_at: document.created_at,
    versions: versionsByDocument.get(document.id) ?? [],
  }));

  return { ready: true, documents };
}
