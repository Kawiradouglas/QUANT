import { AuthShell } from "@/components/auth/auth-shell";
import { AuthConfirmation } from "@/components/auth/auth-confirmation";

export default async function AuthConfirmPage({
  searchParams,
}: PageProps<"/auth/confirm">) {
  const params = await searchParams;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;
  const tokenHash = Array.isArray(params.token_hash)
    ? params.token_hash[0]
    : params.token_hash;
  const type = Array.isArray(params.type) ? params.type[0] : params.type;
  const setPassword = Array.isArray(params.set_password)
    ? params.set_password[0]
    : params.set_password;
  const inviteEmail = Array.isArray(params.invite_email)
    ? params.invite_email[0]
    : params.invite_email;
  const organisationId = Array.isArray(params.organisation_id)
    ? params.organisation_id[0]
    : params.organisation_id;

  return (
    <AuthShell
      description="We are confirming your email and preparing your project access."
      footer={null}
      heading="Confirming your account"
    >
      <AuthConfirmation
        next={next === "/member" ? "/member" : next === "/update-password" ? "/update-password" : "/home"}
        tokenHash={tokenHash}
        type={type}
        inviteEmail={inviteEmail}
        organisationId={organisationId}
        isInvitation={params.intent === "invite" || setPassword === "1"}
      />
    </AuthShell>
  );
}
