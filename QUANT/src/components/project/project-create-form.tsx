"use client";

import { useActionState, useState } from "react";
import { createProjectAction } from "@/app/organisation/actions";
import { AuthFeedback } from "@/components/auth/auth-feedback";
import { SubmitButton } from "@/components/auth/submit-button";

const fieldClassName =
  "h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)] placeholder:text-slate-400";

const contractTypes = ["PPRA", "NCC", "FIDIC", "NEC", "JCT"];
const deliveryModes = [
  "Design and build",
  "Traditional (design-bid-build)",
  "Construction management",
  "EPC / turnkey",
];

export function ProjectCreateForm() {
  const [state, action] = useActionState(createProjectAction, {});
  const [contractType, setContractType] = useState(contractTypes[0]);
  const [deliveryMode, setDeliveryMode] = useState(deliveryModes[0]);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label
        className="block space-y-1.5 text-sm font-medium sm:col-span-2"
        htmlFor="project-name"
      >
        Project name
        <input
          autoComplete="off"
          className={fieldClassName}
          id="project-name"
          maxLength={100}
          minLength={2}
          name="name"
          placeholder="e.g. North District Hospital"
          required
        />
      </label>

      <label
        className="block space-y-1.5 text-sm font-medium"
        htmlFor="project-contract-type"
      >
        Contract form
        <select
          className={fieldClassName}
          id="project-contract-type"
          name="contractType"
          onChange={(event) => setContractType(event.target.value)}
          value={contractType}
        >
          {contractTypes.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value="other">Other</option>
        </select>
      </label>
      <label
        className="block space-y-1.5 text-sm font-medium"
        htmlFor="project-delivery-mode"
      >
        Delivery mode
        <select
          className={fieldClassName}
          id="project-delivery-mode"
          name="deliveryMode"
          onChange={(event) => setDeliveryMode(event.target.value)}
          value={deliveryMode}
        >
          {deliveryModes.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value="other">Other</option>
        </select>
      </label>

      {contractType === "other" && (
        <label
          className="block space-y-1.5 text-sm font-medium"
          htmlFor="contract-type-other"
        >
          Other contract form
          <input
            className={fieldClassName}
            id="contract-type-other"
            maxLength={100}
            minLength={2}
            name="contractTypeOther"
            required
          />
        </label>
      )}
      {deliveryMode === "other" && (
        <label
          className="block space-y-1.5 text-sm font-medium"
          htmlFor="delivery-mode-other"
        >
          Other delivery mode
          <input
            className={fieldClassName}
            id="delivery-mode-other"
            maxLength={100}
            minLength={2}
            name="deliveryModeOther"
            required
          />
        </label>
      )}

      <div className="space-y-3 sm:col-span-2">
        <SubmitButton label="Create project" />
        <AuthFeedback state={state} />
      </div>
    </form>
  );
}
