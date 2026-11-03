"use client";

import { useActionState, useState } from "react";
import {
  configureProjectFinanceAction,
  recordProjectPaymentAction,
  reviewPaymentApplicationAction,
  reversePaymentApprovalAction,
  savePaymentApplicationAction,
  submitPaymentApplicationAction,
  uploadPaymentApplicationDocumentAction,
} from "@/app/project-payments/actions";
import { AuthFeedback } from "@/components/auth/auth-feedback";
import { SubmitButton } from "@/components/auth/submit-button";
import type {
  Project,
  ProjectOrganisation,
} from "@/components/project/project-workspace";
import type {
  ProjectFinanceTerms,
  ProjectPaymentApplication,
  ProjectPaymentRequiredDocument,
} from "@/lib/project-payment-types";

const fieldClassName =
  "h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)]";
const fileAccept =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/jpeg,image/png,text/plain";

const statusLabels: Record<ProjectPaymentApplication["status"], string> = {
  draft: "Draft",
  submitted: "Awaiting review",
  changes_requested: "Changes requested",
  approved: "Approved",
  reversed: "Approval reversed",
};

const statusStyles: Record<ProjectPaymentApplication["status"], string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-amber-50 text-amber-900",
  changes_requested: "bg-orange-50 text-orange-900",
  approved: "bg-emerald-50 text-emerald-900",
  reversed: "bg-rose-50 text-rose-900",
};

function money(value: number, currencyCode: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(value);
}

function dateLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

function NumberField({
  label,
  name,
  defaultValue,
  required = false,
  min = "0",
  step = "0.01",
  value,
  onChange,
}: {
  label: string;
  name: string;
  defaultValue?: number | string | null;
  required?: boolean;
  min?: string;
  step?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="space-y-1.5 text-sm font-medium">
      {label}
      <input
        className={fieldClassName}
        defaultValue={defaultValue ?? ""}
        min={min}
        name={name}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        required={required}
        step={step}
        type="number"
        value={value}
      />
    </label>
  );
}

