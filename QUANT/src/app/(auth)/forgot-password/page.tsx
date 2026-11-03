import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      description="Enter the email address associated with your account."
      footer={
        <Link
          className="font-semibold text-[var(--teal)] hover:underline"
          href="/login"
        >
          Return to sign in
        </Link>
      }
      heading="Reset your password"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
