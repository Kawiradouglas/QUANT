"use server";

import { revalidatePath } from "next/cache";
import type { AuthActionState } from "@/app/auth/actions";
import {
  getSiteUrl,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import {
  createSupabaseActionClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/server";
import { projectAccessRoles } from "@/lib/project-roles";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const contractTypes = ["PPRA", "NCC", "FIDIC", "NEC", "JCT"];
const deliveryModes = [
  "Design and build",
  "Traditional (design-bid-build)",
  "Construction management",
  "EPC / turnkey",
];

async function getSignedInClient() {
  if (!isSupabaseConfigured()) {
    return { error: "Account access is not configured yet." } as const;
  }

  const supabase = await createSupabaseActionClient();
  const { data, error } = await supabase.auth.getUser();

  if (error?.name === "AuthSessionMissingError" || !data.user) {
    return { error: "Sign in to manage projects and organisations." } as const;
  }
  if (error) {
    return {
      error: `Unable to verify your account: ${error.message}`,
    } as const;
  }

  return { supabase, user: data.user } as const;
}

function getChoice(
  formData: FormData,
  field: string,
  allowedOptions: string[],
  label: string,
) {
  const selected = String(formData.get(field) ?? "");
  const value =
    selected === "other"
      ? String(formData.get(`${field}Other`) ?? "").trim()
      : selected;

  if (
    (selected !== "other" && !allowedOptions.includes(selected)) ||
    value.length < 2 ||
    value.length > 100
  ) {
    return {
      error: `Choose a ${label} or enter an Other value between 2 and 100 characters.`,
    } as const;
  }

  return { value } as const;
}

function isMissingProjectSchema(error: { code?: string }) {
  return error.code === "42P01" || error.code === "42883" ||
    error.code === "42703" || error.code === "PGRST202" ||
    error.code === "PGRST204" || error.code === "PGRST205";
}

function isMissingMembershipSchema(error: { code?: string }) {
  return error.code === "42P01" || error.code === "42883" ||
    error.code === "42703" || error.code === "PGRST202" ||
    error.code === "PGRST204" || error.code === "PGRST205";
}

function isMissingAccountError(error: { message: string }) {
  return error.message === "No account exists for that email address.";
}

function isUnconfirmedAccountError(error: { message: string }) {
  return error.message === "That account has not confirmed its email address yet.";
}

function isPendingInvitationError(error: { message: string }) {
  return error.message ===
    "That account is already a member or has a pending invitation.";
}

function isValidName(name: string) {
  return name.length >= 2 && name.length <= 100;
}

export async function createProjectAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!isValidName(name)) {
    return { error: "Use a project name between 2 and 100 characters." };
  }

  const contractType = getChoice(
    formData,
    "contractType",
    contractTypes,
    "contract form",
  );
  if ("error" in contractType) return contractType;

  const deliveryMode = getChoice(
    formData,
    "deliveryMode",
    deliveryModes,
    "delivery mode",
  );
  if ("error" in deliveryMode) return deliveryMode;

  const result = await getSignedInClient();
  if ("error" in result) return result;

  const { error } = await result.supabase.rpc("create_project", {
    p_name: name,
    p_contract_type: contractType.value,
    p_delivery_mode: deliveryMode.value,
  });
  if (error) {
    return {
      error: isMissingProjectSchema(error)
        ? "Project storage is not set up yet. Apply the projects and invitations migration in Supabase."
        : error.message,
    };
  }

  revalidatePath("/home");
  revalidatePath("/owner");
  revalidatePath("/member");
  return {
    message: `${name} was created. Next, set up its organisation and invite the project team.`,
  };
}

