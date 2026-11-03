"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  label,
  name,
  value,
  disabled = false,
}: {
  label: string;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[var(--teal)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--teal-dark)] focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-70"
      disabled={pending || disabled}
      name={name}
      type="submit"
      value={value}
    >
      {pending ? "Please wait…" : label}
    </button>
  );
}
