"use server";

import { redirect } from "next/navigation";
import { getSiteUrl, isSupabaseConfigured } from "@/lib/supabase/config";
import {
  createSupabaseActionClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/server";

export type AuthActionState = {
  error?: string;
  message?: string;
};

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." } as const;
  }

  return { email, password } as const;
}

export async function signInAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Account access is not configured yet. Add the Supabase URL and publishable key to your local environment.",
    };
  }

  const credentials = readCredentials(formData);
  if ("error" in credentials) return credentials;
  if (!credentials.password) return { error: "Enter your password." };

  const supabase = await createSupabaseActionClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) return { error: error.message };
  redirect("/home");
}

export async function signUpAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Account access is not configured yet. Add the Supabase URL and publishable key to your local environment.",
    };
  }

  const credentials = readCredentials(formData);
  if ("error" in credentials) return credentials;
  if (credentials.password.length < 8) {
    return { error: "Use a password with at least 8 characters." };
  }

  const supabase = await createSupabaseActionClient();
  const { data, error } = await supabase.auth.signUp({
    ...credentials,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/confirm`,
    },
  });

  if (error) return { error: error.message };
  if (data.session) redirect("/home");

  return {
    message:
      "Your registration was submitted. Check your email if confirmation is enabled, then sign in.",
  };
}

export async function requestPasswordResetAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Password recovery is not configured yet. Add the Supabase URL and publishable key to your local environment.",
    };
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  const supabase = await createSupabaseActionClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/confirm?next=/update-password`,
  });

  if (error) return { error: error.message };

  return {
    message:
      "If an account exists for that address, password recovery instructions will be sent.",
  };
}

export async function updatePasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Password updates are not configured yet. Add the Supabase URL and publishable key to your local environment.",
    };
  }

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const requestedNext = String(formData.get("next") ?? "");
  const inviteEmail = String(formData.get("inviteEmail") ?? "")
    .trim()
    .toLowerCase();
  const organisationId = String(formData.get("organisationId") ?? "");
  const isInvitationPasswordSetup = requestedNext === "/member";

  if (password.length < 8) {
    return { error: "Use a password with at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "The passwords do not match." };
  }

  const supabase = await createSupabaseActionClient();
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) return { error: userError.message };
  if (!data.user) {
    return { error: "The recovery session has expired. Request a new link." };
  }
  if (
    isInvitationPasswordSetup &&
    (!inviteEmail ||
      data.user.email?.toLowerCase() !== inviteEmail ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        organisationId,
      ))
  ) {
    return {
      error:
        "This invitation belongs to a different account or project. Open the link using the invited email address.",
    };
  }

  if (isInvitationPasswordSetup) {
    let adminClient;
    try {
      adminClient = createSupabaseAdminClient();
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Member password setup is not configured.",
      };
    }

    const { data: membership, error: membershipError } = await adminClient
      .from("organisation_members")
      .select("email, status")
      .eq("organisation_id", organisationId)
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (membershipError) {
      return {
        error: `Unable to verify the project invitation: ${membershipError.message}`,
      };
    }
    if (
      !membership ||
      membership.email.toLowerCase() !== inviteEmail ||
      (membership.status !== "invited" && membership.status !== "active")
    ) {
      return {
        error:
          "No matching project invitation was found for this account. Ask the client or project manager to create a new invitation link.",
      };
    }

    const { error: activationError } = await supabase.rpc(
      "activate_organisation_memberships",
    );
    if (activationError) {
      return {
        error: `The password was not changed because project access could not be activated: ${activationError.message}`,
      };
    }

    const { error: passwordError } =
      await adminClient.auth.admin.updateUserById(data.user.id, { password });
    if (passwordError) {
      return {
        error: `Unable to save the member password: ${passwordError.message}`,
      };
    }
  } else {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
  }

  redirect(
    isInvitationPasswordSetup || requestedNext === "/owner"
      ? requestedNext
      : "/home",
  );
}

export async function signOutAction() {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }

  const supabase = await createSupabaseActionClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(`Unable to sign out: ${error.message}`);

  redirect("/login");
}
