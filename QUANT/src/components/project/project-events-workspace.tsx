"use client";

import { useActionState } from "react";
import { createProjectEventAction } from "@/app/project-progress/actions";
import { AuthFeedback } from "@/components/auth/auth-feedback";
import { SubmitButton } from "@/components/auth/submit-button";
import type {
  Project,
  ProjectOrganisation,
} from "@/components/project/project-workspace";
import type {
  ProjectEvent,
  ProjectEventKind,
} from "@/lib/project-milestone-types";

const fieldClassName =
  "h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)]";

const kindLabels: Record<ProjectEventKind, string> = {
  announcement: "Announcement",
  meeting: "Meeting",
  site_visit: "Site visit",
  other: "Other event",
};

export function ProjectEventsWorkspace({
  currentUserId,
  projects,
  organisations,
  events,
  ready,
}: {
  currentUserId: string;
  projects: Project[];
  organisations: ProjectOrganisation[];
  events: ProjectEvent[];
  ready: boolean;
}) {
  const organisationsByProject = new Map(
    organisations
      .filter((organisation) => organisation.project_id)
      .map((organisation) => [organisation.project_id!, organisation]),
  );

  return (
    <section aria-labelledby="events-heading" className="space-y-6">
      <header className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--teal)]">
          Keep the team aligned
        </p>
        <h2
          className="mt-2 text-2xl font-semibold text-[var(--navy)]"
          id="events-heading"
        >
          Events &amp; announcements
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Publish workspace updates and coordinate upcoming meetings and site
          visits with the project team.
        </p>
      </header>

      {!ready ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          Project events are not set up yet. Apply the project milestones,
          activity, and events migration in Supabase, then reload this page.
        </p>
      ) : projects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
          Events will appear here when you have project access.
        </p>
      ) : (
        projects.map((project) => {
          const currentMember = organisationsByProject
            .get(project.id)
            ?.members.find(
              (member) =>
                member.user_id === currentUserId && member.status === "active",
            );
          const canManage =
            project.created_by === currentUserId ||
            currentMember?.role === "project_manager" ||
            currentMember?.role === "client";
          const projectEvents = events.filter(
            (event) => event.project_id === project.id,
          );
          return (
            <section
              aria-labelledby={`events-project-${project.id}`}
              className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm sm:p-6"
              key={project.id}
            >
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--teal)]">
                  Project workspace
                </p>
                <h3
                  className="mt-1 text-xl font-semibold text-[var(--navy)]"
                  id={`events-project-${project.id}`}
                >
                  {project.name}
                </h3>
              </div>
              {canManage && <CreateEventForm projectId={project.id} />}
              {projectEvents.length === 0 ? (
                <p className="mt-4 rounded-lg border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--muted)]">
                  No events or announcements have been published.
                </p>
              ) : (
                <ol className="mt-4 space-y-3">
                  {projectEvents.map((event) => (
                    <li
                      className="rounded-xl border border-[var(--border)] p-4"
                      key={event.id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
                            {kindLabels[event.kind]}
                          </span>
                          <h4 className="mt-2 font-semibold text-[var(--navy)]">
                            {event.title}
                          </h4>
                        </div>
                        {event.starts_at && (
                          <time
                            className="text-sm font-medium text-[var(--navy)]"
                            dateTime={event.starts_at}
                          >
                            {new Date(event.starts_at).toLocaleString()}
                          </time>
                        )}
                      </div>
                      {event.location && (
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          Location: {event.location}
                        </p>
                      )}
                      {event.details && (
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">
                          {event.details}
                        </p>
                      )}
                      <p className="mt-3 text-xs text-[var(--muted)]">
                        Posted by {event.created_by_email ?? "Project manager"} ·{" "}
                        {new Date(event.created_at).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          );
        })
      )}
    </section>
  );
}

function CreateEventForm({ projectId }: { projectId: string }) {
  const [state, action] = useActionState(createProjectEventAction, {});
  return (
    <details className="rounded-xl border border-[var(--border)] bg-slate-50">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--navy)]">
        + Create event or announcement
      </summary>
      <form
        action={action}
        className="grid gap-3 border-t border-[var(--border)] p-4 sm:grid-cols-2"
      >
        <input name="projectId" type="hidden" value={projectId} />
        <label className="space-y-1.5 text-sm font-medium">
          Type
          <select className={fieldClassName} name="kind" required>
            <option value="announcement">Announcement</option>
            <option value="meeting">Meeting</option>
            <option value="site_visit">Site visit</option>
            <option value="other">Other event</option>
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Title
          <input
            className={fieldClassName}
            maxLength={200}
            minLength={2}
            name="title"
            required
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Date and time in UTC (required for scheduled events)
          <input className={fieldClassName} name="startsAt" type="datetime-local" />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Location (optional)
          <input
            className={fieldClassName}
            maxLength={300}
            name="location"
            placeholder="Meeting room or site location"
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
          Details (optional)
          <textarea
            className="min-h-20 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
            maxLength={4000}
            name="details"
            rows={3}
          />
        </label>
        <div className="space-y-3 sm:col-span-2">
          <SubmitButton label="Publish to project" />
          <AuthFeedback state={state} />
        </div>
      </form>
    </details>
  );
}