export function ProjectFinanceWorkspace({
  currentUserId,
  projects,
  organisations,
  terms,
  requiredDocuments,
  applications,
  ready,
}: {
  currentUserId: string;
  projects: Project[];
  organisations: ProjectOrganisation[];
  terms: ProjectFinanceTerms[];
  requiredDocuments: ProjectPaymentRequiredDocument[];
  applications: ProjectPaymentApplication[];
  ready: boolean;
}) {
  const termsByProject = new Map(terms.map((item) => [item.project_id, item]));
  const orgByProject = new Map(
    organisations
      .filter((organisation) => organisation.project_id)
      .map((organisation) => [organisation.project_id!, organisation]),
  );

  return (
    <section aria-labelledby="finance-heading" className="space-y-6">
      <header className="rounded-2xl bg-[linear-gradient(120deg,#102b3c_0%,#174b58_56%,#167c79_100%)] p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-200">
          Contract administration
        </p>
        <h2 className="mt-2 text-2xl font-semibold" id="finance-heading">
          Financing &amp; interim payments
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
          Configure the contract’s financial terms and evidence checklist,
          route applications to the assigned reviewer, and track approved and
          paid amounts separately.
        </p>
      </header>

      {!ready ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          Interim payment features are not set up yet. Apply the project
          interim-payment migration in Supabase, then reload this page.
        </p>
      ) : projects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
          Financing will appear here when you have project access.
        </p>
      ) : (
        projects.map((project) => {
          const projectTerms = termsByProject.get(project.id);
          const organization = orgByProject.get(project.id);
          const projectMembers =
            organization?.members.filter(
              (member) =>
                member.status === "active" && member.role !== "client",
            ) ?? [];
          const currentMembership = organization?.members.find(
            (member) =>
              member.user_id === currentUserId && member.status === "active",
          );
          const isOwner = project.created_by === currentUserId;
          const isProjectManager =
            currentMembership?.role === "project_manager";
          const isApplicant = projectTerms?.applicant_user_id === currentUserId;
          const isApprover = projectTerms?.approver_user_id === currentUserId;
          const projectRequiredDocuments = requiredDocuments.filter(
            (document) => document.project_id === project.id,
          );
          const projectApplications = applications.filter(
            (application) => application.project_id === project.id,
          );

          return (
            <section
              aria-labelledby={`finance-project-${project.id}`}
              className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm sm:p-6"
              key={project.id}
            >
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--teal)]">
                    Project finance
                  </p>
                  <h3
                    className="mt-1 text-xl font-semibold text-[var(--navy)]"
                    id={`finance-project-${project.id}`}
                  >
                    {project.name}
                  </h3>
                </div>
                {projectTerms && (
                  <p className="rounded-full bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-900">
                    Contract:{" "}
                    {money(
                      projectTerms.contract_amount,
                      projectTerms.currency_code,
                    )}
                  </p>
                )}
              </div>

              {isOwner ? (
                <FinanceTermsForm
                  members={projectMembers}
                  projectId={project.id}
                  requiredDocuments={projectRequiredDocuments}
                  terms={projectTerms}
                />
              ) : projectTerms ? (
                <FinanceTermsSummary
                  requiredDocuments={projectRequiredDocuments}
                  terms={projectTerms}
                />
              ) : (
                <p className="rounded-lg border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
                  The project owner has not configured the contract’s finance
                  terms yet.
                </p>
              )}

              {projectTerms && (
                <>
                  {isApplicant && (
                    <NewPaymentApplicationForm
                      projectId={project.id}
                      requiredDocuments={projectRequiredDocuments}
                      terms={projectTerms}
                    />
                  )}
                  <div className="mt-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-semibold text-[var(--navy)]">
                        Interim payment applications
                      </h4>
                      <p className="text-sm text-[var(--muted)]">
                        {projectApplications.length} application
                        {projectApplications.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    {projectApplications.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-[var(--border)] p-5 text-center text-sm text-[var(--muted)]">
                        No applications have been prepared for this project.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {projectApplications.map((application) => (
                          <PaymentApplicationCard
                            application={application}
                            canManage={isOwner}
                            canReview={
                              isOwner ||
                              (application.approver_user_id === currentUserId &&
                                currentMembership?.status === "active")
                            }
                            isApplicant={
                              application.applicant_user_id === currentUserId &&
                              currentMembership?.status === "active"
                            }
                            key={application.id}
                            projectId={project.id}
                            requiredDocuments={projectRequiredDocuments}
                            terms={projectTerms}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
              {!isOwner && !isProjectManager && !isApplicant && !isApprover &&
                projectTerms && projectApplications.length === 0 && (
                  <p className="mt-4 text-sm text-[var(--muted)]">
                    You can view the finance terms, but you are not assigned to
                    prepare or approve payment applications.
                  </p>
                )}
            </section>
          );
        })
      )}
    </section>
  );
}

function FinanceTermsForm({
  projectId,
  terms,
  members,
  requiredDocuments,
}: {
  projectId: string;
  terms?: ProjectFinanceTerms;
  members: ProjectOrganisation["members"];
  requiredDocuments: ProjectPaymentRequiredDocument[];
}) {
  const [state, action] = useActionState(configureProjectFinanceAction, {});
  return (
    <details className="rounded-xl border border-[var(--border)] bg-slate-50" open={!terms}>
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--navy)]">
        {terms ? "Edit finance terms and workflow" : "Set up financing"}
      </summary>
      <form action={action} className="space-y-5 border-t border-[var(--border)] p-4">
        <input name="projectId" type="hidden" value={projectId} />
        <div>
          <h5 className="mb-3 font-semibold text-[var(--navy)]">
            Contract and claim terms
          </h5>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1.5 text-sm font-medium">
              Currency code
              <input
                autoCapitalize="characters"
                className={fieldClassName}
                defaultValue={terms?.currency_code ?? "USD"}
                maxLength={3}
                minLength={3}
                name="currencyCode"
                pattern="[A-Za-z]{3}"
                placeholder="USD"
                required
              />
            </label>
            <NumberField
              defaultValue={terms?.contract_amount}
              label="Total contract amount"
              name="contractAmount"
              required
              min="0.01"
            />
            <NumberField
              defaultValue={terms?.maximum_claim_amount}
              label="Maximum claim per application (amount)"
              name="maximumClaimAmount"
            />
            <NumberField
              defaultValue={terms?.maximum_claim_percent}
              label="OR maximum claim (% of contract)"
              name="maximumClaimPercent"
              step="0.01"
              min="0"
            />
            <label className="space-y-1.5 text-sm font-medium sm:col-span-2 lg:col-span-3">
              Interim payment clause / claim rules
              <textarea
                className="min-h-16 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
                defaultValue={terms?.interim_payment_clause ?? ""}
                maxLength={1000}
                name="interimPaymentClause"
                placeholder="Clause reference and any claim limitations"
                rows={2}
              />
            </label>
          </div>
        </div>

        <div>
          <h5 className="mb-3 font-semibold text-[var(--navy)]">
            Contract securities and adjustments
          </h5>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField
              defaultValue={terms?.performance_security_amount}
              label="Performance security (amount)"
              name="performanceSecurityAmount"
            />
            <NumberField
              defaultValue={terms?.performance_security_percent}
              label="OR performance security (%)"
              name="performanceSecurityPercent"
              step="0.01"
            />
            <label className="space-y-1.5 text-sm font-medium">
              Security expiry (optional)
              <input
                className={fieldClassName}
                defaultValue={terms?.performance_security_expiry ?? ""}
                name="performanceSecurityExpiry"
                type="date"
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium sm:col-span-2 lg:col-span-3">
              Performance security clause
              <input
                className={fieldClassName}
                defaultValue={terms?.performance_security_clause ?? ""}
                maxLength={300}
                name="performanceSecurityClause"
              />
            </label>
            <NumberField
              defaultValue={terms?.advance_payment_amount}
              label="Advance payment (amount)"
              name="advancePaymentAmount"
            />
            <NumberField
              defaultValue={terms?.advance_payment_percent}
              label="OR advance payment (%)"
              name="advancePaymentPercent"
              step="0.01"
            />
            <NumberField
              defaultValue={terms?.advance_recovery_percent}
              label="Advance recovery per claim (%)"
              name="advanceRecoveryPercent"
              step="0.01"
            />
            <label className="space-y-1.5 text-sm font-medium sm:col-span-2 lg:col-span-3">
              Advance payment / recovery clause
              <input
                className={fieldClassName}
                defaultValue={terms?.advance_payment_clause ?? ""}
                maxLength={300}
                name="advancePaymentClause"
              />
            </label>
            <NumberField
              defaultValue={terms?.retention_percent}
              label="Retention percentage"
              name="retentionPercent"
              step="0.01"
            />
            <NumberField
              defaultValue={terms?.retention_cap_amount}
              label="Retention cap (amount, optional)"
              name="retentionCapAmount"
            />
            <label className="space-y-1.5 text-sm font-medium sm:col-span-2 lg:col-span-3">
              Retention release clause
              <textarea
                className="min-h-16 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
                defaultValue={terms?.retention_release_clause ?? ""}
                maxLength={1000}
                name="retentionReleaseClause"
                rows={2}
              />
            </label>
          </div>
        </div>

        <div>
          <h5 className="mb-3 font-semibold text-[var(--navy)]">
            Application permissions and required documents
          </h5>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium">
              Member allowed to apply
              <select
                className={fieldClassName}
                defaultValue={terms?.applicant_user_id ?? ""}
                name="applicantUserId"
                required
              >
                <option disabled value="">
                  Select an active project member
                </option>
                {members.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.email}
                    {member.professional_role
                      ? ` · ${member.professional_role}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Member allowed to approve
              <select
                className={fieldClassName}
                defaultValue={terms?.approver_user_id ?? ""}
                name="approverUserId"
                required
              >
                <option disabled value="">
                  Select a different active member
                </option>
                {members.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.email}
                    {member.professional_role
                      ? ` · ${member.professional_role}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
              Required supporting documents (one per line)
              <textarea
                className="min-h-28 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
                defaultValue={requiredDocuments
                  .map((document) => document.document_name)
                  .join("\n")}
                name="requiredDocuments"
                placeholder={"Measurement sheet\nRFI register\nRFA"}
                required
                rows={4}
              />
              <span className="block text-xs font-normal text-[var(--muted)]">
                Add standard or custom document types. Applicants must attach
                at least one file for every listed type before submission.
              </span>
            </label>
          </div>
          {members.length < 2 && (
            <p className="mt-3 text-sm text-amber-900">
              Add at least two active project members to assign separate
              applicants and approvers.
            </p>
          )}
        </div>

        <div className="space-y-3">
          <SubmitButton
            disabled={members.length < 2}
            label="Save finance setup"
          />
          <AuthFeedback state={state} />
        </div>
      </form>
    </details>
  );
}

function FinanceTermsSummary({
  terms,
  requiredDocuments,
}: {
  terms: ProjectFinanceTerms;
  requiredDocuments: ProjectPaymentRequiredDocument[];
}) {
  return (
    <details className="rounded-xl border border-[var(--border)] bg-slate-50">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--navy)]">
        View contract finance terms
      </summary>
      <div className="grid gap-3 border-t border-[var(--border)] p-4 sm:grid-cols-2">
        <Term label="Contract amount" value={money(terms.contract_amount, terms.currency_code)} />
        <Term
          label="Performance security"
          value={
            terms.performance_security_amount !== null
              ? money(terms.performance_security_amount, terms.currency_code)
              : terms.performance_security_percent !== null
                ? `${terms.performance_security_percent}%`
                : "Not specified"
          }
          clause={terms.performance_security_clause}
        />
        <Term
          label="Advance payment"
          value={
            terms.advance_payment_amount !== null
              ? money(terms.advance_payment_amount, terms.currency_code)
              : terms.advance_payment_percent !== null
                ? `${terms.advance_payment_percent}%`
                : "Not specified"
          }
          clause={terms.advance_payment_clause}
        />
        <Term
          label="Retention"
          value={`${terms.retention_percent}%${terms.retention_cap_amount !== null ? ` · cap ${money(terms.retention_cap_amount, terms.currency_code)}` : ""}`}
          clause={terms.retention_release_clause}
        />
        <Term
          label="Maximum claim per application"
          value={
            terms.maximum_claim_amount !== null
              ? money(terms.maximum_claim_amount, terms.currency_code)
              : terms.maximum_claim_percent !== null
                ? `${terms.maximum_claim_percent}% of contract`
                : "No limit configured"
          }
          clause={terms.interim_payment_clause}
        />
        <div className="sm:col-span-2">
          <p className="text-sm font-semibold text-[var(--navy)]">
            Required evidence
          </p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {requiredDocuments.map((document) => (
              <li
                className="rounded-full bg-white px-3 py-1 text-xs text-[var(--foreground)]"
                key={document.id}
              >
                {document.document_name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}

function Term({
  label,
  value,
  clause,
}: {
  label: string;
  value: string;
  clause?: string;
}) {
  return (
    <div className="rounded-lg bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[var(--navy)]">{value}</p>
      {clause && <p className="mt-1 text-xs text-[var(--muted)]">{clause}</p>}
    </div>
  );
}

function NewPaymentApplicationForm({
  projectId,
  terms,
  requiredDocuments,
}: {
  projectId: string;
  terms: ProjectFinanceTerms;
  requiredDocuments: ProjectPaymentRequiredDocument[];
}) {
  const [state, action] = useActionState(savePaymentApplicationAction, {});
  const [grossClaim, setGrossClaim] = useState("");
  const [advanceRecovery, setAdvanceRecovery] = useState("0");
  const [retentionWithheld, setRetentionWithheld] = useState("0");
  const [retentionReleased, setRetentionReleased] = useState("0");
  const [otherDeductions, setOtherDeductions] = useState("0");
  const grossValue = Number(grossClaim) || 0;
  const netEstimate = Math.max(
    0,
    grossValue -
      (Number(advanceRecovery) || 0) -
      (Number(retentionWithheld) || 0) +
      (Number(retentionReleased) || 0) -
      (Number(otherDeductions) || 0),
  );
  const percentageAmount = (amount: number, percent: number) =>
    ((amount * percent) / 100).toFixed(2);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <details className="mt-5 rounded-xl border border-teal-200 bg-teal-50/60">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--navy)]">
        + Prepare interim payment application
      </summary>
      <form action={action} className="grid gap-3 border-t border-teal-200 p-4 sm:grid-cols-2">
        <input name="projectId" type="hidden" value={projectId} />
        <label className="space-y-1.5 text-sm font-medium">
          Application reference
          <input
            className={fieldClassName}
            maxLength={80}
            name="referenceNumber"
            placeholder="e.g. IPC-001"
            required
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Review due date (optional)
          <input className={fieldClassName} min={today} name="reviewDueDate" type="date" />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Period start
          <input className={fieldClassName} name="periodStart" required type="date" />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Period end
          <input className={fieldClassName} name="periodEnd" required type="date" />
        </label>
        <NumberField
          label={`Gross work claimed (${terms.currency_code})`}
          name="grossClaimAmount"
          required
          min="0.01"
          value={grossClaim}
          onChange={(value) => {
            setGrossClaim(value);
            const amount = Number(value) || 0;
            setAdvanceRecovery(
              percentageAmount(amount, terms.advance_recovery_percent),
            );
            const retention = percentageAmount(amount, terms.retention_percent);
            setRetentionWithheld(retention);
          }}
        />
        <NumberField
          label={`Advance recovery (${terms.currency_code}; ${terms.advance_recovery_percent}% suggested)`}
          name="advanceRecovery"
          value={advanceRecovery}
          onChange={setAdvanceRecovery}
        />
        <NumberField
          label={`Retention withheld (${terms.currency_code}; ${terms.retention_percent}% suggested)`}
          name="retentionWithheld"
          value={retentionWithheld}
          onChange={setRetentionWithheld}
        />
        <NumberField
          label={`Retention released (${terms.currency_code})`}
          name="retentionReleased"
          value={retentionReleased}
          onChange={setRetentionReleased}
        />
        <NumberField
          label={`Other deductions (${terms.currency_code})`}
          name="otherDeductions"
          value={otherDeductions}
          onChange={setOtherDeductions}
        />
        <div className="rounded-lg border border-teal-100 bg-white p-3 sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Estimated net application
          </p>
          <p className="mt-1 text-lg font-bold text-[var(--navy)]">
            {money(netEstimate, terms.currency_code)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Gross claim − advance recovery − retention withheld + retention
            released − other deductions. Suggested percentages can be adjusted.
            The project retention cap is checked across submitted and approved
            applications when you submit.
          </p>
        </div>
        <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
          Applicant notes
          <textarea
            className="min-h-16 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
            maxLength={2000}
            name="applicantNote"
            rows={2}
          />
        </label>
        {requiredDocuments.length > 0 && (
          <p className="text-xs leading-5 text-[var(--muted)] sm:col-span-2">
            Required before submission:{" "}
            {requiredDocuments.map((document) => document.document_name).join(", ")}.
            Save the draft first; its document checklist will then be available below.
          </p>
        )}
        <div className="space-y-3 sm:col-span-2">
          <SubmitButton label="Save application draft" />
          <AuthFeedback state={state} />
        </div>
      </form>
    </details>
  );
}

function PaymentApplicationCard({
  application,
  terms,
  requiredDocuments,
  isApplicant,
  canReview,
  canManage,
  projectId,
}: {
  application: ProjectPaymentApplication;
  terms: ProjectFinanceTerms;
  requiredDocuments: ProjectPaymentRequiredDocument[];
  isApplicant: boolean;
  canReview: boolean;
  canManage: boolean;
  projectId: string;
}) {
  const [saveState, saveAction] = useActionState(savePaymentApplicationAction, {});
  const [uploadState, uploadAction] = useActionState(
    uploadPaymentApplicationDocumentAction,
    {},
  );
  const [submitState, submitAction] = useActionState(
    submitPaymentApplicationAction,
    {},
  );
  const [reviewState, reviewAction] = useActionState(
    reviewPaymentApplicationAction,
    {},
  );
  const [reverseState, reverseAction] = useActionState(
    reversePaymentApprovalAction,
    {},
  );
  const [paymentState, paymentAction] = useActionState(
    recordProjectPaymentAction,
    {},
  );

  const isEditable =
    isApplicant &&
    (application.status === "draft" ||
      application.status === "changes_requested");
  const totalPaid = application.payments.reduce(
    (total, payment) => total + payment.amount,
    0,
  );
  const balance = Math.max(0, application.net_amount - totalPaid);
  const dueDate = application.review_due_date;
  const isOverdue =
    dueDate !== null &&
    dueDate !== undefined &&
    new Date(`${dueDate}T23:59:59`) < new Date() &&
    ["draft", "submitted", "changes_requested"].includes(application.status);

  return (
    <article
      className="rounded-xl border border-[var(--border)] bg-white p-4 sm:p-5"
      data-payment-statement
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--teal)]">
            {application.reference_number}
          </p>
          <h5 className="mt-1 font-semibold text-[var(--navy)]">
            {dateLabel(application.period_start)} – {dateLabel(application.period_end)}
          </h5>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Submitted {new Date(application.created_at).toLocaleDateString()}
            {dueDate ? ` · Review due ${dateLabel(dueDate)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[application.status]}`}
          >
            {isOverdue ? "Overdue · " : ""}
            {statusLabels[application.status]}
          </span>
          <button
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--navy)] hover:bg-slate-50 print:hidden"
            onClick={() => window.print()}
            type="button"
          >
            Print statement
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Amount label="Gross claim" value={application.gross_claim_amount} terms={terms} />
        <Amount label="Advance recovery" value={application.advance_recovery} terms={terms} />
        <Amount label="Retention withheld" value={application.retention_withheld} terms={terms} />
        <Amount label="Retention released" value={application.retention_released} terms={terms} />
        <Amount label="Other deductions" value={application.other_deductions} terms={terms} />
        <Amount label="Net amount assessed" value={application.net_amount} terms={terms} strong />
        <Amount label="Paid to date" value={totalPaid} terms={terms} />
        <Amount label="Payment balance" value={balance} terms={terms} strong />
      </div>

      {application.applicant_note && (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-5 text-[var(--foreground)]">
          <strong>Applicant note:</strong> {application.applicant_note}
        </p>
      )}
      {application.review_note && (
        <p className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950">
          <strong>Review feedback:</strong> {application.review_note}
        </p>
      )}
      {application.reversal_reason && (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-950">
          <strong>Approval reversal:</strong> {application.reversal_reason}
        </p>
      )}

      {application.documents.length > 0 && (
        <div className="mt-4 rounded-lg bg-slate-50 p-3">
          <h6 className="text-sm font-semibold text-[var(--navy)]">
            Supporting documents
          </h6>
          <ul className="mt-2 space-y-2">
            {application.documents.map((document) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
                key={document.id}
              >
                <span>
                  <strong>{document.document_type}:</strong> {document.file_name}
                  <span className="ml-1 text-xs text-[var(--muted)]">
                    {document.uploaded_by_email
                      ? `· ${document.uploaded_by_email} · `
                      : "· "}
                    {new Date(document.created_at).toLocaleString()}
                  </span>
                </span>
                <a
                  className="font-medium text-[var(--teal-dark)] underline underline-offset-2"
                  href={`/api/project-payment-documents/${document.id}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isEditable && (
        <>
          <details className="mt-4 rounded-lg border border-[var(--border)] bg-slate-50 print:hidden">
            <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-[var(--navy)]">
              Edit draft and claim calculations
            </summary>
            <form
              action={saveAction}
              className="grid gap-3 border-t border-[var(--border)] p-3 sm:grid-cols-2"
            >
              <input name="applicationId" type="hidden" value={application.id} />
              <input name="projectId" type="hidden" value={projectId} />
                    <label className="space-y-1.5 text-sm font-medium">
                      Review due date (optional)
                      <input
                        className={fieldClassName}
                        defaultValue={application.review_due_date ?? ""}
                        name="reviewDueDate"
                        type="date"
                      />
                    </label>
              <label className="space-y-1.5 text-sm font-medium">
                Application reference
                <input
                  className={fieldClassName}
                  defaultValue={application.reference_number}
                  maxLength={80}
                  name="referenceNumber"
                  required
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Period start
                <input
                  className={fieldClassName}
                  defaultValue={application.period_start}
                  name="periodStart"
                  required
                  type="date"
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Period end
                <input
                  className={fieldClassName}
                  defaultValue={application.period_end}
                  name="periodEnd"
                  required
                  type="date"
                />
              </label>
              <NumberField
                defaultValue={application.gross_claim_amount}
                label="Gross claim"
                name="grossClaimAmount"
                required
                min="0.01"
              />
              <NumberField
                defaultValue={application.advance_recovery}
                label="Advance recovery"
                name="advanceRecovery"
              />
              <NumberField
                defaultValue={application.retention_withheld}
                label="Retention withheld"
                name="retentionWithheld"
              />
              <NumberField
                defaultValue={application.retention_released}
                label="Retention released"
                name="retentionReleased"
              />
              <NumberField
                defaultValue={application.other_deductions}
                label="Other deductions"
                name="otherDeductions"
              />
              <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
                Applicant notes
                <textarea
                  className="min-h-16 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  defaultValue={application.applicant_note}
                  maxLength={2000}
                  name="applicantNote"
                  rows={2}
                />
              </label>
              <div className="space-y-3 sm:col-span-2">
                <SubmitButton label="Save changes" />
                <AuthFeedback state={saveState} />
              </div>
            </form>
          </details>

          <form
            action={uploadAction}
            className="mt-3 grid gap-3 rounded-lg bg-teal-50 p-3 sm:grid-cols-[1fr_1.5fr_auto] print:hidden"
          >
            <input name="applicationId" type="hidden" value={application.id} />
            <label className="space-y-1.5 text-sm font-medium">
              Required document type
              <select className={fieldClassName} name="documentType" required>
                <option disabled value="">
                  Select document type
                </option>
                {requiredDocuments.map((document) => (
                  <option key={document.id} value={document.document_name}>
                    {document.document_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Supporting document (max 10 MB)
              <input
                accept={fileAccept}
                className="block w-full text-sm text-[var(--muted)] file:mr-2 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-medium file:text-[var(--navy)]"
                name="file"
                required
                type="file"
              />
            </label>
            <div className="space-y-2 self-end">
              <SubmitButton label="Attach" />
            </div>
            <div className="sm:col-span-3">
              <AuthFeedback state={uploadState} />
            </div>
          </form>

          <form action={submitAction} className="mt-3 space-y-3 rounded-lg border border-teal-200 p-3 print:hidden">
            <input name="applicationId" type="hidden" value={application.id} />
            <MissingDocuments
              application={application}
              requiredDocuments={requiredDocuments}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--muted)]">
                Submitting locks this application until the approver responds.
              </p>
              <SubmitButton label="Submit for approval" />
            </div>
            <AuthFeedback state={submitState} />
          </form>
        </>
      )}

      {canReview && application.status === "submitted" && (
        <form
          action={reviewAction}
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 print:hidden"
        >
          <h6 className="font-semibold text-[var(--navy)]">Review application</h6>
          <label className="mt-3 block space-y-1.5 text-sm font-medium">
            Review comments (required when requesting changes)
            <textarea
              className="min-h-20 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
              maxLength={2000}
              name="reviewNote"
              rows={3}
            />
          </label>
          <input name="applicationId" type="hidden" value={application.id} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-lg bg-[var(--teal)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              name="decision"
              value="approve"
            >
              Approve assessment
            </button>
            <button
              className="rounded-lg border border-orange-300 bg-white px-4 py-2.5 text-sm font-semibold text-orange-900 hover:bg-orange-50"
              name="decision"
              value="request_changes"
            >
              Return for changes
            </button>
          </div>
          <div className="mt-3">
            <AuthFeedback state={reviewState} />
          </div>
        </form>
      )}

      {canManage && application.status === "approved" && (
        <details className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 print:hidden">
          <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-emerald-950">
            Record a payment or reverse approval
          </summary>
          <div className="grid gap-4 border-t border-emerald-200 p-3 lg:grid-cols-2">
            {balance > 0 && (
              <form action={paymentAction} className="space-y-3">
                <input name="applicationId" type="hidden" value={application.id} />
                <p className="text-sm font-semibold text-[var(--navy)]">
                  Remaining approved balance: {money(balance, terms.currency_code)}
                </p>
                <NumberField
                  label="Amount paid"
                  name="amount"
                  required
                  min="0.01"
                />
                <label className="block space-y-1.5 text-sm font-medium">
                  Payment date
                  <input
                    className={fieldClassName}
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    name="paidAt"
                    required
                    type="date"
                  />
                </label>
                <label className="block space-y-1.5 text-sm font-medium">
                  Bank / payment reference
                  <input
                    className={fieldClassName}
                    maxLength={100}
                    name="paymentReference"
                    required
                  />
                </label>
                <label className="block space-y-1.5 text-sm font-medium">
                  Note (optional)
                  <input className={fieldClassName} maxLength={1000} name="note" />
                </label>
                <SubmitButton label="Record payment" />
                <AuthFeedback state={paymentState} />
              </form>
            )}
            <form action={reverseAction} className="space-y-3">
              <input name="applicationId" type="hidden" value={application.id} />
              <p className="text-sm leading-5 text-[var(--muted)]">
                Approval reversal preserves the original assessment and requires
                a reason. It is not available after any payment has been recorded.
              </p>
              <label className="block space-y-1.5 text-sm font-medium">
                Reversal reason
                <textarea
                  className="min-h-20 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  maxLength={1000}
                  minLength={2}
                  name="reason"
                  required
                  rows={3}
                />
              </label>
              <SubmitButton label="Reverse approval" />
              <AuthFeedback state={reverseState} />
            </form>
          </div>
        </details>
      )}

      {application.payments.length > 0 && (
        <div className="mt-4 rounded-lg bg-slate-50 p-3">
          <h6 className="text-sm font-semibold text-[var(--navy)]">
            Recorded payments
          </h6>
          <ul className="mt-2 space-y-1.5 text-sm">
            {application.payments.map((payment) => (
              <li className="flex flex-wrap justify-between gap-2" key={payment.id}>
                <span>
                  {dateLabel(payment.paid_at)} · {payment.payment_reference}
                  {payment.recorded_by_email
                    ? ` · Recorded by ${payment.recorded_by_email}`
                    : ""}
                </span>
                <strong>{money(payment.amount, terms.currency_code)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="mt-4" data-payment-history>
        <summary className="cursor-pointer text-sm font-semibold text-[var(--navy)]">
          Decision and version history ({application.history.length})
        </summary>
        <ol className="mt-2 space-y-2 border-l-2 border-slate-200 pl-4">
          {application.history.map((entry) => (
            <li className="text-sm" key={entry.id}>
              <p className="font-medium text-[var(--navy)]">
                {entry.action.replaceAll("_", " ")}
                {entry.actor_email ? ` · ${entry.actor_email}` : ""}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {new Date(entry.created_at).toLocaleString()}
                {entry.new_status ? ` · ${entry.new_status.replaceAll("_", " ")}` : ""}
                {entry.amount !== null
                  ? ` · ${money(entry.amount, terms.currency_code)}`
                  : ""}
              </p>
              {entry.note && (
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--muted)]">
                  {entry.note}
                </p>
              )}
            </li>
          ))}
        </ol>
      </details>
    </article>
  );
}

function Amount({
  label,
  value,
  terms,
  strong = false,
}: {
  label: string;
  value: number;
  terms: ProjectFinanceTerms;
  strong?: boolean;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p
        className={
          strong
            ? "mt-1 text-sm font-bold text-[var(--navy)]"
            : "mt-1 text-sm font-medium text-[var(--navy)]"
        }
      >
        {money(value, terms.currency_code)}
      </p>
    </div>
  );
}

function MissingDocuments({
  application,
  requiredDocuments,
}: {
  application: ProjectPaymentApplication;
  requiredDocuments: ProjectPaymentRequiredDocument[];
}) {
  const uploadedTypes = new Set(
    application.documents.map((document) => document.document_type),
  );
  const missing = requiredDocuments.filter(
    (document) => !uploadedTypes.has(document.document_name),
  );
  return (
    <p
      className={
        missing.length > 0
          ? "text-sm text-amber-900"
          : "text-sm font-medium text-emerald-800"
      }
    >
      {missing.length > 0
        ? `Still required: ${missing.map((document) => document.document_name).join(", ")}.`
        : "All required supporting document types are attached."}
    </p>
  );
}
