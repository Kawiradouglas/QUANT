import Link from "next/link";

type AuthShellProps = {
  children: React.ReactNode;
  description: string;
  heading: string;
  footer: React.ReactNode;
};

export function AuthShell({
  children,
  description,
  heading,
  footer,
}: AuthShellProps) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
      <section className="relative hidden overflow-hidden bg-[var(--navy)] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div className="absolute -right-36 -top-32 h-[440px] w-[440px] rounded-full border border-white/10" />
        <div className="absolute -right-20 -top-16 h-[310px] w-[310px] rounded-full border border-white/10" />
        <div className="relative">
          <Link className="inline-flex items-center gap-3" href="/login">
            <span className="grid size-10 place-items-center rounded-xl bg-teal-500 text-sm font-bold tracking-wide text-white">
              CP
            </span>
            <span className="text-lg font-semibold tracking-tight">
              Project Workspace
            </span>
          </Link>
        </div>
        <div className="relative max-w-xl pb-16">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">
            Project administration
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            Clear records. Better coordinated projects.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-300">
            A shared workspace for construction teams to organise project
            information, responsibilities, and decisions.
          </p>
        </div>
        <p className="relative text-xs text-slate-400">
          Built for project teams working together.
        </p>
      </section>

      <section className="flex min-h-screen flex-col bg-[var(--background)] px-5 py-7 sm:px-10 lg:px-14">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <Link
            className="mb-10 inline-flex w-fit items-center gap-3 lg:hidden"
            href="/login"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-[var(--navy)] text-sm font-bold tracking-wide text-white">
              CP
            </span>
            <span className="text-lg font-semibold tracking-tight">
              Project Workspace
            </span>
          </Link>
          <p className="text-sm font-medium text-[var(--teal)]">
            Construction project workspace
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--navy)]">
            {heading}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            {description}
          </p>
          <div className="mt-8">{children}</div>
          <div className="mt-7 border-t border-[var(--border)] pt-6 text-sm text-[var(--muted)]">
            {footer}
          </div>
        </div>
        <p className="text-center text-xs text-[var(--muted)]">
          Early development stage · Account features require configured access
        </p>
      </section>
    </main>
  );
}
