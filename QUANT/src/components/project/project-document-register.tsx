"use client";

import { useActionState } from "react";
import {
  addProjectDocumentVersionAction,
  createProjectDocumentAction,
} from "@/app/project-documents/actions";
import { AuthFeedback } from "@/components/auth/auth-feedback";
import { SubmitButton } from "@/components/auth/submit-button";
import type { ProjectDocument } from "@/lib/project-document-types";

const fieldClassName =
  "h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)]";

const fileAccept =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/jpeg,image/png,text/plain";

function formatFileSize(fileSize: number) {
  return fileSize < 1024 * 1024
    ? `${Math.max(1, Math.round(fileSize / 1024))} KB`
    : `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function ProjectDocumentRegister({
  projectId,
  documents,
  canUpload,
  storageReady,
}: {
  projectId: string;
  documents: ProjectDocument[];
  canUpload: boolean;
  storageReady: boolean;
}) {
  const [createState, createAction] = useActionState(
    createProjectDocumentAction,
    {},
  );

  return (
    <section
      aria-label="Project document register"
      className="mt-6 border-t border-[var(--border)] pt-5"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h4 className="font-semibold text-[var(--navy)]">
            Project document register
          </h4>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {documents.length} {documents.length === 1 ? "document" : "documents"}
          </p>
        </div>
      </div>

      {!storageReady ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          The document register is not set up yet. Apply the project document
          register migration listed in the README and reload this page.
        </p>
      ) : (
        <>
          {canUpload && (
            <details className="rounded-lg border border-[var(--border)] bg-slate-50">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-[var(--navy)]">
                Add a document
              </summary>
              <form
                action={createAction}
                className="grid gap-3 border-t border-[var(--border)] p-4 sm:grid-cols-2"
              >
                <input name="projectId" type="hidden" value={projectId} />
                <label className="space-y-1.5 text-sm font-medium">
                  Document title
                  <input
                    className={fieldClassName}
                    maxLength={200}
                    minLength={2}
                    name="title"
                    placeholder="e.g. Site layout plan"
                    required
                  />
                </label>
                <label className="space-y-1.5 text-sm font-medium">
                  Reference number (optional)
                  <input
                    className={fieldClassName}
                    maxLength={100}
                    name="referenceNumber"
                    placeholder="e.g. DWG-001"
                  />
                </label>
                <label className="space-y-1.5 text-sm font-medium">
                  Category
                  <select
                    className={fieldClassName}
                    defaultValue="Drawing"
                    name="category"
                  >
                    <option>Contract</option>
                    <option>Drawing</option>
                    <option>Specification</option>
                    <option>Report</option>
                    <option>Correspondence</option>
                    <option>Other</option>
                  </select>
                </label>
                <label className="space-y-1.5 text-sm font-medium">
                  File (up to 10 MB)
                  <input
                    accept={fileAccept}
                    className="block w-full text-sm text-[var(--muted)] file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--navy)]"
                    name="file"
                    required
                    type="file"
                  />
                </label>
                <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
                  Description (optional)
                  <textarea
                    className="min-h-20 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"
                    maxLength={1000}
                    name="description"
                    rows={3}
                  />
                </label>
                <div className="space-y-3 sm:col-span-2">
                  <SubmitButton label="Add to register" />
                  <AuthFeedback state={createState} />
                </div>
              </form>
            </details>
          )}

          {documents.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--muted)]">
              No documents have been added to this project yet.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {documents.map((document) => (
                <article
                  className="rounded-lg border border-[var(--border)] bg-white p-4"
                  key={document.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h5 className="font-medium text-[var(--navy)]">
                        {document.title}
                      </h5>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {document.category}
                        {document.reference_number
                          ? ` · Ref ${document.reference_number}`
                          : ""}
                        {document.description
                          ? ` · ${document.description}`
                          : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-[var(--muted)]">
                      {document.versions.length}{" "}
                      {document.versions.length === 1 ? "version" : "versions"}
                    </span>
                  </div>

                  {document.versions.length > 0 && (
                    <ol className="mt-3 divide-y divide-[var(--border)]">
                      {document.versions.map((version) => (
                        <li
                          className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm"
                          key={version.id}
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--foreground)]">
                              Version {version.version_number} ·{" "}
                              {version.file_name}
                            </p>
                            <p className="mt-0.5 text-xs text-[var(--muted)]">
                              {formatFileSize(version.file_size)} ·{" "}
                              {formatDate(version.created_at)}
                              {version.uploaded_by_email
                                ? ` · ${version.uploaded_by_email}`
                                : ""}
                            </p>
                          </div>
                          <a
                            className="shrink-0 font-medium text-[var(--teal-dark)] underline underline-offset-2"
                            href={`/api/project-documents/${version.id}`}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Download
                          </a>
                        </li>
                      ))}
                    </ol>
                  )}

                  {canUpload && (
                    <DocumentVersionUploadForm documentId={document.id} />
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function DocumentVersionUploadForm({ documentId }: { documentId: string }) {
  const [state, action] = useActionState(
    addProjectDocumentVersionAction,
    {},
  );

  return (
    <details className="mt-3 rounded-lg bg-slate-50">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-[var(--teal-dark)]">
        Upload a new version
      </summary>
      <form
        action={action}
        className="flex flex-col gap-3 border-t border-[var(--border)] p-3 sm:flex-row sm:items-end"
      >
        <input name="documentId" type="hidden" value={documentId} />
        <label className="min-w-0 flex-1 space-y-1.5 text-sm font-medium">
          Replacement file (up to 10 MB)
          <input
            accept={fileAccept}
            className="block w-full text-sm text-[var(--muted)] file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--navy)]"
            name="file"
            required
            type="file"
          />
        </label>
        <div className="space-y-3 sm:w-48">
          <SubmitButton label="Upload version" />
          <AuthFeedback state={state} />
        </div>
      </form>
    </details>
  );
}
