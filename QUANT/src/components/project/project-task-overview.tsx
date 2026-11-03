import type { ProjectTask } from "@/lib/project-task-types";

type OverviewProject = {
  id: string;
  name: string;
};

export function ProjectTaskOverview({
  projects,
  tasks,
}: {
  projects: OverviewProject[];
  tasks: ProjectTask[];
}) {
  return (
    <section
      aria-labelledby="task-overview-heading"
      className="mb-8 scroll-mt-6 rounded-xl border border-[var(--border)] bg-white p-5 shadow-sm sm:p-6"
      id="tasks"
    >
      <div className="mb-4">
        <p className="text-sm font-medium text-[var(--teal)]">Work queue</p>
        <h2
          className="mt-1 text-xl font-semibold text-[var(--navy)]"
          id="task-overview-heading"
        >
          Tasks
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Review task status and open a project to submit or review work.
        </p>
      </div>
      {projects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
          Tasks will appear here when you have project work.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {projects.map((project) => {
            const projectTasks = tasks.filter(
              (task) => task.project_id === project.id,
            );
            const openTasks = projectTasks.filter(
              (task) => task.status !== "completed",
            ).length;
            const reviewTasks = projectTasks.filter(
              (task) => task.status === "submitted",
            ).length;

            return (
              <li
                className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-1 last:pb-1"
                key={project.id}
              >
                <div>
                  <p className="font-medium text-[var(--navy)]">
                    {project.name}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {projectTasks.length}{" "}
                    {projectTasks.length === 1 ? "task" : "tasks"} · {openTasks}{" "}
                    open · {reviewTasks} awaiting review
                  </p>
                </div>
                <a
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-slate-50"
                  href={`#project-tasks-${project.id}`}
                >
                  View project tasks
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
