export const projectDocumentCategories = [
  "Contract",
  "Drawing",
  "Specification",
  "Report",
  "Correspondence",
  "Other",
] as const;

export type ProjectDocumentCategory =
  (typeof projectDocumentCategories)[number];

export const projectDocumentMaxFileSize = 10 * 1024 * 1024;

export type ProjectDocumentVersion = {
  id: string;
  version_number: number;
  file_name: string;
  content_type: string;
  file_size: number;
  uploaded_by_email: string | null;
  created_at: string;
};

export type ProjectDocument = {
  id: string;
  project_id: string;
  title: string;
  reference_number: string | null;
  category: ProjectDocumentCategory;
  description: string;
  created_at: string;
  versions: ProjectDocumentVersion[];
};
