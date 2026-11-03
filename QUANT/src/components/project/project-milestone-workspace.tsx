"use client";

import { useActionState } from "react";
import {
  createProjectMilestoneAction,
  reviewMilestoneProgressAction,
  submitMilestoneProgressAction,
  updateProjectMilestoneAction,
} from "@/app/project-progress/actions";
import { AuthFeedback } from "@/components/auth/auth-feedback";
import { SubmitButton } from "@/components/auth/submit-button";
import type {
  Project,
  ProjectOrganisation,
} from "@/components/project/project-workspace";
import type {
  ProjectMilestone,
  ProjectMilestoneStatus,
} from "@/lib/project-milestone-types";

const fieldClassName =
  "h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)]";
const attachmentAccept =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/jpeg,image/png,text/plain";

const statusLabels: Record<ProjectMilestoneStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  at_risk: "At risk",
  completed: "Completed",
};

const statusStyles: Record<ProjectMilestoneStatus, string> = {
  planned: "bg-slate-100 text-slate-700",
  in_progress: "bg-sky-50 text-sky-800",
  at_risk: "bg-amber-50 text-amber-800",
  completed: "bg-emerald-50 text-emerald-800",
};

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

export function ProjectMilestoneWorkspace({
  currentUserId,
  projects,
  organisations,
  milestones,
  ready,
}: {
  currentUserId: string;
  projects: Project[];
  organisations: ProjectOrganisation[];
  milestones: ProjectMilestone[];
  ready: boolean;
}) {
  const organisationsByProject = new Map(
    organisations
      .filter((organisation) => organisation.project_id)
      .map((organisation) => [organisation.project_id!, organisation]),
  );

  return (
    <section aria-labelledby="milestones-heading" className="space-y-6">
      <header className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--teal)]">
          Project delivery
        </p>
        <h2
          className="mt-2 text-2xl font-semibold text-[var(--navy)]"
          id="milestones-heading"
        >
          Milestones &amp; progress
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Track planned dates and accountable members. Submitted progress and
          evidence is reflected in project completion after management review.
        </p>
      </header>

      {!ready ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          Milestone tracking is not set up yet. Apply the project milestones,
          activity, and events migration in Supabase, then reload this page.
        </p>
      ) : projects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
          Milestones will appear here when you have project access.
        </p>
      ) : (
        projects.map((project) => {
          const organisation = organisationsByProject.get(project.id);
          const activeMembers =
            organisation?.members.filter(
              (member) =>
                member.status === "active" && member.role !== "client",
            ) ?? [];
          const currentMembership = organisation?.members.find(
            (member) =>
              member.user_id === currentUserId && member.status === "active",
          );
          const canManage =
            project.created_by === currentUserId ||
            currentMembership?.role === "project_manager" ||
            currentMembership?.role === "client";
          const projectMilestones = milestones.filter(
            (milestone) => milestone.project_id === project.id,
          );

          return (
            <section
              aria-labelledby={`milestone-project-${project.id}`}
              className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm sm:p-6"
              key={project.id}
            >
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--teal)]">
                    Project milestones
                  </p>
                  <h3
                    className="mt-1 text-xl font-semibold text-[var(--navy)]"
                    id={`milestone-project-${project.id}`}
                  >
                    {project.name}
                  </h3>
                </div>
                <p className="text-sm text-[var(--muted)]">
                  {projectMilestones.length} milestone
                  {projectMilestones.length === 1 ? "" : "s"}
                </p>
              </div>
              {canManage && (
                <CreateMilestoneForm
                  members={activeMembers}
                  projectId={project.id}
                />
              )}
              {projectMilestones.length === 0 ? (
                <p className="mt-4 rounded-lg border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--muted)]">
                  {canManage
                    ? "Create the first milestone for this project."
                    : "No milestones have been published for this project."}
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {projectMilestones.map((milestone) => (
                    <MilestoneCard
                      canManage={canManage}
                      currentUserId={currentUserId}
                      key={milestone.id}
                      members={activeMembers}
                      milestone={milestone}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </section>
  );
}

function CreateMilestoneForm({
  projectId,
  members,
}: {
  projectId: string;
  members: ProjectOrganisation["members"];
}) {
  const [state, action] = useActionState(createProjectMilestoneAction, {});
  return (
    <details className="rounded-xl border border-[var(--border)] bg-slate-50">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--navy)]">
        + Add milestone
      </summary>
      <form
        action={action}
        className="grid gap-3 border-t border-[var(--border)] p-4 sm:grid-cols-2"
      >
        <input name="projectId" type="hidden" value={projectId} />
        <label className="space-y-1.5 text-sm font-medium">
          Milestone title
          <input
            className={fieldClassName}
            maxLength={200}
            minLength={2}
            name="title"
            placeholder="e.g. Foundation complete"
            required
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Responsible member
          <select
            className={fieldClassName}
            defaultValue=""
            name="responsibleUserId"
            required
          >
            <option disabled value="">
              Select an active member
            </option>
            {members.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.email}
                {member.professional_role
                  ? ` · ${member.professional_role}`
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Planned start
          <input
            className={fieldClassName}
            name="plannedStart"
            required
            type="date"
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Planned finish
          <input
            className={fieldClassName}
            name="plannedFinish"
            required
            type="date"
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
          Description (optional)
          <textarea
            className="min-h-20 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
            maxLength={2000}
            name="description"
            rows={3}
          />
        </label>
        <div className="space-y-3 sm:col-span-2">
          <SubmitButton
            disabled={members.length === 0}
            label="Create milestone"
          />
          {members.length === 0 && (
            <p className="text-sm text-amber-800">
              Add an active project manager or member before creating a
              milestone.
            </p>
          )}
          <AuthFeedback state={state} />
        </div>
      </form>
    </details>
  );
}

function MilestoneCard({
  milestone,
  members,
  currentUserId,
  canManage,
}: {
  milestone: ProjectMilestone;
  members: ProjectOrganisation["members"];
  currentUserId: string;
  canManage: boolean;
}) {
  const latestUpdate = milestone.updates[0];
  const [submissionState, submissionAction] = useActionState(
    submitMilestoneProgressAction,
    {},
  );
  const [reviewState, reviewAction] = useActionState(
    reviewMilestoneProgressAction,
    {},
  );
  const [editState, editAction] = useActionState(
    updateProjectMilestoneAction,
    {},
  );
  const canSubmit =
    milestone.responsible_user_id === currentUserId &&
    milestone.status !== "completed" &&
    latestUpdate?.status !== "submitted";

  return (
    <article className="rounded-xl border border-[var(--border)] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-semibold text-[var(--navy)]">
            {milestone.title}
          </h4>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Responsible: {milestone.responsible_email} · Planned{" "}
            {formatDate(milestone.planned_start)} –{" "}
            {formatDate(milestone.planned_finish)}
          </p>
          {milestone.description && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">
              {milestone.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[milestone.status]}`}
          >
            {statusLabels[milestone.status]}
          </span>
          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
            {milestone.progress_percent}%
          </span>
        </div>
      </div>

      {canManage && members.length > 0 && (
        <details className="mt-4 rounded-lg border border-[var(--border)] bg-slate-50">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-[var(--navy)]">
            Edit milestone
          </summary>
          <form
            action={editAction}
            className="grid gap-3 border-t border-[var(--border)] p-3 sm:grid-cols-2"
          >
            <input name="milestoneId" type="hidden" value={milestone.id} />
            <label className="space-y-1.5 text-sm font-medium">
              Title
              <input
                className={fieldClassName}
                defaultValue={milestone.title}
                maxLength={200}
                minLength={2}
                name="title"
                required
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Responsible member
              <select
                className={fieldClassName}
                defaultValue={milestone.responsible_user_id}
                name="responsibleUserId"
                required
              >
                {members.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Planned start
              <input
                className={fieldClassName}
                defaultValue={milestone.planned_start}
                name="plannedStart"
                required
                type="date"
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Planned finish
              <input
                className={fieldClassName}
                defaultValue={milestone.planned_finish}
                name="plannedFinish"
                required
                type="date"
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Status
              <select
                className={fieldClassName}
                defaultValue={milestone.status}
                name="status"
                required
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
              Description
              <textarea
                className="min-h-16 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
                defaultValue={milestone.description}
                maxLength={2000}
                name="description"
                rows={2}
              />
            </label>
            <div className="space-y-3 sm:col-span-2">
              <SubmitButton label="Save milestone" />
              <AuthFeedback state={editState} />
            </div>
          </form>
        </details>
      )}

      {milestone.updates.length > 0 && (
        <ol className="mt-4 space-y-3">
          {milestone.updates.map((update) => (
            <li
              className="rounded-lg bg-slate-50 p-3"
              key={update.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--navy)]">
                  {update.progress_percent}% progress ·{" "}
                  {update.submitted_by_email ?? "Project member"}
                </p>
                <span className="text-xs text-[var(--muted)]">
                  {new Date(update.created_at).toLocaleString()} ·{" "}
                  {update.status.replace("_", " ")}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">
                {update.update_note}
              </p>
              {update.file_name && (
                <a
                  className="mt-2 inline-flex text-sm font-medium text-[var(--teal-dark)] underline underline-offset-2"
                  href={`/api/project-milestone-updates/${update.id}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  Evidence: {update.file_name}
                </a>
              )}
              {update.review_note && (
                <p className="mt-2 rounded-md border border-orange-200 bg-orange-50 p-2 text-sm text-orange-900">
                  <strong>Review note:</strong> {update.review_note}
                </p>
              )}
              {canManage && update.status === "submitted" && (
                <form
                  action={reviewAction}
                  className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3"
                >
                  <input name="updateId" type="hidden" value={update.id} />
                  <label className="block space-y-1 text-sm font-medium">
                    Review note (required when requesting changes)
                    <textarea
                      className="min-h-16 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
                      maxLength={1000}
                      name="reviewNote"
                      rows={2}
                    />
                  </label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="rounded-lg bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white"
                      name="decision"
                      value="approve"
                    >
                      Approve progress
                    </button>
                    <button
                      className="rounded-lg border border-orange-300 bg-white px-4 py-2 text-sm font-semibold text-orange-900"
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
            </li>
          ))}
        </ol>
      )}

      {canSubmit && (
        <form
          action={submissionAction}
          className="mt-4 grid gap-3 rounded-lg bg-teal-50 p-3 sm:grid-cols-2"
        >
          <input name="milestoneId" type="hidden" value={milestone.id} />
          <label className="space-y-1.5 text-sm font-medium">
            Progress percentage
            <input
              className={fieldClassName}
              max={100}
              min={0}
              name="progressPercent"
              required
              type="number"
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            Evidence attachment (optional, max 10 MB)
            <input
              accept={attachmentAccept}
              className="block w-full text-sm text-[var(--muted)] file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--navy)]"
              name="file"
              type="file"
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
            Progress note
            <textarea
              className="min-h-20 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
              maxLength={2000}
              minLength={2}
              name="updateNote"
              placeholder="Summarize work completed, issues, and next steps."
              required
              rows={3}
            />
          </label>
          <div className="space-y-3 sm:col-span-2">
            <SubmitButton label="Submit progress for review" />
            <AuthFeedback state={submissionState} />
          </div>
        </form>
      )}
    </article>
  );
}