export async function updateProjectConfigurationAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!uuidPattern.test(projectId)) {
    return { error: "Choose a valid project." };
  }
  if (!isValidName(name)) {
    return { error: "Use a project name between 2 and 100 characters." };
  }

  const contractType = getChoice(
    formData,
    "contractType",
    contractTypes,
    "contract form",
  );
  if ("error" in contractType) return contractType;

  const deliveryMode = getChoice(
    formData,
    "deliveryMode",
    deliveryModes,
    "delivery mode",
  );
  if ("error" in deliveryMode) return deliveryMode;

  const result = await getSignedInClient();
  if ("error" in result) return result;

  const { error } = await result.supabase.rpc(
    "update_project_configuration",
    {
      p_project_id: projectId,
      p_name: name,
      p_contract_type: contractType.value,
      p_delivery_mode: deliveryMode.value,
    },
  );
  if (error) {
    return {
      error: isMissingProjectSchema(error)
        ? "Project configuration is not set up yet. Apply the latest project configuration migration in Supabase."
        : error.message,
    };
  }

  revalidatePath("/home");
  revalidatePath("/owner");
  revalidatePath("/member");
  return { message: "Project configuration updated." };
}

export async function createProjectOrganisationAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!uuidPattern.test(projectId)) {
    return { error: "Choose a valid project." };
  }
  if (!isValidName(name)) {
    return { error: "Use an organisation name between 2 and 100 characters." };
  }

  const result = await getSignedInClient();
  if ("error" in result) return result;

  const { error } = await result.supabase.rpc("create_project_organisation", {
    p_project_id: projectId,
    p_name: name,
  });
  if (error) {
    return {
      error: isMissingProjectSchema(error)
        ? "Project storage is not set up yet. Apply the projects and invitations migration in Supabase."
        : error.message,
    };
  }

  revalidatePath("/home");
  return {
    message: `${name} is now linked to the project. You can invite its members.`,
  };
}

