import { redirect } from "next/navigation";
import {
  getProjectDashboardData,
  getUserOrganisationRoles,
} from "@/lib/project-dashboard";

export default async function HomePage() {
  const dashboard = await getProjectDashboardData();
  if (dashboard.setupRequired) redirect("/owner");

  const roles = getUserOrganisationRoles(
    dashboard.user.id,
    dashboard.organisations,
    dashboard.projects,
  );

  if (
    roles.some(
      (membership) =>
        membership.role === "client" ||
        membership.role === "project_manager",
    )
  ) {
    redirect("/owner");
  }
  if (roles.length > 0) redirect("/member");
  redirect("/owner");
}
