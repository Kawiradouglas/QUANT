import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ProjectTask,
  ProjectTaskSubmission,
  ProjectTaskStatus,
  ProjectTaskWorkflow,
} from "@/lib/project-task-types";

function isMissingTaskSchema(error: { code?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "42883" ||
    error.code === "PGRST202" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205"
  );
}

function isProjectTaskStatus(status: string): status is ProjectTaskStatus {
  return (
    status === "assigned" ||
    status === "submitted" ||
    status === "revision_requested" ||
    status === "completed"
  );
}

function isProjectTaskWorkflow(workflow: string): workflow is ProjectTaskWorkflow {
  return workflow === "management" || workflow === "delegated";
}

export async function getProjectTasks(projectIds: string[]) {
  if (projectIds.length === 0) {
    return { ready: true, tasks: [] as ProjectTask[] };
  }

  const supabase = await createSupabaseServerClient();
  const { data: taskRows, error: tasksError } = await supabase
    .from("project_tasks")
    .select(
      "id, project_id, title, description, assignee_user_id, assignee_email, assigned_by, assigned_by_email, workflow, due_date, status, review_note, reviewed_by_email, reviewed_at, completed_at, created_at",
    )
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });

  if (tasksError) {
    if (isMissingTaskSchema(tasksError)) {
      return { ready: false, tasks: [] as ProjectTask[] };
    }
    throw new Error(`Unable to load project tasks: ${tasksError.message}`);
  }

  if (taskRows.length === 0) {
    return { ready: true, tasks: [] as ProjectTask[] };
  }
  for (const task of taskRows) {
    if (
      !isProjectTaskStatus(task.status) ||
      !isProjectTaskWorkflow(task.workflow)
    ) {
      throw new Error("A project task has an unsupported status.");
    }
  }

  const taskIds = taskRows.map((task) => task.id);
  const { data: submissionRows, error: submissionsError } = await supabase
    .from("project_task_submissions")
    .select(
      "id, task_id, file_name, file_size, submitted_by_email, created_at",
    )
    .in("task_id", taskIds)
    .order("created_at", { ascending: false });

  if (submissionsError) {
    if (isMissingTaskSchema(submissionsError)) {
      return { ready: false, tasks: [] as ProjectTask[] };
    }
    throw new Error(
      `Unable to load task submissions: ${submissionsError.message}`,
    );
  }

  const submissionsByTask = new Map<string, ProjectTaskSubmission[]>();
  for (const submission of submissionRows) {
    const submissions = submissionsByTask.get(submission.task_id) ?? [];
    submissions.push({
      id: submission.id,
      file_name: submission.file_name,
      file_size: submission.file_size,
      submitted_by_email: submission.submitted_by_email,
      created_at: submission.created_at,
    });
    submissionsByTask.set(submission.task_id, submissions);
  }

  return {
    ready: true,
    tasks: taskRows.map((task) => ({
      ...task,
      status: task.status as ProjectTaskStatus,
      workflow: task.workflow as ProjectTaskWorkflow,
      submissions: submissionsByTask.get(task.id) ?? [],
    })),
  };
}
