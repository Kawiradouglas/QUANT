"use client";

import type { ProjectTask } from "@/lib/project-task-types";
import type { ProjectMilestone } from "@/lib/project-milestone-types";
import type { ProjectFinanceSummary } from "@/lib/project-payment-types";
import { usePortalNavigation } from "@/components/project/project-portal-navigation";

type Metric = {
  label: string;
  detail: string;
  value: number;
  total: number;
  tone: "teal" | "blue" | "amber" | "violet";
  destination: "projects" | "tasks" | "milestones";
};

const toneClasses = {
  teal: { stroke: "#0f8b83", glow: "rgba(15,139,131,.17)" },
  blue: { stroke: "#3d72ce", glow: "rgba(61,114,206,.15)" },
  amber: { stroke: "#e1a12b", glow: "rgba(225,161,43,.17)" },
  violet: { stroke: "#8764ce", glow: "rgba(135,100,206,.15)" },
};

export function ProjectPortalDashboard({
  mode,
  tasks,
  milestones = [],
  financeSummary = [],
  currentUserId,
  title,
  description,
}: {
  mode: "owner" | "member";
  tasks: ProjectTask[];
  milestones?: ProjectMilestone[];
  financeSummary?: ProjectFinanceSummary[];
  currentUserId: string;
  title: string;
  description: string;
}) {
  const navigation = usePortalNavigation();
  const assignedTasks =
    mode === "member"
      ? tasks.filter((task) => task.assignee_user_id === currentUserId)
      : tasks;
  const delegatedTasks =
    mode === "member"
      ? tasks.filter((task) => task.assigned_by === currentUserId)
      : tasks;
  const completedTasks = assignedTasks.filter(
    (task) => task.status === "completed",
  ).length;
  const openTasks = assignedTasks.filter(
    (task) => task.status !== "completed",
  ).length;
  const awaitingReview = (
    mode === "member" ? delegatedTasks : tasks
  ).filter((task) => task.status === "submitted").length;
  const reviewQueue = mode === "member" ? delegatedTasks : tasks;
  const totalMilestoneProgress = milestones.reduce(
    (total, milestone) => total + milestone.progress_percent,
    0,
  );
  const milestoneCompletion =
    milestones.length > 0
      ? Math.round(totalMilestoneProgress / milestones.length)
      : 0;
  const completedMilestones = milestones.filter(
    (milestone) => milestone.status === "completed",
  ).length;
  const metrics: Metric[] = [
    {
      label: mode === "owner" ? "Task completion" : "My work completed",
      detail: `${completedTasks} of ${assignedTasks.length} assigned`,
      value: completedTasks,
      total: assignedTasks.length,
      tone: "teal",
      destination: "tasks",
    },
    {
      label: mode === "owner" ? "Open tasks" : "My pending tasks",
      detail: `${openTasks} task${openTasks === 1 ? "" : "s"} still active`,
      value: openTasks,
      total: assignedTasks.length,
      tone: "blue",
      destination: "tasks",
    },
    {
      label: "Awaiting review",
      detail: `${awaitingReview} submission${awaitingReview === 1 ? "" : "s"} to review`,
      value: awaitingReview,
      total: reviewQueue.length,
      tone: "amber",
      destination: "tasks",
    },
    {
      label: "Milestone progress",
      detail:
        milestones.length > 0
          ? `${completedMilestones} of ${milestones.length} milestones complete`
          : "No milestones planned yet",
      value: milestoneCompletion,
      total: 100,
      tone: "violet",
      destination: "milestones",
    },
  ];

  return (
    <section
      aria-labelledby="dashboard-heading"
      className="space-y-7"
      id="dashboard"
    >
      <header className="relative overflow-hidden rounded-[1.75rem] bg-[linear-gradient(120deg,#102b3c_0%,#174b58_56%,#167c79_100%)] px-6 py-8 text-white shadow-[0_24px_70px_-35px_rgba(16,43,60,.75)] sm:px-9 sm:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-32 size-80 rounded-full border border-white/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-1 -top-20 size-56 rounded-full border border-white/10"
        />
        <p className="text-sm font-semibold tracking-wide text-teal-200">
          {mode === "owner" ? "PROJECT CONTROL CENTER" : "YOUR WORKSPACE"}
        </p>
        <h1
          className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
          id="dashboard-heading"
        >
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">
          {description}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[var(--navy)] transition hover:bg-teal-50"
            onClick={() => navigation?.navigate("tasks")}
            type="button"
          >
            View task board
          </button>
          <button
            className="rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
            onClick={() => navigation?.navigate("projects")}
            type="button"
          >
            Browse projects
          </button>
        </div>
      </header>

      <div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--teal)]">
              At a glance
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--navy)]">
              Workspace performance
            </h2>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Based on current project tasks and milestones
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {metrics.map((metric, index) => (
            <button
              className="group flex min-h-48 items-center gap-4 rounded-2xl border border-white bg-white p-5 text-left shadow-[0_12px_36px_-23px_rgba(16,43,60,.4)] transition duration-200 hover:-translate-y-1 hover:border-slate-200 hover:shadow-[0_20px_44px_-24px_rgba(16,43,60,.4)] focus-visible:outline-offset-4"
              key={metric.label}
              onClick={() => navigation?.navigate(metric.destination)}
              type="button"
            >
              <ProgressRing metric={metric} delay={index * 100} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-5 text-[var(--navy)]">
                  {metric.label}
                </span>
                <span className="mt-2 block text-xs leading-5 text-[var(--muted)]">
                  {metric.detail}
                </span>
                <span className="mt-3 inline-block text-xs font-semibold text-[var(--teal-dark)] opacity-80 transition group-hover:opacity-100">
                  View details <span aria-hidden="true">→</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {financeSummary.length > 0 && (
        <section
          aria-labelledby="contract-payments-heading"
          className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--teal)]">
                Financial dashboard
              </p>
              <h2
                className="mt-1 text-xl font-semibold text-[var(--navy)]"
                id="contract-payments-heading"
              >
                Contract amount paid
              </h2>
            </div>
            <button
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-slate-50"
              onClick={() => navigation?.navigate("financing")}
              type="button"
            >
              Open financing
            </button>
          </div>
          <ul className="space-y-4">
            {financeSummary.map((summary) => {
              const percentPaid =
                summary.contract_amount > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (summary.paid_amount / summary.contract_amount) * 100,
                      ),
                    )
                  : 0;
              const formatMoney = (value: number) =>
                new Intl.NumberFormat(undefined, {
                  style: "currency",
                  currency: summary.currency_code,
                }).format(value);
              return (
                <li
                  className="rounded-xl border border-[var(--border)] p-4"
                  key={summary.project_id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-[var(--navy)]">
                      {summary.project_name}
                    </p>
                    <p className="text-sm font-bold text-[var(--teal-dark)]">
                      {percentPaid}% paid
                    </p>
                  </div>
                  <div
                    aria-label={`${percentPaid}% of contract paid`}
                    className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"
                    role="img"
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-[width]"
                      style={{ width: `${percentPaid}%` }}
                    />
                  </div>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                    <p>
                      Contract:{" "}
                      <strong>{formatMoney(summary.contract_amount)}</strong>
                    </p>
                    <p>
                      Paid: <strong>{formatMoney(summary.paid_amount)}</strong>
                    </p>
                    <p>
                      Balance:{" "}
                      <strong>
                        {formatMoney(
                          Math.max(
                            0,
                            summary.contract_amount - summary.paid_amount,
                          ),
                        )}
                      </strong>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--teal)]">
              Quick access
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--navy)]">
              Pick up where you left off
            </h2>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-slate-50"
              onClick={() => navigation?.navigate("projects")}
              type="button"
            >
              Projects
            </button>
            <button
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-slate-50"
              onClick={() => navigation?.navigate("tasks")}
              type="button"
            >
              Tasks
            </button>
            <button
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-slate-50"
              onClick={() => navigation?.navigate("milestones")}
              type="button"
            >
              Milestones
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}

function ProgressRing({ metric, delay }: { metric: Metric; delay: number }) {
  const radius = 37;
  const circumference = 2 * Math.PI * radius;
  const percent =
    metric.total > 0
      ? Math.min(100, Math.round((metric.value / metric.total) * 100))
      : 0;
  const colors = toneClasses[metric.tone];

  return (
    <span
      aria-label={`${metric.label}: ${percent}%`}
      className="relative grid size-[5.5rem] shrink-0 place-items-center rounded-full"
      role="img"
      style={{ backgroundColor: colors.glow }}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full -rotate-90"
        viewBox="0 0 100 100"
      >
        <circle
          cx="50"
          cy="50"
          fill="none"
          r={radius}
          stroke="rgba(148,163,184,.2)"
          strokeWidth="7"
        />
        <circle
          className="progress-ring__arc"
          cx="50"
          cy="50"
          fill="none"
          r={radius}
          stroke={colors.stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          strokeLinecap="round"
          strokeWidth="7"
          style={{ animationDelay: `${delay}ms` }}
        />
      </svg>
      <span className="text-lg font-bold tracking-tight text-[var(--navy)]">
        {percent}%
      </span>
    </span>
  );
}
