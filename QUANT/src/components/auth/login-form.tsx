"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction } from "@/app/auth/actions";
import { AuthFeedback } from "@/components/auth/auth-feedback";
import { AuthField } from "@/components/auth/auth-fields";
import { SubmitButton } from "@/components/auth/submit-button";

export function LoginForm() {
  const [state, formAction] = useActionState(signInAction, {});

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
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label
            className="block text-sm font-medium text-[var(--foreground)]"
            htmlFor="password"
          >
            Password
          </label>
          <Link
            className="text-sm font-medium text-[var(--teal)] hover:underline"
            href="/forgot-password"
          >
            Forgot password?
          </Link>
        </div>
        <AuthField
          autoComplete="current-password"
          id="password"
          name="password"
          required
          type="password"
        />
      </div>
      <SubmitButton label="Sign in" />
    </form>
  );
}
