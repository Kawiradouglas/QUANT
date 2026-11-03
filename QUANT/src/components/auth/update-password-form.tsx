"use client";

import { useActionState } from "react";
import { updatePasswordAction } from "@/app/auth/actions";
import { AuthFeedback } from "@/components/auth/auth-feedback";
import { AuthField } from "@/components/auth/auth-fields";
import { SubmitButton } from "@/components/auth/submit-button";

export function UpdatePasswordForm({
  next = "/home",
  inviteEmail,
  organisationId,
}: {
  next?: string;
  inviteEmail?: string;
  organisationId?: string;
}) {
  const [state, formAction] = useActionState(updatePasswordAction, {});

  return (
    <form action={formAction} className="space-y-5">
      <input name="next" type="hidden" value={next} />
      {inviteEmail && (
        <input name="inviteEmail" type="hidden" value={inviteEmail} />
      )}
      {organisationId && (
        <input name="organisationId" type="hidden" value={organisationId} />
      )}
      <AuthFeedback state={state} />
      <AuthField
        autoComplete="new-password"
        label="New password"
        minLength={8}
        name="password"
        required
        type="password"
      />
      <AuthField
        autoComplete="new-password"
        label="Confirm new password"
        minLength={8}
        name="confirmPassword"
        required
        type="password"
      />
      <SubmitButton
        label={next === "/member" ? "Set password and continue" : "Update password"}
      />
    </form>
  );
}
