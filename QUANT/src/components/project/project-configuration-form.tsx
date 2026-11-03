"use client";

import { useActionState, useState } from "react";
import { updateProjectConfigurationAction } from "@/app/organisation/actions";
import { AuthFeedback } from "@/components/auth/auth-feedback";
import { SubmitButton } from "@/components/auth/submit-button";
import type { Project } from "@/components/project/project-workspace";

const fieldClassName =
  "h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)]";

const contractTypes = ["PPRA", "NCC", "FIDIC", "NEC", "JCT"];
const deliveryModes = [
  "Design and build",
  "Traditional (design-bid-build)",
  "Construction management",
  "EPC / turnkey",
];

export function ProjectConfigurationForm({ project }: { project: Project }) {
  const [state, action] = useActionState(
    updateProjectConfigurationAction,
    {},
  );
  const [deliveryMode, setDeliveryMode] = useState(
    deliveryModes.includes(project.delivery_mode)
      ? project.delivery_mode
      : "other",
  );

  return (
    <details className="rounded-lg border border-[var(--border)] bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--navy)]">
        Edit project configuration
      </summary>
      <form
        action={action}
        className="grid gap-4 border-t border-[var(--border)] p-4 sm:grid-cols-2"
      >
        <input name="projectId" type="hidden" value={project.id} />
        <input
          name="contractType"
          type="hidden"
          value={
            contractTypes.includes(project.contract_type)
              ? project.contract_type
              : "other"
          }
        />
        {!contractTypes.includes(project.contract_type) && (
          <input
            name="contractTypeOther"
            type="hidden"
            value={project.contract_type}
          />
        )}
        <label
          className="block space-y-1.5 text-sm font-medium sm:col-span-2"
          htmlFor={`project-name-${project.id}`}
        >
          Project name
          <input
            className={fieldClassName}
            defaultValue={project.name}
            id={`project-name-${project.id}`}
            maxLength={100}
            minLength={2}
            name="name"
            required
          />
        </label>
        <div className="space-y-1.5 text-sm">
          <p className="font-medium">Contract form (locked)</p>
          <p className="rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-3 text-[var(--muted)]">
            {project.contract_type} · Cannot be changed after project setup
          </p>
        </div>
        <label
          className="block space-y-1.5 text-sm font-medium"
          htmlFor={`project-delivery-${project.id}`}
        >
          Delivery mode
          <select
            className={fieldClassName}
            id={`project-delivery-${project.id}`}
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
        {deliveryMode === "other" && (
          <label
            className="block space-y-1.5 text-sm font-medium"
            htmlFor={`project-delivery-other-${project.id}`}
          >
            Other delivery mode
            <input
              className={fieldClassName}
              defaultValue={
                deliveryModes.includes(project.delivery_mode)
                  ? ""
                  : project.delivery_mode
              }
              id={`project-delivery-other-${project.id}`}
              maxLength={100}
              minLength={2}
              name="deliveryModeOther"
              required
            />
          </label>
        )}
        <div className="space-y-3 sm:col-span-2">
          <SubmitButton label="Save configuration" />
          <AuthFeedback state={state} />
        </div>
      </form>
    </details>
  );
}
