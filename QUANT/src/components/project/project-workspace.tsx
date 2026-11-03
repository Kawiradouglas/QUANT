"use client";

import { useActionState, useState } from "react";
import {
  createProjectOrganisationAction,
  inviteOrganisationMemberAction,
  updateProjectMemberAssignmentAction,
} from "@/app/organisation/actions";
import { AuthFeedback } from "@/components/auth/auth-feedback";
import { SubmitButton } from "@/components/auth/submit-button";
import { ProjectCreateForm } from "@/components/project/project-create-form";
import { ProjectConfigurationForm } from "@/components/project/project-configuration-form";
import { ProjectDocumentRegister } from "@/components/project/project-document-register";
import { ProjectTaskBoard } from "@/components/project/project-task-board";
import { ProjectTaskOverview } from "@/components/project/project-task-overview";
import { ProjectPermissions } from "@/components/project/project-permissions";
import { usePortalNavigation } from "@/components/project/project-portal-navigation";
import type { ProjectDocument } from "@/lib/project-document-types";
import type { ProjectTask } from "@/lib/project-task-types";
import type { ProjectAccessRole } from "@/lib/project-roles";

type MembershipStatus = "active" | "invited";

export type OrganisationMember = {
  organisation_id: string;
  user_id: string;
  email: string;
  role: ProjectAccessRole;
  professional_role: string | null;
  status: MembershipStatus;
};

export type ProjectOrganisation = {
  id: string;
  name: string;
  project_id: string | null;
  members: OrganisationMember[];
};

export type Project = {
  id: string;
  name: string;
  contract_type: string;
  delivery_mode: string;
  created_by: string;
};

const fieldClassName =
  "h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)] placeholder:text-slate-400";

