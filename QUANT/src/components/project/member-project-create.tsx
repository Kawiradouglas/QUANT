"use client";

import { useState } from "react";
import { ProjectCreateForm } from "@/components/project/project-create-form";

export function MemberProjectCreate() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--teal)]">
            Start a project
          </p>
          <h3 className="mt-1 text-lg font-semibold text-[var(--navy)]">
            Create a new project
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            You will be the project owner and can set up its team.
          </p>
        </div>
        <button
          aria-controls="member-create-project-form"
          aria-expanded={isOpen}
          className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--teal-dark)]"
          onClick={() => setIsOpen((open) => !open)}
          type="button"
        >
          {isOpen ? "Cancel" : "+ Create project"}
        </button>
      </div>
      {isOpen && (
        <div
          className="mt-5 border-t border-slate-100 pt-5"
          id="member-create-project-form"
        >
          <ProjectCreateForm />
        </div>
      )}
    </section>
  );
}
