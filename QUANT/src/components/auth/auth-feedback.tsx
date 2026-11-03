"use client";

import type { AuthActionState } from "@/app/auth/actions";

export function AuthFeedback({ state }: { state: AuthActionState }) {
  if (!state.error && !state.message) return null;

  const isError = Boolean(state.error);
  const text = state.error ?? state.message;

  return (
    <p
      aria-live="polite"
      className={`rounded-lg border px-3 py-2.5 text-sm leading-5 ${
        isError
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
      role={isError ? "alert" : "status"}
    >
      {text}
    </p>
  );
}