export function ProjectWorkspace({
  currentUserId,
  projects,
  organisations,
  canCreateProjects,
  documents,
  documentStorageReady,
  tasks,
  taskStorageReady,
  view,
}: {
  currentUserId: string;
  projects: Project[];
  organisations: ProjectOrganisation[];
  canCreateProjects: boolean;
  documents: ProjectDocument[];
  documentStorageReady: boolean;
  tasks: ProjectTask[];
  taskStorageReady: boolean;
  view: "projects" | "tasks";
}) {
  const [showCreateProjectForm, setShowCreateProjectForm] = useState(false);
  const navigation = usePortalNavigation();
  const selectedProject = projects.find(
    (project) => project.id === navigation?.activeProjectId,
  );
  const projectIds = new Set(projects.map((project) => project.id));
  const organisationsByProject = new Map(
    organisations
      .filter((organisation) => organisation.project_id)
      .map((organisation) => [organisation.project_id!, organisation]),
  );
  const unlinkedOrganisations = organisations.filter(
    (organisation) =>
      organisation.project_id === null ||
      !projectIds.has(organisation.project_id),
  );

  return (
    <div className="space-y-8">
      {view === "projects" ? (
        <>
          {selectedProject ? (
            <section aria-labelledby="selected-project-heading">
              <button
                className="mb-5 inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--navy)] shadow-sm transition hover:border-[var(--teal)] hover:text-[var(--teal-dark)]"
                onClick={() => navigation?.backToProjects()}
                type="button"
              >
                <span aria-hidden="true">←</span> All projects
              </button>
              <h2 className="sr-only" id="selected-project-heading">
                {selectedProject.name} details
              </h2>
              <ProjectCard
                currentUserId={currentUserId}
                canCreateProjects={canCreateProjects}
                documentStorageReady={documentStorageReady}
                documents={documents.filter(
                  (document) => document.project_id === selectedProject.id,
                )}
                tasks={[]}
                taskStorageReady={taskStorageReady}
                organisation={organisationsByProject.get(selectedProject.id)}
                project={selectedProject}
                showTasks={false}
              />
            </section>
          ) : (
          <section aria-labelledby="projects-heading" id="projects">
            <div className="mb-5">
              <p className="text-sm font-medium text-[var(--teal)]">Browse workspace</p>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2
                    className="mt-1 text-2xl font-semibold text-[var(--navy)]"
                    id="projects-heading"
                  >
                    Your projects
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Select a project to open its details and team workspace.
                  </p>
                </div>
                {canCreateProjects && (
                  <button
                    className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--teal-dark)]"
                    aria-expanded={showCreateProjectForm}
                    aria-controls="create-project"
                    onClick={() =>
                      setShowCreateProjectForm((showForm) => !showForm)
                    }
                    type="button"
                  >
                    {showCreateProjectForm ? "Cancel" : "+ Create project"}
                  </button>
                )}
              </div>
            </div>

            {canCreateProjects && showCreateProjectForm && (
              <section
                aria-labelledby="create-project-heading"
                className="mb-5 scroll-mt-6 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm sm:p-6"
                id="create-project"
              >
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--teal)]">
                  New project
                </p>
                <h3
                  className="mt-1 text-lg font-semibold text-[var(--navy)]"
                  id="create-project-heading"
                >
                  Create a project
                </h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                  Add a new project here. Once you open a project, this option
                  stays in the project browser, not inside the project itself.
                </p>
                <div className="mt-4">
                  <ProjectCreateForm />
                </div>
              </section>
            )}

            {projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-6 py-10 text-center">
                <p className="font-medium text-[var(--navy)]">No projects yet</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Create a project above to start its setup.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {projects.map((project) => (
                  <button
                    className="group rounded-2xl border border-[var(--border)] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--teal)] hover:shadow-lg"
                    key={project.id}
                    onClick={() => navigation?.openProject(project.id)}
                    type="button"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span>
                        <span className="block text-lg font-semibold text-[var(--navy)]">
                          {project.name}
                        </span>
                        <span className="mt-2 block text-sm text-[var(--muted)]">
                          {project.contract_type} · {project.delivery_mode}
                        </span>
                      </span>
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-lg font-semibold text-[var(--teal-dark)] transition group-hover:bg-[var(--navy)] group-hover:text-white">
                        →
                      </span>
                    </span>
                    <span className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-[var(--muted)]">
                      <span>
                        {organisationsByProject.get(project.id)?.name ??
                          "Team setup pending"}
                      </span>
                      <span>Open project</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
          )}

          {!selectedProject && (
            <>
              <ProjectPermissions mode="owner" />

              {unlinkedOrganisations.length > 0 && (
                <section aria-labelledby="unlinked-organisations-heading">
                  <h2
                    className="mb-4 text-xl font-semibold text-[var(--navy)]"
                    id="unlinked-organisations-heading"
                  >
                    Other organisations
                  </h2>
                  <div className="space-y-5">
                    {unlinkedOrganisations.map((organisation) => (
                      <OrganisationCard
                        currentUserId={currentUserId}
                        clientCanAssignProjectManagers={canCreateProjects}
                        key={organisation.id}
                        organisation={organisation}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      ) : (
        <section aria-labelledby="managed-tasks-heading" id="tasks">
          <div className="mb-5">
            <p className="text-sm font-medium text-[var(--teal)]">
              Work queue
            </p>
            <h2
              className="mt-1 text-2xl font-semibold text-[var(--navy)]"
              id="managed-tasks-heading"
            >
              Project tasks
            </h2>
          </div>
          <ProjectTaskOverview projects={projects} tasks={tasks} />
          {projects.map((project) => {
            const organisation = organisationsByProject.get(project.id);
            const currentProjectRole = organisation?.members.find(
              (member) =>
                member.user_id === currentUserId && member.status === "active",
            )?.role;
            const canManageTasks =
              project.created_by === currentUserId ||
              currentProjectRole === "project_manager";

            return (
              <section
                aria-labelledby={`managed-task-project-${project.id}`}
                className="mt-5 scroll-mt-6 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm sm:p-6"
                id={`project-tasks-${project.id}`}
                key={project.id}
              >
                <h3
                  className="mb-4 text-lg font-semibold text-[var(--navy)]"
                  id={`managed-task-project-${project.id}`}
                >
                  {project.name}
                </h3>
                <ProjectTaskBoard
                  canAssignTasks={canManageTasks}
                  canManageTasks={canManageTasks}
                  currentUserId={currentUserId}
                  members={organisation?.members ?? []}
                  projectId={project.id}
                  storageReady={taskStorageReady}
                  tasks={tasks.filter((task) => task.project_id === project.id)}
                />
              </section>
            );
          })}
        </section>
      )}
    </div>
  );
}

function ProjectCard({
  currentUserId,
  project,
  organisation,
  canCreateProjects,
  documents,
  documentStorageReady,
  tasks,
  taskStorageReady,
  showTasks = true,
}: {
  currentUserId: string;
  project: Project;
  organisation?: ProjectOrganisation;
  canCreateProjects: boolean;
  documents: ProjectDocument[];
  documentStorageReady: boolean;
  tasks: ProjectTask[];
  taskStorageReady: boolean;
  showTasks?: boolean;
}) {
  const currentProjectRole = organisation?.members.find(
    (member) =>
      member.user_id === currentUserId && member.status === "active",
  )?.role;
  const canManageDocuments =
    project.created_by === currentUserId ||
    currentProjectRole === "project_manager";

  return (
    <article
      className="scroll-mt-6 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm"
      id={`project-${project.id}`}
    >
      <div className="border-b border-[var(--border)] px-6 py-5 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--navy)]">
              {project.name}
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {project.contract_type} · {project.delivery_mode}
            </p>
          </div>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-[var(--teal-dark)]">
            {project.created_by === currentUserId
              ? "Client"
              : currentProjectRole === "project_manager"
                ? "Project manager"
                : "Project team"}
          </span>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        {project.created_by === currentUserId && (
          <div className="mb-5">
            <ProjectConfigurationForm project={project} />
          </div>
        )}
        {organisation ? (
          <OrganisationCard
            clientCanAssignProjectManagers={canCreateProjects}
            currentUserId={currentUserId}
            organisation={organisation}
          />
        ) : canCreateProjects && project.created_by === currentUserId ? (
          <CreateProjectOrganisationForm projectId={project.id} />
        ) : (
          <p className="text-sm leading-6 text-[var(--muted)]">
            The project manager is setting up the organisation and team.
          </p>
        )}
        <ProjectDocumentRegister
          canUpload={canManageDocuments}
          documents={documents}
          projectId={project.id}
          storageReady={documentStorageReady}
        />
        {showTasks && (
          <ProjectTaskBoard
            canAssignTasks={
              canManageDocuments || currentProjectRole === "member"
            }
            canManageTasks={canManageDocuments}
            currentUserId={currentUserId}
            members={organisation?.members ?? []}
            projectId={project.id}
            storageReady={taskStorageReady}
            tasks={tasks}
          />
        )}
      </div>
    </article>
  );
}

function CreateProjectOrganisationForm({ projectId }: { projectId: string }) {
  const [state, action] = useActionState(
    createProjectOrganisationAction,
    {},
  );

  return (
    <div className="rounded-lg bg-slate-50 p-5">
      <p className="text-sm font-medium text-[var(--teal)]">
        Project setup · Step 3
      </p>
      <h4 className="mt-1 font-semibold text-[var(--navy)]">
        Create its organisation
      </h4>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
        Set up the project team space. You are the client and can invite
        project managers and team members afterward.
      </p>
      <form action={action} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input name="projectId" type="hidden" value={projectId} />
        <label className="sr-only" htmlFor={`organisation-name-${projectId}`}>
          Organisation name
        </label>
        <input
          autoComplete="organization"
          className={fieldClassName}
          id={`organisation-name-${projectId}`}
          maxLength={100}
          minLength={2}
          name="name"
          placeholder="e.g. North District Project Team"
          required
        />
        <div className="sm:w-56">
          <SubmitButton label="Create organisation" />
        </div>
      </form>
      <div className="mt-3">
        <AuthFeedback state={state} />
      </div>
    </div>
  );
}

function OrganisationCard({
  currentUserId,
  organisation,
  clientCanAssignProjectManagers,
}: {
  currentUserId: string;
  organisation: ProjectOrganisation;
  clientCanAssignProjectManagers: boolean;
}) {
  const currentRole = organisation.members.find(
    (member) => member.user_id === currentUserId,
  )?.role;
  const canInvite =
    currentRole === "client" || currentRole === "project_manager";
  const canAssignProjectManagers =
    currentRole === "client" && clientCanAssignProjectManagers;
  const canManageRoles = canInvite;
  const [inviteState, inviteAction] = useActionState(
    inviteOrganisationMemberAction,
    {},
  );

  return (
    <section
      aria-label={`Organisation ${organisation.name}`}
      className="rounded-lg border border-[var(--border)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            Organisation
          </p>
          <h4 className="mt-1 font-semibold text-[var(--navy)]">
            {organisation.name}
          </h4>
        </div>
        {currentRole && (
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium capitalize text-[var(--teal-dark)]">
            Your project role: {currentRole.replaceAll("_", " ")}
          </span>
        )}
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h5 className="text-sm font-semibold text-[var(--navy)]">
              Project team
            </h5>
            <span className="text-xs text-[var(--muted)]">
              {organisation.members.length}{" "}
              {organisation.members.length === 1 ? "person" : "people"}
            </span>
          </div>
          {organisation.members.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No members are listed yet.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-[var(--border)]">
              {organisation.members.map((member) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                  key={member.user_id}
                >
                  <span className="min-w-0 truncate text-sm text-[var(--foreground)]">
                    <span className="block">{member.email}</span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">
                      {member.professional_role ?? "Project role not provided"}
                    </span>
                  </span>
                  {canManageRoles &&
                  member.user_id !== currentUserId &&
                  member.role !== "client" &&
                  (canAssignProjectManagers || member.role === "member") ? (
                    <RoleForm
                      canAssignProjectManagers={canAssignProjectManagers}
                      email={member.email}
                      organisationId={organisation.id}
                      role={member.role}
                      professionalRole={member.professional_role ?? ""}
                      userId={member.user_id}
                    />
                  ) : (
                    <span className="flex items-center gap-2">
                      {member.status === "invited" && (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                          Invitation pending
                        </span>
                      )}
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                        {member.role.replaceAll("_", " ")}
                      </span>
                    </span>
                  )}
                  {canManageRoles &&
                    member.status === "invited" &&
                    member.user_id !== currentUserId &&
                    member.role !== "client" && (
                      <span className="text-xs text-amber-800">
                        Invitation pending
                      </span>
                    )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {canInvite ? (
          <div className="rounded-lg bg-slate-50 p-4">
            <h5 className="text-sm font-semibold text-[var(--navy)]">
              Invite a member by email
            </h5>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Assign each invitee a project access role and professional
              discipline. Existing confirmed accounts are added directly;
              new accounts can receive an email or a shareable link.
            </p>
            <form action={inviteAction} className="mt-4 space-y-3">
              <input
                name="organisationId"
                type="hidden"
                value={organisation.id}
              />
              <label
                className="block space-y-1.5 text-sm font-medium"
                htmlFor={`invite-email-${organisation.id}`}
              >
                Email address
                <input
                  autoComplete="email"
                  className={fieldClassName}
                  id={`invite-email-${organisation.id}`}
                  name="email"
                  required
                  type="email"
                />
              </label>
              <label
                className="block space-y-1.5 text-sm font-medium"
                htmlFor={`invite-role-${organisation.id}`}
              >
                Project access role
                <select
                  className={fieldClassName}
                  defaultValue="member"
                  id={`invite-role-${organisation.id}`}
                  name="projectAccessRole"
                >
                  {canAssignProjectManagers && (
                    <option value="project_manager">Project manager</option>
                  )}
                  <option value="member">Project member</option>
                </select>
              </label>
              <ProfessionalRoleFields
                id={`invite-profession-${organisation.id}`}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <SubmitButton
                  label="Send invitation"
                  name="delivery"
                  value="email"
                />
                <SubmitButton
                  label="Create shareable link"
                  name="delivery"
                  value="manual"
                />
              </div>
              <AuthFeedback state={inviteState} />
              {inviteState.inviteLink && (
                <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <label
                    className="block text-xs font-semibold text-emerald-900"
                    htmlFor={`invite-link-${organisation.id}`}
                  >
                    Invitation link
                  </label>
                  <input
                    className="h-10 w-full rounded-md border border-emerald-300 bg-white px-2 text-xs text-slate-800"
                    id={`invite-link-${organisation.id}`}
                    readOnly
                    value={inviteState.inviteLink}
                  />
                  <p className="text-xs leading-5 text-emerald-900">
                    Copy the full link and send it privately to the invited
                    person. It opens their member portal after confirmation and
                    password setup.
                  </p>
                </div>
              )}
            </form>
          </div>
        ) : (
          <p className="self-center text-sm leading-6 text-[var(--muted)]">
            Only the client or an assigned project manager can invite members.
          </p>
        )}
      </div>
    </section>
  );
}

function RoleForm({
  email,
  organisationId,
  userId,
  role,
  professionalRole,
  canAssignProjectManagers,
}: {
  email: string;
  organisationId: string;
  userId: string;
  role: ProjectAccessRole;
  professionalRole: string;
  canAssignProjectManagers: boolean;
}) {
  const [state, action] = useActionState(
    updateProjectMemberAssignmentAction,
    {},
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input name="organisationId" type="hidden" value={organisationId} />
      <input name="userId" type="hidden" value={userId} />
      <label className="sr-only" htmlFor={`project-role-${userId}`}>
        Project access for {email}
      </label>
      <select
        className="h-9 rounded-lg border border-[var(--border)] bg-white px-2 text-xs capitalize"
        defaultValue={role}
        id={`project-role-${userId}`}
        name="projectAccessRole"
      >
        {canAssignProjectManagers && (
          <option value="project_manager">Project manager</option>
        )}
        <option value="member">Project member</option>
      </select>
      <label className="sr-only" htmlFor={`profession-${userId}`}>
        Professional role for {email}
      </label>
      <input
        className="h-9 min-w-40 rounded-lg border border-[var(--border)] bg-white px-2 text-xs"
        defaultValue={professionalRole}
        id={`profession-${userId}`}
        maxLength={80}
        minLength={2}
        name="professionalRole"
        placeholder="Professional role"
        required
      />
      <button
        className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-medium text-[var(--foreground)] hover:bg-slate-50 disabled:opacity-60"
        type="submit"
      >
        Save
      </button>
      <div className="basis-full">
        <AuthFeedback state={state} />
      </div>
    </form>
  );
}

function ProfessionalRoleFields({ id }: { id: string }) {
  return (
    <label
      className="block space-y-1.5 text-sm font-medium"
      htmlFor={id}
    >
      Professional role
      <input
        className={fieldClassName}
        list={`${id}-suggestions`}
        maxLength={80}
        minLength={2}
        name="professionalRole"
        placeholder="e.g. Engineer or Quantity Surveyor (Consultant)"
        required
      />
      <datalist id={`${id}-suggestions`}>
        <option value="Engineer" />
        <option value="Architect" />
        <option value="Contractor" />
        <option value="Quantity Surveyor (Contractor)" />
        <option value="Quantity Surveyor (Consultant)" />
      </datalist>
    </label>
  );
}
