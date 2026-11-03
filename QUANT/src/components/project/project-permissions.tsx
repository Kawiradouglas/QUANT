export function ProjectPermissions({
  mode,
  role,
}: {
  mode: "owner" | "member";
  role?: "client" | "project_manager" | "member";
}) {
  const permissions = [
    {
      title: "Client",
      description:
        "Creates projects, appoints project managers, and can see and review tasks in both workflows. Can edit project settings, but the contract form is locked after project creation.",
    },
    {
      title: "Project manager",
      description:
        "Can access the owner portal, manage team roles, assign management tasks and member-delegated tasks, and review submissions. Cannot change the contract form or appoint another project manager.",
    },
    {
      title: "Project member",
      description:
        "Can delegate tasks to other project members, review delegated submissions, and submit or revise work assigned to them in the member portal.",
    },
  ];

  return (
    <section
      aria-labelledby="project-permissions-heading"
      className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm sm:p-6"
    >
      <p className="text-sm font-medium text-[var(--teal)]">
        {mode === "owner" ? "Access policy" : "Your access"}
      </p>
      <h2
        className="mt-1 text-lg font-semibold text-[var(--navy)]"
        id="project-permissions-heading"
      >
        {mode === "owner" ? "Project permissions" : "What you can access"}
      </h2>
      {mode === "member" && role && (
        <p className="mt-2 text-sm text-[var(--muted)]">
          Your project access level is{" "}
          <span className="font-semibold capitalize text-[var(--foreground)]">
            {role.replaceAll("_", " ")}
          </span>
          . Professional role describes your project discipline; it does not
          grant extra application permissions.
        </p>
      )}
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {permissions.map((permission) => (
          <li
            className="rounded-lg bg-slate-50 p-4"
            key={permission.title}
          >
            <h3 className="text-sm font-semibold text-[var(--navy)]">
              {permission.title}
            </h3>
            <p className="mt-1 text-sm leading-5 text-[var(--muted)]">
              {permission.description}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
