export const projectAccessRoles = ["member", "project_manager"] as const;
export type ProjectAccessRole = "client" | (typeof projectAccessRoles)[number];

export const professionalRoleOptions = [
  "Engineer",
  "Architect",
  "Contractor",
  "Quantity Surveyor (Contractor)",
  "Quantity Surveyor (Consultant)",
  "Other",
] as const;

export function resolveProfessionalRole(
  selection: string,
  other: string,
) {
  const role = selection === "Other" ? other.trim() : selection;
  if (
    !professionalRoleOptions.some((option) => option === selection) ||
    role.length < 2 ||
    role.length > 80
  ) {
    return null;
  }
  return role;
}
