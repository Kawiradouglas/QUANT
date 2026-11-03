"use client";

import { useActionState } from "react";
import {
  createProjectTaskAction,
  reviewProjectTaskAction,
  submitProjectTaskAction,
} from "@/app/project-tasks/actions";
import { AuthFeedback } from "@/components/auth/auth-feedback";
import { SubmitButton } from "@/components/auth/submit-button";
import type { OrganisationMember } from "@/components/project/project-workspace";
import type { ProjectTask } from "@/lib/project-task-types";

const fieldClassName =
  "h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)]";
const submissionFileAccept =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/jpeg,image/png,text/plain";

const statusLabels: Record<ProjectTask["status"], string> = {
  assigned: "Assigned",
  submitted: "Awaiting review",
  revision_requested: "Changes requested",
  completed: "Completed",
};

const statusStyles: Record<ProjectTask["status"], string> = {
  assigned: "bg-slate-100 text-slate-700",
  submitted: "bg-amber-50 text-amber-800",
  revision_requested: "bg-orange-50 text-orange-800",
  completed: "bg-emerald-50 text-emerald-800",
};

function formatFileSize(fileSize: number) {
  return fileSize < 1024 * 1024
    ? `${Math.max(1, Math.round(fileSize / 1024))} KB`
    : `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function ProjectTaskBoard({
  projectId,
  tasks,
  members,
  currentUserId,
  canManageTasks,
  canAssignTasks,
  storageReady,
}: {
  projectId: string;
  tasks: ProjectTask[];
  members: OrganisationMember[];
  currentUserId: string;
  canManageTasks: boolean;
  canAssignTasks: boolean;
  storageReady: boolean;
}) {
  const projectMembers = members.filter(
    (member) =>
      member.status === "active" &&
      member.role !== "client" &&
      member.user_id !== currentUserId &&
      Boolean(member.user_id),
  );
  const canCreateManagementTask = canManageTasks;

  return (
    <section
      aria-label="Project tasks"
      className="mt-6 border-t border-[var(--border)] pt-5"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h4 className="font-semibold text-[var(--navy)]">Project tasks</h4>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </p>
        </div>
      </div>

      {!storageReady ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          Task workflows are not set up yet. Apply the member task delegation
          migration in Supabase and reload this page.
        </p>
      ) : (
        <>
          {canCreateManagementTask && (
            <details className="rounded-lg border border-[var(--border)] bg-slate-50">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-[var(--navy)]">
                Assign management task
              </summary>
              <div className="border-t border-[var(--border)] p-4">
                <TaskAssignmentForm
                  disabled={projectMembers.length === 0}
                  members={projectMembers}
                  projectId={projectId}
                  workflow="management"
                  workflowDescription="The client or project manager assigns this task and reviews the member's submission."
                  workflowLabel="Management-assigned task"
                />
              </div>
            </details>
          )}
          {canAssignTasks && (
            <details className="mt-3 rounded-lg border border-[var(--border)] bg-slate-50">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-[var(--navy)]">
                Assign task
              </summary>
              <div className="border-t border-[var(--border)] p-4">
                <TaskAssignmentForm
                  disabled={projectMembers.length === 0}
                  members={projectMembers}
                  projectId={projectId}
                  workflow="delegated"
                  workflowDescription="Assign this task to another project member. The member who assigned it or the client/project manager can review the submission."
                  workflowLabel="Assigned task"
                />
              </div>
            </details>
          )}
          {(canCreateManagementTask || canAssignTasks) &&
            projectMembers.length === 0 && (
              <p className="mt-3 text-sm text-amber-800">
                Add another active project member before assigning a task.
              </p>
            )}

          {tasks.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--muted)]">
              {canManageTasks
                ? "No tasks have been assigned to this project yet."
                : canAssignTasks
                  ? "No tasks have been assigned or delegated to you yet."
                : "You have no tasks assigned in this project."}
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {tasks.map((task) => (
                <TaskCard
                  canManageTasks={canManageTasks}
                  currentUserId={currentUserId}
                  key={task.id}
                  task={task}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function TaskAssignmentForm({
  projectId,
  members,
  workflow,
  workflowLabel,
  workflowDescription,
  disabled,
}: {
  projectId: string;
  members: OrganisationMember[];
  workflow: "management" | "delegated";
  workflowLabel: string;
  workflowDescription: string;
  disabled: boolean;
}) {
  const formId = `${workflow}-${projectId}`;
  const [state, action] = useActionState(createProjectTaskAction, {});

  return (
    <form
      action={action}
      className="grid gap-3 rounded-lg border border-[var(--border)] bg-white p-4 sm:grid-cols-2"
      id={formId}
    >
      <input name="projectId" type="hidden" value={projectId} />
      <input name="workflow" type="hidden" value={workflow} />
      <div className="sm:col-span-2">
        <h5 className="font-medium text-[var(--navy)]">{workflowLabel}</h5>
        <p className="mt-1 text-sm leading-5 text-[var(--muted)]">
          {workflowDescription}
        </p>
      </div>
      <label className="space-y-1.5 text-sm font-medium">
        Task
        <input
          className={fieldClassName}
          maxLength={200}
          minLength={2}
          name="title"
          placeholder="e.g. Prepare BOQ"
          required
        />
      </label>
      <label className="space-y-1.5 text-sm font-medium">
        Assign to
        <select
          className={fieldClassName}
          defaultValue=""
          name="assigneeUserId"
          required
        >
          <option disabled value="">
            Select another project member
          </option>
          {members.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.email}
              {member.professional_role ? ` · ${member.professional_role}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1.5 text-sm font-medium">
        Due date (optional)
        <input className={fieldClassName} name="dueDate" type="date" />
      </label>
      <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
        Instructions (optional)
        <textarea
          className="min-h-20 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"
          maxLength={2000}
          name="description"
          rows={3}
        />
      </label>
      <div className="space-y-3 sm:col-span-2">
        <SubmitButton
          disabled={disabled}
          label={workflow === "management" ? "Assign management task" : "Assign task"}
        />
        <AuthFeedback state={state} />
      </div>
    </form>
  );
}

