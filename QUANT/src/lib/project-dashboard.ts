import { redirect } from "next/navigation";
import { connection } from "next/server";
import type {
  OrganisationMember,
  Project,
  ProjectOrganisation,
} from "@/components/project/project-workspace";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProjectAccessRole } from "@/lib/project-roles";

type MemberRole = ProjectAccessRole;
type MembershipStatus = "active" | "invited";

export type ProjectDashboardData = {
  user: {
    id: string;
    email?: string;
  };
  projects: Project[];
  organisations: ProjectOrganisation[];
};

export type ProjectDashboardResult =
  | { setupRequired: true; user: ProjectDashboardData["user"] }
  | ({ setupRequired: false } & ProjectDashboardData);

function isProjectSchemaMissing(error: { code?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "42883" ||
    error.code === "PGRST204" ||
    error.code === "PGRST202" ||
    error.code === "PGRST205"
  );
}

function isMemberRole(role: string): role is MemberRole {
  return role === "client" || role === "project_manager" || role === "member";
}

function isMembershipStatus(status: string): status is MembershipStatus {
  return status === "active" || status === "invited";
}

export async function getProjectDashboardData(): Promise<ProjectDashboardResult> {
  if (!isSupabaseConfigured()) redirect("/login");

  await connection();
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError?.name === "AuthSessionMissingError") redirect("/login");
  if (authError) throw new Error(`Unable to load account: ${authError.message}`);
  if (!authData.user) redirect("/login");

  const user = { id: authData.user.id, email: authData.user.email };
  const { error: activationError } = await supabase.rpc(
    "activate_organisation_memberships",
  );
  if (activationError) {
    if (isProjectSchemaMissing(activationError)) {
      return { setupRequired: true, user };
    }
    throw new Error(
      `Unable to activate organisation invitations: ${activationError.message}`,
    );
  }

  const { data: projectRows, error: projectsError } = await supabase
    .from("projects")
    .select("id, name, contract_type, delivery_mode, created_by")
    .order("created_at", { ascending: false });

  if (projectsError) {
    if (isProjectSchemaMissing(projectsError)) {
      return { setupRequired: true, user };
    }
    throw new Error(`Unable to load projects: ${projectsError.message}`);
  }

  const { data: organisationRows, error: organisationError } = await supabase
    .from("organisations")
    .select("id, name, project_id");
  if (organisationError) {
    if (isProjectSchemaMissing(organisationError)) {
      return { setupRequired: true, user };
    }
    throw new Error(
      `Unable to load organisations: ${organisationError.message}`,
    );
  }

  const { data: memberRows, error: membersError } = await supabase
    .from("organisation_members")
    .select(
      "organisation_id, user_id, email, role, project_access_role, professional_role, status",
    )
    .order("created_at", { ascending: true });

  if (membersError) {
    if (isProjectSchemaMissing(membersError)) {
      return { setupRequired: true, user };
    }
    throw new Error(
      `Unable to load organisation members: ${membersError.message}`,
    );
  }

  const projectById = new Map(projectRows.map((project) => [project.id, project]));
  const projectOrganisationById = new Map(
    organisationRows.map((organisation) => [organisation.id, organisation]),
  );
  const membersByOrganisation = new Map<string, OrganisationMember[]>();
  for (const member of memberRows) {
    const organisation = projectOrganisationById.get(member.organisation_id);
    const project = organisation?.project_id
      ? projectById.get(organisation.project_id)
      : undefined;
    const accessRole =
      project?.created_by === member.user_id
        ? "client"
        : member.project_access_role;
    if (!isMemberRole(accessRole) || !isMembershipStatus(member.status)) {
      throw new Error("An organisation has an unsupported membership state.");
    }
    const members = membersByOrganisation.get(member.organisation_id) ?? [];
    members.push({
      organisation_id: member.organisation_id,
      user_id: member.user_id,
      email: member.email,
      role: accessRole,
      professional_role: member.professional_role,
      status: member.status,
    });
    membersByOrganisation.set(member.organisation_id, members);
  }

  const organisations: ProjectOrganisation[] = organisationRows.map(
    (organisation) => ({
      ...organisation,
      members: membersByOrganisation.get(organisation.id) ?? [],
    }),
  );

  return {
    setupRequired: false,
    user,
    projects: projectRows,
    organisations,
  };
}

export function getUserOrganisationRoles(
  userId: string,
  organisations: ProjectOrganisation[],
  projects: Project[],
) {
  return organisations.flatMap((organisation) =>
    organisation.members
      .filter(
        (member) => member.user_id === userId && member.status === "active",
      )
      .map((member) => ({
        organisationId: organisation.id,
        projectId: organisation.project_id,
        role:
          projects.some(
            (project) =>
              project.id === organisation.project_id &&
              project.created_by === userId,
          )
            ? "client"
            : member.role,
      })),
  );
}
