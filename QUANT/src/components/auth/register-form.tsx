"use client";

import { useActionState } from "react";
import { signUpAction } from "@/app/auth/actions";
import { AuthFeedback } from "@/components/auth/auth-feedback";
import { AuthField } from "@/components/auth/auth-fields";
import { SubmitButton } from "@/components/auth/submit-button";

export function RegisterForm() {
  const [state, formAction] = useActionState(signUpAction, {});

  return (
    <form action={formAction} className="space-y-5">
      <AuthFeedback state={state} />
      <AuthField
        autoComplete="email"
        label="Email address"
        name="email"
        placeholder="you@organisation.com"
        required
        type="email"
      />
      <AuthField
        autoComplete="new-password"
        label="Password"
        minLength={8}
        name="password"
        required
        type="password"
      />
      <p className="-mt-3 text-xs leading-5 text-[var(--muted)]">
        Use at least 8 characters. Your account does not automatically grant
        access to an organisation or project.
      </p>
      <SubmitButton label="Create account" />
    </form>
  );
}
