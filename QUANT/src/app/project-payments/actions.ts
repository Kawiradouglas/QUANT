"use server";

import { revalidatePath } from "next/cache";
import type { AuthActionState } from "@/app/auth/actions";
import { projectDocumentMaxFileSize } from "@/lib/project-document-types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseActionClient } from "@/lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedContentTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "text/plain",
]);

type ActionClientResult =
  | { error: string }
  | {
      supabase: Awaited<ReturnType<typeof createSupabaseActionClient>>;
      userId: string;
      email: string;
    };

async function getActionClient(): Promise<ActionClientResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Account access is not configured yet." };
  }
  const supabase = await createSupabaseActionClient();
  const { data, error } = await supabase.auth.getUser();
  if (error?.name === "AuthSessionMissingError") {
    return { error: "Sign in to manage project payments." };
  }
  if (error) return { error: `Unable to verify your account: ${error.message}` };
  if (!data.user) return { error: "Sign in to manage project payments." };
  return {
    supabase,
    userId: data.user.id,
    email: data.user.email ?? "",
  };
}

function isMissingPaymentSchema(error: { code?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "42883" ||
    error.code === "PGRST202" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205"
  );
}

function schemaMessage() {
  return "Interim payments are not set up yet. Apply the interim payment migration in Supabase.";
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

type AmountResult = { value: number | null } | { error: string };

function optionalAmount(value: FormDataEntryValue | null): AmountResult {
  const text = String(value ?? "").trim();
  if (!text) return { value: null };
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(text)) {
    return { error: "Enter a valid amount with no more than two decimal places." };
  }
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: "Amounts cannot be negative." };
  }
  return { value: amount };
}

function requiredAmount(
  value: FormDataEntryValue | null,
  label: string,
): { value: number } | { error: string } {
  const amount = optionalAmount(value);
  if ("error" in amount) return amount;
  if (amount.value === null || amount.value <= 0) {
    return { error: `${label} must be greater than zero.` };
  }
  return { value: amount.value };
}

function percentage(value: FormDataEntryValue | null, label: string): AmountResult {
  const parsed = optionalAmount(value);
  if ("error" in parsed) return parsed;
  if (parsed.value !== null && parsed.value > 100) {
    return { error: `${label} must be between 0 and 100.` };
  }
  return parsed;
}

function requiredText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function revalidatePortals() {
  revalidatePath("/owner");
  revalidatePath("/member");
}

