import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ProjectEvent,
  ProjectEventKind,
  ProjectMilestone,
  ProjectMilestoneStatus,
  ProjectMilestoneUpdate,
  ProjectMilestoneUpdateStatus,
  ProjectNotification,
} from "@/lib/project-milestone-types";

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

function isMilestoneStatus(value: string): value is ProjectMilestoneStatus {
  return (
    value === "planned" ||
    value === "in_progress" ||
    value === "at_risk" ||
    value === "completed"
  );
}

function isUpdateStatus(value: string): value is ProjectMilestoneUpdateStatus {
  return (
    value === "submitted" ||
    value === "revision_requested" ||
    value === "approved"
  );
}

function isEventKind(value: string): value is ProjectEventKind {
  return (
    value === "announcement" ||
    value === "meeting" ||
    value === "site_visit" ||
    value === "other"
  );
}

export async function getProjectMilestones(projectIds: string[]) {
  if (projectIds.length === 0) {
    return { ready: true, milestones: [] as ProjectMilestone[] };
  }

  const supabase = await createSupabaseServerClient();
  const { data: milestoneRows, error: milestonesError } = await supabase
    .from("project_milestones")
    .select(
      "id, project_id, title, description, responsible_user_id, responsible_email, planned_start, planned_finish, status, progress_percent, created_at, updated_at",
    )
    .in("project_id", projectIds)
    .order("planned_start", { ascending: true });
  if (milestonesError) {
    if (isMissingProgressSchema(milestonesError)) {
      return { ready: false, milestones: [] as ProjectMilestone[] };
    }
    throw new Error(`Unable to load project milestones: ${milestonesError.message}`);
  }
  if (milestoneRows.length === 0) {
    return { ready: true, milestones: [] as ProjectMilestone[] };
  }

  const { data: updateRows, error: updatesError } = await supabase
    .from("project_milestone_updates")
    .select(
      "id, milestone_id, progress_percent, update_note, file_name, file_size, submitted_by, submitted_by_email, status, review_note, reviewed_by_email, reviewed_at, created_at",
    )
    .in(
      "milestone_id",
      milestoneRows.map((milestone) => milestone.id),
    )
    .order("created_at", { ascending: false });
  if (updatesError) {
    if (isMissingProgressSchema(updatesError)) {
      return { ready: false, milestones: [] as ProjectMilestone[] };
    }
    throw new Error(
      `Unable to load milestone progress updates: ${updatesError.message}`,
    );
  }

  const updatesByMilestone = new Map<string, ProjectMilestoneUpdate[]>();
  for (const row of updateRows) {
    if (!isUpdateStatus(row.status)) {
      throw new Error("A milestone update has an unsupported review status.");
    }
    const updates = updatesByMilestone.get(row.milestone_id) ?? [];
    updates.push({ ...row, status: row.status });
    updatesByMilestone.set(row.milestone_id, updates);
  }

  return {
    ready: true,
    milestones: milestoneRows.map((row) => {
      if (!isMilestoneStatus(row.status)) {
        throw new Error("A project milestone has an unsupported status.");
      }
      return {
        ...row,
        status: row.status,
        updates: updatesByMilestone.get(row.id) ?? [],
      };
    }),
  };
}

export async function getProjectEvents(projectIds: string[]) {
  if (projectIds.length === 0) {
    return { ready: true, events: [] as ProjectEvent[] };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_events")
    .select(
      "id, project_id, kind, title, details, starts_at, location, created_by_email, created_at",
    )
    .in("project_id", projectIds)
    .order("starts_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingProgressSchema(error)) {
      return { ready: false, events: [] as ProjectEvent[] };
    }
    throw new Error(`Unable to load project events: ${error.message}`);
  }
  return {
    ready: true,
    events: data.map((row) => {
      if (!isEventKind(row.kind)) {
        throw new Error("A project event has an unsupported type.");
      }
      return { ...row, kind: row.kind };
    }),
  };
}

export async function getProjectNotifications() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_notifications")
    .select(
      "id, project_id, event_type, title, message, entity_type, entity_id, created_at, read_at",
    )
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) {
    if (isMissingProgressSchema(error)) {
      return {
        ready: false,
        notifications: [] as ProjectNotification[],
      };
    }
    throw new Error(`Unable to load workspace notifications: ${error.message}`);
  }
  return { ready: true, notifications: data };
}
