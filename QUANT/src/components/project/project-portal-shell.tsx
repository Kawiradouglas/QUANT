import { signOutAction } from "@/app/auth/actions";
import { ProjectNotificationCenter } from "@/components/project/project-notification-center";
import { ProjectPortalNavigation } from "@/components/project/project-portal-navigation";
import type { ProjectNotification } from "@/lib/project-milestone-types";

export function ProjectPortalShell({
  email,
  title,
  otherPortal,
  navigation,
  notifications,
  children,
  dashboard,
}: {
  email: string;
  title: string;
  otherPortal?: { href: "/owner" | "/member"; label: string };
  navigation?: {
    sections: { id: string; label: string; content: React.ReactNode }[];
    projectShortcuts: { id: string; label: string }[];
  };
  notifications?: { ready: boolean; notifications: ProjectNotification[] };
  dashboard?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <a className="inline-flex items-center gap-3" href="/home">
            <span className="grid size-9 place-items-center rounded-lg bg-[var(--navy)] text-xs font-bold tracking-wide text-white">
              CP
            </span>
            <span className="font-semibold tracking-tight text-[var(--navy)]">
              Project Workspace
            </span>
            <span className="hidden border-l border-[var(--border)] pl-3 text-sm text-[var(--muted)] sm:inline">
              {title}
            </span>
          </a>
          <div className="flex items-center gap-3">
            {notifications && (
              <ProjectNotificationCenter
                notifications={notifications.notifications}
                ready={notifications.ready}
              />
            )}
            {otherPortal && (
              <a
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-slate-50"
                href={otherPortal.href}
              >
                {otherPortal.label}
              </a>
            )}
            <span className="hidden max-w-56 truncate text-sm text-[var(--muted)] sm:inline">
              {email}
            </span>
            <form action={signOutAction}>
              <button
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-slate-50"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8 sm:py-8">
        {navigation && dashboard ? (
          <ProjectPortalNavigation
            dashboard={dashboard}
            projectShortcuts={navigation.projectShortcuts}
            sections={navigation.sections}
            title={title}
          />
        ) : (
          children
        )}
      </div>
    </main>
  );
}