export async function configureProjectFinanceAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const projectId = requiredText(formData, "projectId");
  const currencyCode = requiredText(formData, "currencyCode").toUpperCase();
  const applicantUserId = requiredText(formData, "applicantUserId");
  const approverUserId = requiredText(formData, "approverUserId");
  if (!uuidPattern.test(projectId)) return { error: "Choose a valid project." };
  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    return { error: "Enter a three-letter currency code, such as USD or KES." };
  }
  if (!uuidPattern.test(applicantUserId) || !uuidPattern.test(approverUserId)) {
    return { error: "Select an active applicant and approver." };
  }
  if (applicantUserId === approverUserId) {
    return { error: "The applicant and approver must be different members." };
  }

  const contractAmount = requiredAmount(formData.get("contractAmount"), "Contract amount");
  if ("error" in contractAmount) return contractAmount;
  const performanceSecurityAmount = optionalAmount(
    formData.get("performanceSecurityAmount"),
  );
  const performanceSecurityPercent = percentage(
    formData.get("performanceSecurityPercent"),
    "Performance security percentage",
  );
  const advancePaymentAmount = optionalAmount(formData.get("advancePaymentAmount"));
  const advancePaymentPercent = percentage(
    formData.get("advancePaymentPercent"),
    "Advance payment percentage",
  );
  const advanceRecoveryPercent = percentage(
    formData.get("advanceRecoveryPercent"),
    "Advance recovery percentage",
  );
  const retentionPercent = percentage(formData.get("retentionPercent"), "Retention percentage");
  const retentionCapAmount = optionalAmount(formData.get("retentionCapAmount"));
  const maximumClaimAmount = optionalAmount(formData.get("maximumClaimAmount"));
  const maximumClaimPercent = percentage(
    formData.get("maximumClaimPercent"),
    "Maximum claim percentage",
  );
  const optionalAmounts: AmountResult[] = [
    performanceSecurityAmount,
    performanceSecurityPercent,
    advancePaymentAmount,
    advancePaymentPercent,
    advanceRecoveryPercent,
    retentionPercent,
    retentionCapAmount,
    maximumClaimAmount,
    maximumClaimPercent,
  ];
  for (const amount of optionalAmounts) {
    if ("error" in amount) return amount;
  }
  if ("error" in performanceSecurityAmount) return performanceSecurityAmount;
  if ("error" in performanceSecurityPercent) return performanceSecurityPercent;
  if ("error" in advancePaymentAmount) return advancePaymentAmount;
  if ("error" in advancePaymentPercent) return advancePaymentPercent;
  if ("error" in advanceRecoveryPercent) return advanceRecoveryPercent;
  if ("error" in retentionPercent) return retentionPercent;
  if ("error" in retentionCapAmount) return retentionCapAmount;
  if ("error" in maximumClaimAmount) return maximumClaimAmount;
  if ("error" in maximumClaimPercent) return maximumClaimPercent;

  if (
    performanceSecurityAmount.value !== null &&
    performanceSecurityPercent.value !== null
  ) {
    return { error: "Set performance security as an amount or a percentage, not both." };
  }
  if (advancePaymentAmount.value !== null && advancePaymentPercent.value !== null) {
    return { error: "Set advance payment as an amount or a percentage, not both." };
  }
  if (maximumClaimAmount.value !== null && maximumClaimPercent.value !== null) {
    return { error: "Set the per-application limit as an amount or a percentage, not both." };
  }

  const documentNames = [
    ...new Set(
      String(formData.get("requiredDocuments") ?? "")
        .split(/\r?\n/)
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ];
  if (
    documentNames.length === 0 ||
    documentNames.some((name) => name.length < 2 || name.length > 100)
  ) {
    return {
      error: "Enter at least one required document, one name per line (2–100 characters).",
    };
  }
  const performanceSecurityExpiry = requiredText(
    formData,
    "performanceSecurityExpiry",
  );
  if (performanceSecurityExpiry && !validDate(performanceSecurityExpiry)) {
    return { error: "Enter a valid performance security expiry date." };
  }

  const result = await getActionClient();
  if ("error" in result) return result;
  const { error } = await result.supabase.rpc("configure_project_finance", {
    p_project_id: projectId,
    p_currency_code: currencyCode,
    p_contract_amount: contractAmount.value,
    p_performance_security_amount: performanceSecurityAmount.value,
    p_performance_security_percent: performanceSecurityPercent.value,
    p_performance_security_clause: requiredText(
      formData,
      "performanceSecurityClause",
    ),
    p_performance_security_expiry: performanceSecurityExpiry || null,
    p_advance_payment_amount: advancePaymentAmount.value,
    p_advance_payment_percent: advancePaymentPercent.value,
    p_advance_recovery_percent: advanceRecoveryPercent.value ?? 0,
    p_advance_payment_clause: requiredText(formData, "advancePaymentClause"),
    p_retention_percent: retentionPercent.value ?? 0,
    p_retention_cap_amount: retentionCapAmount.value,
    p_retention_release_clause: requiredText(formData, "retentionReleaseClause"),
    p_maximum_claim_amount: maximumClaimAmount.value,
    p_maximum_claim_percent: maximumClaimPercent.value,
    p_interim_payment_clause: requiredText(formData, "interimPaymentClause"),
    p_applicant_user_id: applicantUserId,
    p_approver_user_id: approverUserId,
    p_required_documents: documentNames,
  });
  if (error) {
    return {
      error: isMissingPaymentSchema(error) ? schemaMessage() : error.message,
    };
  }
  revalidatePortals();
  return { message: "Project financing terms and payment roles saved." };
}

