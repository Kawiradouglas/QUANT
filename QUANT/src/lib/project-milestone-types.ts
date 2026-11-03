export type ProjectMilestoneStatus =
  | "planned"
  | "in_progress"
  | "at_risk"
  | "completed";

export type ProjectMilestoneUpdateStatus =
  | "submitted"
  | "revision_requested"
  | "approved";

export type ProjectMilestoneUpdate = {
  id: string;
  progress_percent: number;
  update_note: string;
  file_name: string | null;
  file_size: number | null;
  submitted_by: string;
  submitted_by_email: string | null;
  status: ProjectMilestoneUpdateStatus;
  review_note: string;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type ProjectMilestone = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  responsible_user_id: string;
  responsible_email: string;
  planned_start: string;
  planned_finish: string;
  status: ProjectMilestoneStatus;
  progress_percent: number;
  created_at: string;
  updated_at: string;
  updates: ProjectMilestoneUpdate[];
};

export type ProjectEventKind =
  | "announcement"
  | "meeting"
  | "site_visit"
  | "other";

export type ProjectEvent = {
  id: string;
  project_id: string;
  kind: ProjectEventKind;
  title: string;
  details: string;
  starts_at: string | null;
  location: string;
  created_by_email: string | null;
  created_at: string;
};

export type ProjectNotification = {
  id: string;
  project_id: string;
  event_type: string;
  title: string;
  message: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
  read_at: string | null;
};
