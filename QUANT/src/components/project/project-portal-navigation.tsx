"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type PortalSection = {
  id: string;
  label: string;
  content: ReactNode;
};

type ProjectShortcut = {
  id: string;
  label: string;
};

type ProjectPortalNavigationProps = {
  title: string;
  dashboard: ReactNode;
  sections: PortalSection[];
  projectShortcuts: ProjectShortcut[];
};

type PortalNavigationContextValue = {
  navigate: (section: string) => void;
  activeProjectId: string | null;
  openProject: (projectId: string) => void;
  backToProjects: () => void;
};

const PortalNavigationContext =
  createContext<PortalNavigationContextValue | null>(null);

export function usePortalNavigation() {
  return useContext(PortalNavigationContext);
}

export function ProjectPortalNavigation({
  title,
  dashboard,
  sections,
  projectShortcuts,
}: ProjectPortalNavigationProps) {
  const [activeSection, setActiveSection] = useState("home");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(true);
  const navigate = useCallback((section: string) => {
    setActiveSection(section);
    setActiveProjectId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const navigateToProject = useCallback((projectId: string) => {
    setActiveSection("projects");
    setActiveProjectId(projectId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const backToProjects = useCallback(() => {
    setActiveProjectId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const activeContent =
    activeSection === "home"
      ? dashboard
      : sections.find((section) => section.id === activeSection)?.content ??
        dashboard;

  return (
    <PortalNavigationContext.Provider
      value={{
        navigate,
        activeProjectId,
        openProject: navigateToProject,
        backToProjects,
      }}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--muted)]">
          {activeSection === "home"
            ? "Home"
            : sections.find((section) => section.id === activeSection)?.label ??
              "Projects"}
        </p>
        <button
          aria-expanded={menuOpen}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--navy)] shadow-sm transition hover:border-[var(--teal)] hover:text-[var(--teal-dark)]"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          <span aria-hidden="true">☰</span>
          {menuOpen ? "Hide menu" : "Show menu"}
        </button>
      </div>

      <div
        className={
          menuOpen
            ? "grid grid-cols-1 items-start gap-6 lg:grid-cols-[230px_minmax(0,1fr)]"
            : "grid grid-cols-1"
        }
      >
        {menuOpen && (
          <aside className="self-start lg:sticky lg:top-6">
            <nav
              aria-label={`${title} navigation`}
              className="rounded-2xl border border-white/80 bg-white/90 p-3 shadow-[0_12px_36px_-20px_rgba(16,43,60,0.35)] backdrop-blur"
            >
              <p className="px-3 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Workspace
              </p>
              <ul className="grid grid-cols-3 gap-1 lg:grid-cols-1">
                <li>
                  <NavigationButton
                    active={activeSection === "home"}
                    label="Home"
                    onClick={() => navigate("home")}
                  />
                </li>
                {sections.map((section) => (
                  <li key={section.id}>
                    <NavigationButton
                      active={activeSection === section.id}
                      label={section.label}
                      onClick={() => navigate(section.id)}
                    />
                  </li>
                ))}
              </ul>

              {projectShortcuts.length > 0 &&
                activeSection === "projects" &&
                activeProjectId === null && (
                <>
                  <p className="mt-4 border-t border-slate-100 px-3 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Projects
                  </p>
                  <ul className="max-h-[45vh] space-y-1 overflow-y-auto">
                    {projectShortcuts.map((project) => (
                      <li key={project.id}>
                        <button
                          className="w-full truncate rounded-xl px-3 py-2.5 text-left text-sm text-slate-600 transition hover:bg-teal-50 hover:text-[var(--teal-dark)]"
                          onClick={() => navigateToProject(project.id)}
                          title={project.label}
                          type="button"
                        >
                          <span aria-hidden="true" className="mr-2 text-teal-600">
                            ↗
                          </span>
                          {project.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </nav>
          </aside>
        )}
        <div className="min-w-0">{activeContent}</div>
      </div>
    </PortalNavigationContext.Provider>
  );
}

function NavigationButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "flex w-full items-center gap-3 rounded-xl bg-[var(--navy)] px-3 py-3 text-left text-sm font-semibold text-white shadow-md shadow-slate-900/10 transition"
          : "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-600 transition hover:bg-teal-50 hover:text-[var(--teal-dark)]"
      }
      onClick={onClick}
      type="button"
    >
      <span
        aria-hidden="true"
        className={
          active
            ? "size-2 rounded-full bg-teal-300"
            : "size-2 rounded-full bg-slate-300"
        }
      />
      {label}
    </button>
  );
}
