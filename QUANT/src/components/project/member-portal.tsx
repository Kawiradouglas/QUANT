"use client";

import type {
  Project,
  ProjectOrganisation,
} from "@/components/project/project-workspace";
import { ProjectPermissions } from "@/components/project/project-permissions";
import { ProjectDocumentRegister } from "@/components/project/project-document-register";
import { ProjectTaskOverview } from "@/components/project/project-task-overview";
import type { ProjectDocument } from "@/lib/project-document-types";
import { ProjectTaskBoard } from "@/components/project/project-task-board";
import type { ProjectTask } from "@/lib/project-task-types";
import { usePortalNavigation } from "@/components/project/project-portal-navigation";
import { MemberProjectCreate } from "@/components/project/member-project-create";

export function MemberPortal({
  projects,
  organisations,
  currentUserId,
  documents,
  documentStorageReady,
  tasks,
  taskStorageReady,
  view,
}: {
  projects: Project[];
  organisations: ProjectOrganisation[];
  currentUserId: string;
  documents: ProjectDocument[];
  documentStorageReady: boolean;
  tasks: ProjectTask[];
  taskStorageReady: boolean;
  view: "projects" | "tasks";
}) {
  const navigation = usePortalNavigation();
  const membershipProjectIds = new Set(
    organisations
      .filter((organisation) =>
        organisation.members.some(
          (member) =>
            member.user_id === currentUserId &&
            member.status === "active" &&
            member.role !== "client",
        ),
      )
      .map((organisation) => organisation.project_id)
      .filter((projectId): projectId is string => projectId !== null),
  );
  const memberProjects = projects.filter((project) =>
    membershipProjectIds.has(project.id) || project.created_by === currentUserId,
  );
  const selectedProject = memberProjects.find(
    (project) => project.id === navigation?.activeProjectId,
  );
  const visibleProjects = selectedProject ? [selectedProject] : memberProjects;
  const organisationsByProject = new Map(
    organisations
      .filter((organisation) => organisation.project_id)
      .map((organisation) => [organisation.project_id!, organisation]),
  );
  const memberTasks = tasks.filter(
    (task) =>
      memberProjects.some((project) => project.id === task.project_id) &&
      (task.assignee_user_id === currentUserId ||
        task.assigned_by === currentUserId),
  );

  if (view === "tasks") {
    return (
      <div className="space-y-6">
        <header className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--teal)]">
            Your work queue
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--navy)]">
            Tasks
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Open an assigned task to submit your work, or review submissions
            for tasks you delegated.
          </p>
        </header>
        <ProjectTaskOverview projects={memberProjects} tasks={memberTasks} />
        {memberProjects.length === 0 ? (
          <EmptyProjects />
        ) : (
          memberProjects.map((project) => {
            const organisation = organisationsByProject.get(project.id);
            const membership = organisation?.members.find(
              (member) =>
                member.user_id === currentUserId &&
                member.status === "active",
            );

            return (
              <section
                aria-labelledby={`member-task-project-${project.id}`}
                className="scroll-mt-6 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm sm:p-6"
                id={`project-tasks-${project.id}`}
                key={project.id}
              >
                <h3
                  className="mb-4 text-lg font-semibold text-[var(--navy)]"
                  id={`member-task-project-${project.id}`}
                >
                  {project.name}
                </h3>
                <ProjectTaskBoard
                  canAssignTasks={
                    membership !== undefined && membership.role !== "client"
                  }
                  canManageTasks={false}
                  currentUserId={currentUserId}
                  members={organisation?.members ?? []}
                  projectId={project.id}
                  storageReady={taskStorageReady}
                  tasks={memberTasks.filter(
                    (task) => task.project_id === project.id,
                  )}
                />
              </section>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--teal)]">
          Project details
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--navy)]">
          Your projects
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          {selectedProject
            ? "View the project and document details shared with you."
            : "Select a project to view the details and documents shared with you."}
        </p>
      </header>
      {selectedProject && (
        <button
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--navy)] shadow-sm transition hover:border-[var(--teal)] hover:text-[var(--teal-dark)]"
          onClick={() => navigation?.backToProjects()}
          type="button"
        >
          <span aria-hidden="true">←</span> All projects
        </button>
      )}
      {!selectedProject && <ProjectPermissions mode="member" />}
      {!selectedProject && <MemberProjectCreate />}
      {memberProjects.length === 0 ? (
        <EmptyProjects />
      ) : (
        <div className="space-y-5">
          {visibleProjects.map((project) => {
            const organisation = organisationsByProject.get(project.id);
            const membership = organisation?.members.find(
              (member) =>
                member.user_id === currentUserId &&
                member.status === "active",
            );

            return (
              <article
                className="scroll-mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm"
                id={`project-${project.id}`}
                key={project.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5 sm:px-7">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--teal)]">
                      Project
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-[var(--navy)]">
                      {project.name}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Contract: {project.contract_type} · Delivery:{" "}
                      {project.delivery_mode}
                    </p>
                    {!selectedProject && (
                      <button
                        className="mt-3 rounded-lg bg-[var(--navy)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--teal-dark)]"
                        onClick={() => navigation?.openProject(project.id)}
                        type="button"
                      >
                        Open project
                      </button>
                    )}
                  </div>
                  {project.created_by === currentUserId ? (
                    <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-[var(--teal-dark)]">
                      Project owner
                    </span>
                  ) : membership ? (
                    <span className="flex flex-col items-start gap-1">
                      <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium capitalize text-[var(--teal-dark)]">
                        {membership.role.replaceAll("_", " ")}
                      </span>
                      {membership.professional_role && (
                        <span className="text-xs text-[var(--muted)]">
                          {membership.professional_role}
                        </span>
                      )}
                    </span>
                  ) : null}
                </div>
                <div className="px-6 py-5 sm:px-7">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                    Organisation
                  </p>
                  <p className="mt-1 font-medium text-[var(--foreground)]">
                    {organisation?.name ?? "Project organisation setup pending"}
                  </p>
                </div>
                <div className="px-6 pb-5 sm:px-7">
                  <ProjectDocumentRegister
                    canUpload={false}
                    documents={documents.filter(
                      (document) => document.project_id === project.id,
                    )}
                    projectId={project.id}
                    storageReady={documentStorageReady}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyProjects() {
  return (
    <section className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-6 py-10 text-center">
      <h2 className="font-semibold text-[var(--navy)]">
        No assigned projects yet
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        The client or project manager will add you to a project team.
      </p>
    </section>
  );
}