export async function savePaymentApplicationAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const applicationId = requiredText(formData, "applicationId");
  const projectId = requiredText(formData, "projectId");
  const referenceNumber = requiredText(formData, "referenceNumber");
  const periodStart = requiredText(formData, "periodStart");
  const periodEnd = requiredText(formData, "periodEnd");
  const reviewDueDate = requiredText(formData, "reviewDueDate");
  const note = requiredText(formData, "applicantNote");
  if (applicationId && !uuidPattern.test(applicationId)) {
    return { error: "Choose a valid payment application." };
  }
  if (!uuidPattern.test(projectId)) return { error: "Choose a valid project." };
  if (referenceNumber.length < 1 || referenceNumber.length > 80) {
    return { error: "Application references must be 1–80 characters." };
  }
  if (!validDate(periodStart) || !validDate(periodEnd) || periodEnd < periodStart) {
    return { error: "Choose a valid payment period." };
  }
  if (reviewDueDate && !validDate(reviewDueDate)) {
    return { error: "Choose a valid review due date." };
  }
  if (note.length > 2000) return { error: "Notes must be 2000 characters or fewer." };

  const gross = requiredAmount(formData.get("grossClaimAmount"), "Gross claim");
  if ("error" in gross) return gross;
  const advance = optionalAmount(formData.get("advanceRecovery"));
  const retention = optionalAmount(formData.get("retentionWithheld"));
  const release = optionalAmount(formData.get("retentionReleased"));
  const deductions = optionalAmount(formData.get("otherDeductions"));
  if ("error" in advance) return advance;
  if ("error" in retention) return retention;
  if ("error" in release) return release;
  if ("error" in deductions) return deductions;
  const net =
    gross.value -
    (advance.value ?? 0) -
    (retention.value ?? 0) +
    (release.value ?? 0) -
    (deductions.value ?? 0);
  if (net < 0) return { error: "Deductions cannot exceed the gross claim." };

  const result = await getActionClient();
  if ("error" in result) return result;
  const { error } = await result.supabase.rpc(
    "save_project_payment_application",
    {
      p_application_id: applicationId || null,
      p_project_id: projectId,
      p_reference_number: referenceNumber,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_review_due_date: reviewDueDate || null,
      p_gross_claim_amount: gross.value,
      p_advance_recovery: advance.value ?? 0,
      p_retention_withheld: retention.value ?? 0,
      p_retention_released: release.value ?? 0,
      p_other_deductions: deductions.value ?? 0,
      p_applicant_note: note,
    },
  );
  if (error) {
    return {
      error: isMissingPaymentSchema(error) ? schemaMessage() : error.message,
    };
  }
  revalidatePortals();
  return { message: "Payment application saved as a draft." };
}

function readPaymentFile(formData: FormData) {
  const value = formData.get("file");
  if (!(value instanceof File) || value.size === 0) {
    return { error: "Choose the required supporting document." } as const;
  }
  if (value.size > projectDocumentMaxFileSize) {
    return { error: "Supporting documents must be 10 MB or smaller." } as const;
  }
  if (!allowedContentTypes.has(value.type)) {
    return {
      error:
        "Use a PDF, Word, Excel, PowerPoint, PNG, JPEG, or plain-text file.",
    } as const;
  }
  const fileName =
    value.name
      .replace(/[/\\]/g, "_")
      .replace(/[^a-zA-Z0-9._() -]/g, "_")
      .replace(/^[. ]+/, "")
      .slice(0, 200) || "payment-document";
  return { file: value, fileName } as const;
}

async function cleanupUpload(
  supabase: Awaited<ReturnType<typeof createSupabaseActionClient>>,
  storagePath: string,
  message: string,
) {
  const { error } = await supabase.storage
    .from("project-documents")
    .remove([storagePath]);
  return {
    error: error
      ? `${message} The unregistered file could not be removed: ${error.message}`
      : message,
  };
}

export async function uploadPaymentApplicationDocumentAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const applicationId = requiredText(formData, "applicationId");
  const documentType = requiredText(formData, "documentType");
  if (!uuidPattern.test(applicationId)) {
    return { error: "Choose a valid payment application." };
  }
  if (documentType.length < 2 || documentType.length > 100) {
    return { error: "Choose a required document type." };
  }
  const fileResult = readPaymentFile(formData);
  if ("error" in fileResult) return fileResult;
  const result = await getActionClient();
  if ("error" in result) return result;
  const { data: application, error: applicationError } = await result.supabase
    .from("project_payment_applications")
    .select("id, project_id, applicant_user_id, status")
    .eq("id", applicationId)
    .maybeSingle();
  if (applicationError) {
    return {
      error: isMissingPaymentSchema(applicationError)
        ? schemaMessage()
        : `Unable to load payment application: ${applicationError.message}`,
    };
  }
  if (!application) return { error: "The payment application was not found." };
  if (
    application.applicant_user_id !== result.userId &&
    application.status !== "draft"
  ) {
    return { error: "Only the assigned applicant can upload application documents." };
  }
  if (!["draft", "changes_requested"].includes(application.status)) {
    return { error: "Documents can only be uploaded to a draft or returned application." };
  }

  const storagePath =
    `${application.project_id}/payment-applications/${application.id}/${crypto.randomUUID()}-${fileResult.fileName}`;
  const { error: uploadError } = await result.supabase.storage
    .from("project-documents")
    .upload(storagePath, fileResult.file, {
      contentType: fileResult.file.type,
      upsert: false,
    });
  if (uploadError) {
    return { error: `Unable to upload the supporting document: ${uploadError.message}` };
  }
  const { error } = await result.supabase.rpc(
    "register_project_payment_document",
    {
      p_application_id: application.id,
      p_document_type: documentType,
      p_storage_path: storagePath,
      p_file_name: fileResult.fileName,
      p_content_type: fileResult.file.type,
      p_file_size: fileResult.file.size,
    },
  );
  if (error) {
    return cleanupUpload(
      result.supabase,
      storagePath,
      `Unable to register supporting document: ${
        isMissingPaymentSchema(error) ? schemaMessage() : error.message
      }`,
    );
  }
  revalidatePortals();
  return { message: `${documentType} attached to the application.` };
}

