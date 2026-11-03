"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const otpTypes: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

export function AuthConfirmation({
  next,
  tokenHash,
  type,
  inviteEmail,
  organisationId,
  isInvitation,
}: {
  next: string;
  tokenHash?: string;
  type?: string;
  inviteEmail?: string;
  organisationId?: string;
  isInvitation: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function confirm() {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(url.hash.slice(1));
      const confirmationType = type ?? hashParams.get("type") ?? "";
      const code = url.searchParams.get("code");
      if (code) {
        const callbackUrl = new URL("/auth/callback", url.origin);
        callbackUrl.searchParams.set("code", code);
        callbackUrl.searchParams.set("next", next);
        if (isInvitation) {
          callbackUrl.searchParams.set("intent", "invite");
          if (inviteEmail) {
            callbackUrl.searchParams.set("invite_email", inviteEmail);
          }
          if (organisationId) {
            callbackUrl.searchParams.set("organisation_id", organisationId);
          }
        }
        window.location.replace(callbackUrl);
        return;
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const publishableKey =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!supabaseUrl || !publishableKey) {
        setError("Account access is not configured for this application.");
        return;
      }

      try {
        const supabase = createBrowserClient(supabaseUrl, publishableKey, {
          auth: { flowType: "implicit", detectSessionInUrl: false },
        });
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        let session;
        let confirmationError;
        if (accessToken && refreshToken) {
          const result = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          session = result.data.session;
          confirmationError = result.error;
          window.history.replaceState(
            window.history.state,
            "",
            `${url.pathname}${url.search}`,
          );
        } else if (tokenHash && type && otpTypes.includes(type)) {
          const result = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          });
          session = result.data.session;
          confirmationError = result.error;
        } else if (isInvitation) {
          setError(
            "This invitation link did not contain a valid sign-in token. Ask the project owner to create a new link.",
          );
          return;
        } else {
          const result = await supabase.auth.getSession();
          session = result.data.session;
          confirmationError = result.error;
        }

        if (confirmationError) {
          setError(
            "This confirmation link is invalid or has expired. Ask the project owner to send you a new invitation.",
          );
          return;
        }
        if (!session) {
          setError(
            "The confirmation link did not create a sign-in session. Ask the project owner to send a new invitation.",
          );
          return;
        }

        if (
          isInvitation &&
          (!inviteEmail ||
            !organisationId ||
            session.user.email?.toLowerCase() !== inviteEmail.toLowerCase())
        ) {
          await supabase.auth.signOut();
          setError(
            "This link is for a different email address. Open it using the invited account or ask the project owner for a new link.",
          );
          return;
        }

        const destination =
          isInvitation || confirmationType === "invite"
            ? `/update-password?next=%2Fmember&invite_email=${encodeURIComponent(inviteEmail ?? "")}&organisation_id=${encodeURIComponent(organisationId ?? "")}`
            : next === "/update-password"
              ? "/update-password"
              : next === "/member"
                ? "/member"
                : "/home";

        router.replace(destination);
      } catch (confirmationError) {
        console.error("Email confirmation could not be completed:", confirmationError);
        setError(
          "We could not confirm this link right now. Check your connection and try again, or ask the project owner to send a new invitation.",
        );
      }
    }

    void confirm();
  }, [inviteEmail, isInvitation, next, organisationId, router, tokenHash, type]);

  return error ? (
    <p
      aria-live="polite"
      className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-5 text-red-800"
      role="alert"
    >
      {error}
    </p>
  ) : (
    <p
      aria-live="polite"
      className="rounded-lg border border-[var(--border)] bg-white px-3.5 py-3 text-sm leading-5 text-[var(--muted)]"
      role="status"
    >
      Verifying your confirmation link…
    </p>
  );
}
