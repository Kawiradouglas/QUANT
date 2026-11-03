import type { InputHTMLAttributes } from "react";

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function AuthField({ label, id, ...props }: AuthFieldProps) {
  const fieldId = id ?? props.name;

  return (
    <div className="space-y-2">
      {label && (
        <label
          className="block text-sm font-medium text-[var(--foreground)]"
          htmlFor={fieldId}
        >
          {label}
        </label>
      )}
      <input
        className="h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3.5 text-sm text-[var(--foreground)] shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[var(--teal)] focus:ring-4 focus:ring-teal-700/10 disabled:cursor-not-allowed disabled:opacity-60"
        id={fieldId}
        {...props}
      />
    </div>
  );
}