export async function submitPaymentApplicationAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const applicationId = requiredText(formData, "applicationId");
  if (!uuidPattern.test(applicationId)) {
    return { error: "Choose a valid payment application." };
  }
  const result = await getActionClient();
  if ("error" in result) return result;
  const { error } = await result.supabase.rpc(
    "submit_project_payment_application",
    { p_application_id: applicationId },
  );
  if (error) {
    return {
      error: isMissingPaymentSchema(error) ? schemaMessage() : error.message,
    };
  }
  revalidatePortals();
  return { message: "Payment application submitted to the assigned approver." };
}

export async function reviewPaymentApplicationAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const applicationId = requiredText(formData, "applicationId");
  const decision = requiredText(formData, "decision");
  const reviewNote = requiredText(formData, "reviewNote");
  if (!uuidPattern.test(applicationId)) {
    return { error: "Choose a valid payment application." };
  }
  if (decision !== "approve" && decision !== "request_changes") {
    return { error: "Choose approve or request changes." };
  }
  if (
    reviewNote.length > 2000 ||
    (decision === "request_changes" && reviewNote.length < 2)
  ) {
    return { error: "Enter a review note of 2–2000 characters when requesting changes." };
  }
  const result = await getActionClient();
  if ("error" in result) return result;
  const { error } = await result.supabase.rpc(
    "review_project_payment_application",
    {
      p_application_id: applicationId,
      p_decision: decision,
      p_review_note: reviewNote,
    },
  );
  if (error) {
    return {
      error: isMissingPaymentSchema(error) ? schemaMessage() : error.message,
    };
  }
  revalidatePortals();
  return {
    message:
      decision === "approve"
        ? "Payment application approved."
        : "Payment application returned for changes.",
  };
}

export async function reversePaymentApprovalAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const applicationId = requiredText(formData, "applicationId");
  const reason = requiredText(formData, "reason");
  if (!uuidPattern.test(applicationId)) {
    return { error: "Choose a valid payment application." };
  }
  if (reason.length < 2 || reason.length > 1000) {
    return { error: "Give a reversal reason between 2 and 1000 characters." };
  }
  const result = await getActionClient();
  if ("error" in result) return result;
  const { error } = await result.supabase.rpc("reverse_project_payment_approval", {
    p_application_id: applicationId,
    p_reason: reason,
  });
  if (error) {
    return {
      error: isMissingPaymentSchema(error) ? schemaMessage() : error.message,
    };
  }
  revalidatePortals();
  return { message: "Approval reversed and recorded in the audit history." };
}

export async function recordProjectPaymentAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const applicationId = requiredText(formData, "applicationId");
  const paidAt = requiredText(formData, "paidAt");
  const reference = requiredText(formData, "paymentReference");
  const note = requiredText(formData, "note");
  if (!uuidPattern.test(applicationId)) {
    return { error: "Choose a valid payment application." };
  }
  if (!validDate(paidAt)) return { error: "Enter a valid payment date." };
  if (reference.length < 1 || reference.length > 100) {
    return { error: "Payment reference must be 1–100 characters." };
  }
  if (note.length > 1000) return { error: "Payment notes must be 1000 characters or fewer." };
  const amount = requiredAmount(formData.get("amount"), "Payment amount");
  if ("error" in amount) return amount;

  const result = await getActionClient();
  if ("error" in result) return result;
  const { error } = await result.supabase.rpc("record_project_payment", {
    p_application_id: applicationId,
    p_amount: amount.value,
    p_paid_at: paidAt,
    p_payment_reference: reference,
    p_note: note,
  });
  if (error) {
    return {
      error: isMissingPaymentSchema(error) ? schemaMessage() : error.message,
    };
  }
  revalidatePortals();
  return { message: "Payment recorded against the approved application." };
}
