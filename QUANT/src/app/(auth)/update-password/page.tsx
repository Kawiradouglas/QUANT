import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function UpdatePasswordPage({
  searchParams,
}: PageProps<"/update-password">) {
  if (!isSupabaseConfigured()) redirect("/login");

  await connection();
  const params = await searchParams;
  const nextValue = Array.isArray(params.next) ? params.next[0] : params.next;
  const inviteEmail = Array.isArray(params.invite_email)
    ? params.invite_email[0]
    : params.invite_email;
  const organisationId = Array.isArray(params.organisation_id)
    ? params.organisation_id[0]
    : params.organisation_id;
  const next = nextValue === "/member" ? "/member" : "/home";
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error?.name === "AuthSessionMissingError") redirect("/login");
  if (error) throw new Error(`Unable to verify recovery session: ${error.message}`);
  if (!data.user) redirect("/login");
  if (
    next === "/member" &&
    (!inviteEmail ||
      !organisationId ||
      data.user.email?.toLowerCase() !== inviteEmail.toLowerCase())
  ) {
    redirect("/login?error=invite_session_mismatch");
  }

  return (
    <AuthShell
      description={
        next === "/member"
          ? "Set a password for your account, then continue to your team member portal."
          : "Choose a new password for your account."
      }
      footer={null}
      heading={next === "/member" ? "Complete your invitation" : "Choose a new password"}
    >
      <UpdatePasswordForm
        inviteEmail={inviteEmail}
        next={next}
        organisationId={organisationId}
      />
    </AuthShell>
  );
}
