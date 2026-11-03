import { redirect } from "next/navigation";
import { ProjectDatabaseSetupNotice } from "@/components/project/project-database-setup-notice";
import { ProjectPortalDashboard } from "@/components/project/project-portal-dashboard";
import { ProjectPortalShell } from "@/components/project/project-portal-shell";
import { ProjectEventsWorkspace } from "@/components/project/project-events-workspace";
import { ProjectMilestoneWorkspace } from "@/components/project/project-milestone-workspace";
import { ProjectWorkspace } from "@/components/project/project-workspace";
import { ProjectFinanceWorkspace } from "@/components/project/project-finance-workspace";
import {
  getProjectDashboardData,
  getUserOrganisationRoles,
} from "@/lib/project-dashboard";
import { getProjectDocuments } from "@/lib/project-documents";
import { getProjectTasks } from "@/lib/project-tasks";
import { getProjectPaymentData } from "@/lib/project-payments";
import {
  getProjectEvents,
  getProjectMilestones,
  getProjectNotifications,
} from "@/lib/project-progress";

export default async function OwnerPortalPage() {
  const dashboard = await getProjectDashboardData();
  if (dashboard.setupRequired) {
    return (
      <ProjectPortalShell email={dashboard.user.email ?? ""} title="Owner portal">
        <ProjectDatabaseSetupNotice />
      </ProjectPortalShell>
    );
  }

  const roles = getUserOrganisationRoles(
    dashboard.user.id,
    dashboard.organisations,
    dashboard.projects,
  );
  const managementRoles = roles.filter(
    (membership) =>
      membership.role === "client" ||
      membership.role === "project_manager",
  );
  const isProjectCreator = dashboard.projects.some(
    (project) => project.created_by === dashboard.user.id,
  );
  const isClient = roles.some((membership) => membership.role === "client");
  if (managementRoles.length === 0 && !isProjectCreator && roles.length > 0) {
    redirect("/member");
  }

  const managementOrganisationIds = new Set(
    managementRoles.map((membership) => membership.organisationId),
  );
  const managedProjectIds = new Set(
    dashboard.organisations
      .filter(
        (organisation) =>
          organisation.project_id &&
          managementOrganisationIds.has(organisation.id) &&
          !dashboard.projects.some(
            (project) =>
              project.id === organisation.project_id &&
              project.created_by === dashboard.user.id,
          ),
      )
      .map((organisation) => organisation.project_id!),
  );
  const projects = dashboard.projects.filter(
    (project) =>
      project.created_by === dashboard.user.id ||
      managedProjectIds.has(project.id),
  );
  const projectIdList = projects.map((project) => project.id);
  const [
    documentResult,
    taskResult,
    milestoneResult,
    eventResult,
    notificationResult,
    paymentResult,
  ] = await Promise.all([
    getProjectDocuments(projectIdList),
    getProjectTasks(projectIdList),
    getProjectMilestones(projectIdList),
    getProjectEvents(projectIdList),
    getProjectNotifications(),
    getProjectPaymentData(projectIdList),
  ]);
  const projectIds = new Set(projects.map((project) => project.id));
  const organisations = dashboard.organisations.filter(
    (organisation) =>
      (organisation.project_id !== null &&
        projectIds.has(organisation.project_id)) ||
      (organisation.project_id === null &&
        organisation.members.some(
          (member) =>
            member.user_id === dashboard.user.id &&
              (member.role === "client" ||
                member.role === "project_manager") &&
              member.status === "active",
        )),
  );
  const canOpenMemberPortal = roles.some(
    (membership) => membership.role !== "client",
  );
  const projectNameById = new Map(
    projects.map((project) => [project.id, project.name]),
  );
  const financeSummary = paymentResult.terms.map((financeTerms) => ({
    project_id: financeTerms.project_id,
    project_name: projectNameById.get(financeTerms.project_id) ?? "Project",
    currency_code: financeTerms.currency_code,
    contract_amount: financeTerms.contract_amount,
    paid_amount:
      paymentResult.paidTotals.find(
        (total) => total.project_id === financeTerms.project_id,
      )?.paid_amount ?? 0,
  }));

  return (
    <ProjectPortalShell
      email={dashboard.user.email ?? ""}
      title="Owner portal"
      navigation={{
        sections: [
          {
            id: "projects",
            label: "Projects",
            content: (
              <ProjectWorkspace
                canCreateProjects={isClient || isProjectCreator || roles.length === 0}
                currentUserId={dashboard.user.id}
                documents={documentResult.documents}
                documentStorageReady={documentResult.ready}
                organisations={organisations}
                projects={projects}
                taskStorageReady={taskResult.ready}
                tasks={taskResult.tasks}
                view="projects"
              />
            ),
          },
          {
            id: "financing",
            label: "Financing",
            content: (
              <ProjectFinanceWorkspace
                applications={paymentResult.applications}
                currentUserId={dashboard.user.id}
                organisations={organisations}
                projects={projects}
                ready={paymentResult.ready}
                requiredDocuments={paymentResult.requiredDocuments}
                terms={paymentResult.terms}
              />
            ),
          },
          {
            id: "tasks",
            label: "Tasks",
            content: (
              <ProjectWorkspace
                canCreateProjects={isClient || isProjectCreator || roles.length === 0}
                currentUserId={dashboard.user.id}
                documents={documentResult.documents}
                documentStorageReady={documentResult.ready}
                organisations={organisations}
                projects={projects}
                taskStorageReady={taskResult.ready}
                tasks={taskResult.tasks}
                view="tasks"
              />
            ),
          },
          {
            id: "milestones",
            label: "Milestones",
            content: (
              <ProjectMilestoneWorkspace
                currentUserId={dashboard.user.id}
                milestones={milestoneResult.milestones}
                organisations={organisations}
                projects={projects}
                ready={milestoneResult.ready}
              />
            ),
          },
          {
            id: "events",
            label: "Events",
            content: (
              <ProjectEventsWorkspace
                currentUserId={dashboard.user.id}
                events={eventResult.events}
                organisations={organisations}
                projects={projects}
                ready={eventResult.ready}
              />
            ),
          },
        ],
        projectShortcuts: projects.map((project) => ({
          id: project.id,
          label: project.name,
        })),
      }}
      dashboard={
        <ProjectPortalDashboard
          currentUserId={dashboard.user.id}
          description="See project activity, monitor the task pipeline, and jump straight into work that needs attention."
          mode="owner"
          tasks={taskResult.tasks}
          milestones={milestoneResult.milestones}
          financeSummary={financeSummary}
          title="Owner dashboard"
        />
      }
      notifications={notificationResult}
      otherPortal={
        canOpenMemberPortal
          ? { href: "/member", label: "Team member portal" }
          : undefined
      }
    />
  );
}
