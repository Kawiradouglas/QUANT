import { redirect } from "next/navigation";
import { MemberPortal } from "@/components/project/member-portal";
import { ProjectDatabaseSetupNotice } from "@/components/project/project-database-setup-notice";
import { ProjectPortalDashboard } from "@/components/project/project-portal-dashboard";
import { ProjectPortalShell } from "@/components/project/project-portal-shell";
import { ProjectEventsWorkspace } from "@/components/project/project-events-workspace";
import { ProjectMilestoneWorkspace } from "@/components/project/project-milestone-workspace";
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

export default async function MemberPortalPage() {
  const dashboard = await getProjectDashboardData();
  if (dashboard.setupRequired) {
    return (
      <ProjectPortalShell
        email={dashboard.user.email ?? ""}
        title="Team member portal"
      >
        <ProjectDatabaseSetupNotice />
      </ProjectPortalShell>
    );
  }

  const roles = getUserOrganisationRoles(
    dashboard.user.id,
    dashboard.organisations,
    dashboard.projects,
  );
  const memberRoles = roles.filter((membership) => membership.role !== "client");
  if (memberRoles.length === 0) {
    redirect("/owner");
  }

  const memberProjectIds = new Set(
    memberRoles
      .map((membership) => membership.projectId)
      .filter((projectId): projectId is string => projectId !== null),
  );
  const projects = dashboard.projects.filter((project) =>
    memberProjectIds.has(project.id) || project.created_by === dashboard.user.id,
  );
  const projectIdsForData = projects.map((project) => project.id);
  const [
    documentResult,
    taskResult,
    milestoneResult,
    eventResult,
    notificationResult,
    paymentResult,
  ] = await Promise.all([
    getProjectDocuments(projectIdsForData),
    getProjectTasks(projectIdsForData),
    getProjectMilestones(projectIdsForData),
    getProjectEvents(projectIdsForData),
    getProjectNotifications(),
    getProjectPaymentData(projectIdsForData),
  ]);
  const organisationIds = new Set(
    memberRoles.map((membership) => membership.organisationId),
  );
  const projectIds = new Set(projects.map((project) => project.id));
  const organisations = dashboard.organisations.filter(
    (organisation) =>
      organisationIds.has(organisation.id) ||
      (organisation.project_id !== null &&
        projectIds.has(organisation.project_id)),
  );
  const canOpenOwnerPortal = roles.some(
    (membership) =>
      membership.role === "client" ||
      membership.role === "project_manager",
  ) || projects.some((project) => project.created_by === dashboard.user.id);
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
      title="Team member portal"
      navigation={{
        sections: [
          {
            id: "projects",
            label: "Projects",
            content: (
              <MemberPortal
                currentUserId={dashboard.user.id}
                documentStorageReady={documentResult.ready}
                documents={documentResult.documents}
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
            label: "My tasks",
            content: (
              <MemberPortal
                currentUserId={dashboard.user.id}
                documentStorageReady={documentResult.ready}
                documents={documentResult.documents}
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
          description="See your workload, check what is waiting for review, and open your project workspace."
          mode="member"
          tasks={taskResult.tasks}
          milestones={milestoneResult.milestones}
          financeSummary={financeSummary}
          title="Member dashboard"
        />
      }
      notifications={notificationResult}
      otherPortal={
        canOpenOwnerPortal
          ? { href: "/owner", label: "Owner portal" }
          : undefined
      }
    />
  );
}
