import Link from "next/link";
import { connection } from "next/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  await connection();
  const params = await searchParams;
  const callbackFailed = params.error === "callback_failed";
  const invitationCallbackFailed =
    params.error === "invite_callback_failed";

  return (
    <AuthShell
      description="Sign in to continue to your project workspace."
      footer={
        <p>
          New to the workspace?{" "}
          <Link
            className="font-semibold text-[var(--teal)] hover:underline"
            href="/register"
          >
            Create an account
          </Link>
        </p>
      }
      heading="Welcome back"
    >
      {!isSupabaseConfigured() && (
        <p
          className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm leading-5 text-amber-900"
          role="status"
        >
          Authentication is not connected yet. Sign-in attempts will report a
          configuration error until local Supabase settings are added.
        </p>
      )}
      {callbackFailed && (
        <p
          className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-5 text-red-800"
          role="alert"
        >
          The email verification or recovery link could not be completed.
          Request a new link or try signing in again.
        </p>
      )}
      {invitationCallbackFailed && (
        <p
          className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-5 text-red-800"
          role="alert"
        >
          This invitation link could not be completed. In Supabase, set the
          Invite user email template link to use{" "}
          <code className="break-all">
            {"{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite"}
          </code>
          , and allow your app callback URL in Authentication URL Configuration.
          Ask the project owner to send a new invitation link.
        </p>
      )}
      <LoginForm />
    </AuthShell>
  );
}