export async function inviteOrganisationMemberAction(
  _previousState: AuthActionState & { inviteLink?: string },
  formData: FormData,
): Promise<AuthActionState & { inviteLink?: string }> {
  const organisationId = String(formData.get("organisationId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const projectAccessRole = String(
    formData.get("projectAccessRole") ?? "member",
  );
  const professionalRole = String(formData.get("professionalRole") ?? "").trim();
  const delivery = formData.get("delivery") === "manual" ? "manual" : "email";

  if (!uuidPattern.test(organisationId)) {
    return { error: "Choose a valid organisation." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (!projectAccessRoles.some((role) => role === projectAccessRole)) {
    return { error: "Choose project member or project manager." };
  }
  if (professionalRole.length < 2 || professionalRole.length > 80) {
    return {
      error: "Enter a professional role between 2 and 80 characters.",
    };
  }

  const result = await getSignedInClient();
  if ("error" in result) return result;

  const { error: existingMemberError } = await result.supabase.rpc(
    "add_organisation_member",
    {
      p_organisation_id: organisationId,
      p_email: email,
      p_project_access_role: projectAccessRole,
      p_professional_role: professionalRole,
    },
  );

  if (!existingMemberError) {
    revalidatePath("/home");
    return {
      message: `${email} already has a confirmed account and was added directly. They can sign in to access the organisation.`,
    };
  }

  if (isMissingMembershipSchema(existingMemberError)) {
    return {
      error:
        "Organisation storage is not set up yet. Apply the projects and invitations migration in Supabase.",
    };
  }
  const isNewAccount = isMissingAccountError(existingMemberError);
  const isUnconfirmedAccount = isUnconfirmedAccountError(existingMemberError);
  if (!isNewAccount && !isUnconfirmedAccount) {
    return { error: existingMemberError.message };
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdminClient();
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Email invitations are not configured.",
    };
  }

  let siteUrl: string;
  try {
    siteUrl = getSiteUrl();
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "The authentication callback URL is not configured.",
    };
  }

  const callbackUrl =
    `${siteUrl}/auth/confirm?next=%2Fmember&intent=invite&set_password=1` +
    `&invite_email=${encodeURIComponent(email)}` +
    `&organisation_id=${encodeURIComponent(organisationId)}`;
  if (delivery === "manual") {
    const { data: generatedLink, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: isUnconfirmedAccount ? "magiclink" : "invite",
        email,
        options: { redirectTo: callbackUrl },
      });

    if (linkError) {
      return {
        error: `Unable to create a shareable invitation link: ${linkError.message}`,
      };
    }

    const inviteLink = generatedLink.properties.action_link;
    if (!inviteLink) {
      return {
        error:
          "Supabase did not return an invitation link. Check the Supabase Auth logs before retrying.",
      };
    }

    const { error: attachError } = await result.supabase.rpc(
      "attach_invited_organisation_member",
      {
        p_organisation_id: organisationId,
        p_email: email,
        p_project_access_role: projectAccessRole,
        p_professional_role: professionalRole,
      },
    );
    if (attachError && !isPendingInvitationError(attachError)) {
      console.error(
        "A shareable invitation link was created but the organisation membership could not be recorded:",
        attachError.message,
      );
      return {
        error: `The link was created, but the membership could not be recorded: ${attachError.message}. Do not share the link yet; contact the client or project manager.`,
      };
    }

    revalidatePath("/home");
    return {
      message: `Shareable invitation link created for ${email}. It leads to password setup and then the member portal. Send it privately to that person.`,
      inviteLink,
    };
  }

  if (isUnconfirmedAccount) {
    const { error: resendError } = await adminClient.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: callbackUrl },
    });
    if (resendError) {
      return {
        error: `Unable to resend the confirmation email: ${resendError.message}`,
      };
    }

    const { error: attachError } = await result.supabase.rpc(
      "attach_invited_organisation_member",
      {
        p_organisation_id: organisationId,
        p_email: email,
        p_project_access_role: projectAccessRole,
        p_professional_role: professionalRole,
      },
    );
    if (attachError && !isPendingInvitationError(attachError)) {
      console.error(
        "Confirmation email was resent but the organisation membership could not be recorded:",
        attachError.message,
      );
      return {
        error: `The confirmation email was resent, but membership could not be recorded: ${attachError.message}. Contact the client or project manager before retrying.`,
      };
    }

    revalidatePath("/home");
    return {
      message: `Confirmation email resent to ${email}. Ask them to use the newest email link.`,
    };
  }

  const { data: invitation, error: invitationError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: callbackUrl,
    });

  if (invitationError) {
    return {
      error: `Unable to send the invitation email: ${invitationError.message}`,
    };
  }
  if (!invitation.user) {
    return {
      error:
        "The invitation request completed without returning an account. Check Supabase Auth logs before retrying.",
    };
  }

  const { error: attachError } = await result.supabase.rpc(
    "attach_invited_organisation_member",
    {
      p_organisation_id: organisationId,
      p_email: email,
      p_project_access_role: projectAccessRole,
      p_professional_role: professionalRole,
    },
  );

  if (attachError) {
    console.error(
      "Invitation email was sent but the organisation membership could not be recorded:",
      attachError.message,
    );
    return {
      error: `The invitation email was sent, but the membership could not be recorded: ${attachError.message}. Contact the client or project manager before resending.`,
    };
  }

  revalidatePath("/home");
  return { message: `Invitation sent to ${email}.` };
}

export async function updateProjectMemberAssignmentAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const organisationId = String(formData.get("organisationId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const projectAccessRole = String(
    formData.get("projectAccessRole") ?? "",
  );
  const professionalRole = String(formData.get("professionalRole") ?? "").trim();

  if (!uuidPattern.test(organisationId) || !uuidPattern.test(userId)) {
    return { error: "Choose a valid organisation member." };
  }
  if (!projectAccessRoles.some((role) => role === projectAccessRole)) {
    return { error: "Choose project member or project manager." };
  }
  if (professionalRole.length < 2 || professionalRole.length > 80) {
    return {
      error: "Enter a professional role between 2 and 80 characters.",
    };
  }

  const result = await getSignedInClient();
  if ("error" in result) return result;

  const { error } = await result.supabase.rpc(
    "update_project_member_assignment",
    {
      p_organisation_id: organisationId,
      p_user_id: userId,
      p_project_access_role: projectAccessRole,
      p_professional_role: professionalRole,
    },
  );
  if (error) {
    return {
      error: isMissingMembershipSchema(error)
        ? "Project team roles are not set up yet. Apply the latest project access migration in Supabase."
        : error.message,
    };
  }

  revalidatePath("/home");
  revalidatePath("/member");
  return { message: "Project member role updated." };
}