function TaskCard({
  task,
  canManageTasks,
  currentUserId,
}: {
  task: ProjectTask;
  canManageTasks: boolean;
  currentUserId: string;
}) {
  const [submissionState, submissionAction] = useActionState(
    submitProjectTaskAction,
    {},
  );
  const [reviewState, reviewAction] = useActionState(
    reviewProjectTaskAction,
    {},
  );
  const canSubmit =
    task.assignee_user_id === currentUserId &&
    (task.status === "assigned" || task.status === "revision_requested");
  const canReviewTask =
    canManageTasks ||
    (task.workflow === "delegated" && task.assigned_by === currentUserId);
  const latestSubmission = task.submissions[0];

  return (
    <article className="rounded-lg border border-[var(--border)] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h5 className="font-medium text-[var(--navy)]">{task.title}</h5>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {task.workflow === "management"
              ? "Management workflow · "
              : "Member delegation · "}
            Assigned to {task.assignee_email}
            {task.assigned_by_email
              ? ` · Assigned by ${task.assigned_by_email}`
              : ""}
            {task.due_date
              ? ` · Due ${new Date(`${task.due_date}T00:00:00`).toLocaleDateString()}`
              : ""}
          </p>
          {task.description && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">
              {task.description}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[task.status]}`}
        >
          {statusLabels[task.status]}
        </span>
      </div>

      {task.review_note && (
        <p className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
          <span className="font-medium">Review feedback:</span>{" "}
          {task.review_note}
        </p>
      )}

      {task.submissions.length > 0 && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Submitted documents
          </p>
          <ol className="mt-2 space-y-2">
            {task.submissions.map((submission, index) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
                key={submission.id}
              >
                <span className="min-w-0">
                  {index === 0 ? "Latest · " : ""}
                  {submission.file_name}
                  <span className="ml-1 text-xs text-[var(--muted)]">
                    {formatFileSize(submission.file_size)} ·{" "}
                    {formatDate(submission.created_at)}
                  </span>
                </span>
                <a
                  className="shrink-0 font-medium text-[var(--teal-dark)] underline underline-offset-2"
                  href={`/api/project-task-submissions/${submission.id}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  Download
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}

      {canSubmit && (
        <form
          action={submissionAction}
          className="mt-3 flex flex-col gap-3 rounded-lg bg-teal-50 p-3 sm:flex-row sm:items-end"
        >
          <input name="taskId" type="hidden" value={task.id} />
          <label className="min-w-0 flex-1 space-y-1.5 text-sm font-medium">
            {task.status === "revision_requested"
              ? "Upload a revised task document (up to 10 MB)"
              : "Submit your task document (up to 10 MB)"}
            <input
              accept={submissionFileAccept}
              className="block w-full text-sm text-[var(--muted)] file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--navy)]"
              name="file"
              required
              type="file"
            />
          </label>
          <div className="space-y-3 sm:w-48">
            <SubmitButton label="Submit for review" />
            <AuthFeedback state={submissionState} />
          </div>
        </form>
      )}

      {canReviewTask && task.status === "submitted" && latestSubmission && (
        <form
          action={reviewAction}
          className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3"
        >
          <input name="taskId" type="hidden" value={task.id} />
          <label className="block space-y-1.5 text-sm font-medium">
            Review note (required when requesting changes)
            <textarea
              className="min-h-16 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"
              maxLength={1000}
              name="reviewNote"
              placeholder="Explain what needs changing before resubmission."
              rows={2}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="min-h-10 rounded-lg bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              name="decision"
              value="accept"
            >
              Accept and complete
            </button>
            <button
              className="min-h-10 rounded-lg border border-orange-300 bg-white px-4 py-2 text-sm font-semibold text-orange-900 hover:bg-orange-50"
              name="decision"
              value="request_changes"
            >
              Request changes
            </button>
          </div>
          <div className="mt-3">
            <AuthFeedback state={reviewState} />
          </div>
        </form>
      )}

      {task.status === "completed" && task.reviewed_by_email && (
        <p className="mt-3 text-xs text-[var(--muted)]">
          Accepted by {task.reviewed_by_email}
          {task.completed_at ? ` · ${formatDate(task.completed_at)}` : ""}
        </p>
      )}
    </article>
  );
}
