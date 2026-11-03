export function ProjectDatabaseSetupNotice() {
  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50 p-6 sm:p-8">
      <p className="text-sm font-semibold text-amber-900">
        One-time database setup
      </p>
      <h2 className="mt-2 text-xl font-semibold text-[var(--navy)]">
        Apply the Supabase migrations
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-950">
        In your Supabase project, open SQL Editor and run the migrations in
        order. If the earlier migrations already succeeded, run only the
        latest missing migration. Do not rerun migrations that already
        succeeded:{" "}
        <code className="rounded bg-amber-100 px-1.5 py-0.5">
          supabase/migrations/20261101100000_organisations_and_memberships.sql
        </code>
        {" then "}
        <code className="rounded bg-amber-100 px-1.5 py-0.5">
          supabase/migrations/20261101120000_projects_and_email_invitations.sql
        </code>
        {" then "}
        <code className="rounded bg-amber-100 px-1.5 py-0.5">
          supabase/migrations/20261101130000_fix_membership_role_checks.sql
        </code>
        . Reload this page when all migrations have succeeded.
      </p>
    </section>
  );
}
