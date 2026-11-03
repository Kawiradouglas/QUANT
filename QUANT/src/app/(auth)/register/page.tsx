import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function RegisterPage() {
  return (
    <AuthShell
      description="Create your account. Organisation and project access are assigned separately."
      footer={
        <p>
          Already have an account?{" "}
          <Link
            className="font-semibold text-[var(--teal)] hover:underline"
            href="/login"
          >
            Sign in
          </Link>
        </p>
      }
      heading="Create your account"
    >
      {!isSupabaseConfigured() && (
        <p
          className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm leading-5 text-amber-900"
          role="status"
        >
          Authentication is not connected yet. Registration will report a
          configuration error until local Supabase settings are added.
        </p>
      )}
      <RegisterForm />
    </AuthShell>
  );
}
