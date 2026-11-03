import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseActionClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const requestedType = request.nextUrl.searchParams.get("type");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const isInvitation =
    request.nextUrl.searchParams.get("intent") === "invite" ||
    requestedType === "invite" ||
    requestedNext === "/member";
  const inviteEmail = request.nextUrl.searchParams.get("invite_email");
  const organisationId = request.nextUrl.searchParams.get("organisation_id");
  const otpTypes = [
    "signup",
    "invite",
    "magiclink",
    "recovery",
    "email_change",
    "email",
  ] as const;
  const otpType = otpTypes.find((type) => type === requestedType);
  const callbackError = isInvitation
    ? "/login?error=invite_callback_failed"
    : "/login?error=callback_failed";

  if (!code && !(tokenHash && otpType)) {
    return NextResponse.redirect(new URL(callbackError, request.url));
  }

  const supabase = await createSupabaseActionClient();
  let authError;
  if (code) {
    ({ error: authError } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && otpType) {
    ({ error: authError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    }));
  } else {
    return NextResponse.redirect(
      new URL("/login?error=callback_failed", request.url),
    );
  }

  if (authError) {
    console.error(
      "Supabase authentication callback failed:",
      authError.message,
    );
    return NextResponse.redirect(new URL(callbackError, request.url));
  }

  if (isInvitation) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (
      userError ||
      !userData.user ||
      !inviteEmail ||
      !organisationId ||
      userData.user.email?.toLowerCase() !== inviteEmail.toLowerCase()
    ) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL(callbackError, request.url));
    }

    const { error: activationError } = await supabase.rpc(
      "activate_organisation_memberships",
    );
    if (activationError) {
      console.error(
        "Unable to activate the confirmed organisation invitation:",
        activationError.message,
      );
      return NextResponse.redirect(
        new URL("/login?error=invite_callback_failed", request.url),
      );
    }

    return NextResponse.redirect(
      new URL(
        `/update-password?next=%2Fmember&invite_email=${encodeURIComponent(inviteEmail)}&organisation_id=${encodeURIComponent(organisationId)}`,
        request.url,
      ),
    );
  }

  const next =
    requestedNext === "/update-password" ||
    requestedNext === "/owner" ||
    requestedNext === "/member"
      ? requestedNext
      : "/home";

  return NextResponse.redirect(new URL(next, request.url));
}
