import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ProjectFinanceTerms,
  ProjectPaymentApplication,
  ProjectPaymentDocument,
  ProjectPaymentHistory,
  ProjectPaymentRequiredDocument,
  ProjectPaymentTransaction,
  ProjectPaidTotal,
} from "@/lib/project-payment-types";

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

function isPaymentStatus(
  status: string,
): status is ProjectPaymentApplication["status"] {
  return (
    status === "draft" ||
    status === "submitted" ||
    status === "changes_requested" ||
    status === "approved" ||
    status === "reversed"
  );
}

export async function getProjectPaymentData(projectIds: string[]) {
  if (projectIds.length === 0) {
    return {
      ready: true,
      terms: [] as ProjectFinanceTerms[],
      requiredDocuments: [] as ProjectPaymentRequiredDocument[],
      applications: [] as ProjectPaymentApplication[],
      paidTotals: [] as ProjectPaidTotal[],
    };
  }
  const supabase = await createSupabaseServerClient();
  const { data: termsRows, error: termsError } = await supabase
    .from("project_finance_terms")
    .select(
      "id, project_id, currency_code, contract_amount, performance_security_amount, performance_security_percent, performance_security_clause, performance_security_expiry, advance_payment_amount, advance_payment_percent, advance_recovery_percent, advance_payment_clause, retention_percent, retention_cap_amount, retention_release_clause, maximum_claim_amount, maximum_claim_percent, interim_payment_clause, applicant_user_id, approver_user_id",
    )
    .in("project_id", projectIds);
  if (termsError) {
    if (isMissingPaymentSchema(termsError)) {
      return {
        ready: false,
        terms: [] as ProjectFinanceTerms[],
        requiredDocuments: [] as ProjectPaymentRequiredDocument[],
        applications: [] as ProjectPaymentApplication[],
        paidTotals: [] as ProjectPaidTotal[],
      };
    }
    throw new Error(`Unable to load project finance terms: ${termsError.message}`);
  }

  const { data: requirementRows, error: requirementsError } = await supabase
    .from("project_payment_required_documents")
    .select("id, project_id, document_name")
    .in("project_id", projectIds)
    .order("document_name");
  if (requirementsError) {
    if (isMissingPaymentSchema(requirementsError)) {
      return {
        ready: false,
        terms: [] as ProjectFinanceTerms[],
        requiredDocuments: [] as ProjectPaymentRequiredDocument[],
        applications: [] as ProjectPaymentApplication[],
        paidTotals: [] as ProjectPaidTotal[],
      };
    }
    throw new Error(
      `Unable to load required payment documents: ${requirementsError.message}`,
    );
  }

  const { data: applicationRows, error: applicationsError } = await supabase
    .from("project_payment_applications")
    .select(
      "id, project_id, reference_number, period_start, period_end, review_due_date, gross_claim_amount, advance_recovery, retention_withheld, retention_released, other_deductions, net_amount, applicant_user_id, approver_user_id, status, applicant_note, review_note, reversal_reason, created_at, updated_at",
    )
    .in("project_id", projectIds)
    .order("period_end", { ascending: false });
  if (applicationsError) {
    if (isMissingPaymentSchema(applicationsError)) {
      return {
        ready: false,
        terms: [] as ProjectFinanceTerms[],
        requiredDocuments: [] as ProjectPaymentRequiredDocument[],
        applications: [] as ProjectPaymentApplication[],
        paidTotals: [] as ProjectPaidTotal[],
      };
    }
    throw new Error(
      `Unable to load payment applications: ${applicationsError.message}`,
    );
  }
  const { data: paidTotalsRows, error: paidTotalsError } = await supabase.rpc(
    "get_project_paid_totals",
    { p_project_ids: projectIds },
  );
  if (paidTotalsError) {
    if (isMissingPaymentSchema(paidTotalsError)) {
      return {
        ready: false,
        terms: [] as ProjectFinanceTerms[],
        requiredDocuments: [] as ProjectPaymentRequiredDocument[],
        applications: [] as ProjectPaymentApplication[],
        paidTotals: [] as ProjectPaidTotal[],
      };
    }
    throw new Error(
      `Unable to load project payment totals: ${paidTotalsError.message}`,
    );
  }
  if (applicationRows.length === 0) {
    return {
      ready: true,
      terms: termsRows,
      requiredDocuments: requirementRows,
      applications: [] as ProjectPaymentApplication[],
      paidTotals: paidTotalsRows as ProjectPaidTotal[],
    };
  }

  const applicationIds = applicationRows.map((application) => application.id);
  const [
    { data: documentRows, error: documentsError },
    { data: historyRows, error: historyError },
    { data: transactionRows, error: transactionsError },
  ] = await Promise.all([
    supabase
      .from("project_payment_application_documents")
      .select(
        "id, application_id, document_type, file_name, file_size, uploaded_by_email, created_at",
      )
      .in("application_id", applicationIds)
      .order("created_at"),
    supabase
      .from("project_payment_application_history")
      .select(
        "id, application_id, actor_email, action, note, previous_status, new_status, amount, created_at",
      )
      .in("application_id", applicationIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_payment_transactions")
      .select(
        "id, application_id, amount, paid_at, payment_reference, note, recorded_by_email",
      )
      .in("application_id", applicationIds)
      .order("paid_at", { ascending: false }),
  ]);
  if (documentsError || historyError || transactionsError) {
    const error = documentsError ?? historyError ?? transactionsError;
    if (error && isMissingPaymentSchema(error)) {
      return {
        ready: false,
        terms: [] as ProjectFinanceTerms[],
        requiredDocuments: [] as ProjectPaymentRequiredDocument[],
        applications: [] as ProjectPaymentApplication[],
        paidTotals: [] as ProjectPaidTotal[],
      };
    }
    throw new Error(`Unable to load payment application records: ${error?.message}`);
  }

  const documentsByApplication = new Map<string, ProjectPaymentDocument[]>();
  for (const row of documentRows) {
    const records = documentsByApplication.get(row.application_id) ?? [];
    records.push({
      id: row.id,
      document_type: row.document_type,
      file_name: row.file_name,
      file_size: row.file_size,
      uploaded_by_email: row.uploaded_by_email,
      created_at: row.created_at,
    });
    documentsByApplication.set(row.application_id, records);
  }

  const historyByApplication = new Map<string, ProjectPaymentHistory[]>();
  for (const row of historyRows) {
    const records = historyByApplication.get(row.application_id) ?? [];
    records.push({
      id: row.id,
      actor_email: row.actor_email,
      action: row.action,
      note: row.note,
      previous_status: row.previous_status,
      new_status: row.new_status,
      amount: row.amount,
      created_at: row.created_at,
    });
    historyByApplication.set(row.application_id, records);
  }

  const paymentsByApplication = new Map<string, ProjectPaymentTransaction[]>();
  for (const row of transactionRows) {
    const records = paymentsByApplication.get(row.application_id) ?? [];
    records.push({
      id: row.id,
      amount: row.amount,
      paid_at: row.paid_at,
      payment_reference: row.payment_reference,
      note: row.note,
      recorded_by_email: row.recorded_by_email,
    });
    paymentsByApplication.set(row.application_id, records);
  }

  return {
    ready: true,
    terms: termsRows as ProjectFinanceTerms[],
    requiredDocuments: requirementRows,
    applications: applicationRows.map((row) => {
      if (!isPaymentStatus(row.status)) {
        throw new Error("A payment application has an unsupported status.");
      }
      return {
        ...row,
        status: row.status,
        documents: documentsByApplication.get(row.id) ?? [],
        history: historyByApplication.get(row.id) ?? [],
        payments: paymentsByApplication.get(row.id) ?? [],
      };
    }),
    paidTotals: paidTotalsRows as ProjectPaidTotal[],
  };
}
