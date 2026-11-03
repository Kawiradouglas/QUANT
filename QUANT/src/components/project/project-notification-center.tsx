import {
  markAllProjectNotificationsReadAction,
  markProjectNotificationReadAction,
} from "@/app/project-progress/actions";
import type { ProjectNotification } from "@/lib/project-milestone-types";

export function ProjectNotificationCenter({
  ready,
  notifications,
}: {
  ready: boolean;
  notifications: ProjectNotification[];
}) {
  const unreadCount = notifications.filter(
    (notification) => notification.read_at === null,
  ).length;

  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true">♢</span>
        Notifications
        {unreadCount > 0 && (
          <span className="grid min-w-5 place-items-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </summary>
      <div className="absolute right-0 z-30 mt-2 max-h-[70vh] w-[min(24rem,calc(100vw-2.5rem))] overflow-y-auto rounded-xl border border-[var(--border)] bg-white p-3 shadow-xl">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
          <h2 className="font-semibold text-[var(--navy)]">
            Workspace activity
          </h2>
          {unreadCount > 0 && (
            <form action={markAllProjectNotificationsReadAction}>
              <button
                className="text-xs font-semibold text-[var(--teal-dark)] underline underline-offset-2"
                type="submit"
              >
                Mark all read
              </button>
            </form>
          )}
        </div>
        {!ready ? (
          <p className="py-4 text-sm leading-5 text-amber-900">
            Notifications are not set up yet. Apply the project milestones,
            activity, and events migration in Supabase.
          </p>
        ) : notifications.length === 0 ? (
          <p className="py-5 text-center text-sm text-[var(--muted)]">
            You&apos;re all caught up. New project activity will show here.
          </p>
        ) : (
          <ol className="divide-y divide-[var(--border)]">
            {notifications.map((notification) => (
              <li
                className={
                  notification.read_at
                    ? "py-3"
                    : "py-3"
                }
                key={notification.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--navy)]">
                      {!notification.read_at && (
                        <span
                          aria-label="Unread"
                          className="mr-1.5 inline-block size-2 rounded-full bg-teal-600"
                        />
                      )}
                      {notification.title}
                    </p>
                    {notification.message && (
                      <p className="mt-1 text-sm leading-5 text-[var(--muted)]">
                        {notification.message}
                      </p>
                    )}
                    <time
                      className="mt-1 block text-xs text-slate-400"
                      dateTime={notification.created_at}
                    >
                      {new Date(notification.created_at).toLocaleString()}
                    </time>
                  </div>
                  {!notification.read_at && (
                    <form action={markProjectNotificationReadAction}>
                      <input
                        name="notificationId"
                        type="hidden"
                        value={notification.id}
                      />
                      <button
                        aria-label={`Mark ${notification.title} as read`}
                        className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-[var(--teal-dark)] hover:bg-teal-50"
                        type="submit"
                      >
                        Read
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}
