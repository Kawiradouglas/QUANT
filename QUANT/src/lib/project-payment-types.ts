export type ProjectFinanceTerms = {
  id: string;
  project_id: string;
  currency_code: string;
  contract_amount: number;
  performance_security_amount: number | null;
  performance_security_percent: number | null;
  performance_security_clause: string;
  performance_security_expiry: string | null;
  advance_payment_amount: number | null;
  advance_payment_percent: number | null;
  advance_recovery_percent: number;
  advance_payment_clause: string;
  retention_percent: number;
  retention_cap_amount: number | null;
  retention_release_clause: string;
  maximum_claim_amount: number | null;
  maximum_claim_percent: number | null;
  interim_payment_clause: string;
  applicant_user_id: string;
  approver_user_id: string;
};

export type ProjectPaymentRequiredDocument = {
  id: string;
  project_id: string;
  document_name: string;
};

export type ProjectPaymentDocument = {
  id: string;
  document_type: string;
  file_name: string;
  file_size: number;
  uploaded_by_email: string | null;
  created_at: string;
};

export type ProjectPaymentHistory = {
  id: string;
  actor_email: string | null;
  action: string;
  note: string;
  previous_status: string | null;
  new_status: string | null;
  amount: number | null;
  created_at: string;
};

export type ProjectPaymentTransaction = {
  id: string;
  amount: number;
  paid_at: string;
  payment_reference: string;
  note: string;
  recorded_by_email: string | null;
};

export type ProjectPaymentApplication = {
  id: string;
  project_id: string;
  reference_number: string;
  period_start: string;
  period_end: string;
  review_due_date: string | null;
  gross_claim_amount: number;
  advance_recovery: number;
  retention_withheld: number;
  retention_released: number;
  other_deductions: number;
  net_amount: number;
  applicant_user_id: string;
  approver_user_id: string;
  status:
    | "draft"
    | "submitted"
    | "changes_requested"
    | "approved"
    | "reversed";
  applicant_note: string;
  review_note: string;
  reversal_reason: string;
  created_at: string;
  updated_at: string;
  documents: ProjectPaymentDocument[];
  history: ProjectPaymentHistory[];
  payments: ProjectPaymentTransaction[];
};

export type ProjectFinanceSummary = {
  project_id: string;
  project_name: string;
  currency_code: string;
  contract_amount: number;
  paid_amount: number;
};

export type ProjectPaidTotal = {
  project_id: string;
  paid_amount: number;
};
