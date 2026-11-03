"use client";

import { useActionState } from "react";
import { requestPasswordResetAction } from "@/app/auth/actions";
import { AuthFeedback } from "@/components/auth/auth-feedback";
import { AuthField } from "@/components/auth/auth-fields";
import { SubmitButton } from "@/components/auth/submit-button";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, {});

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
      <SubmitButton label="Send recovery instructions" />
    </form>
  );
}
