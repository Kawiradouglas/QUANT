export type ProjectTaskStatus =
  | "assigned"
  | "submitted"
  | "revision_requested"
  | "completed";

export type ProjectTaskWorkflow = "management" | "delegated";

export type ProjectTaskSubmission = {
  id: string;
  file_name: string;
  file_size: number;
  submitted_by_email: string | null;
  created_at: string;
};

export type ProjectTask = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  assignee_user_id: string;
  assignee_email: string;
  assigned_by: string;
  assigned_by_email: string | null;
  workflow: ProjectTaskWorkflow;
  due_date: string | null;
  status: ProjectTaskStatus;
  review_note: string;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  completed_at: string | null;
  created_at: string;
  submissions: ProjectTaskSubmission[];
};
