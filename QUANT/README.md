# Construction Project Administration

This is an incrementally developed construction project management and contract
administration application. It is one integrated platform with
platform, organisation, and project contexts.

## Current stage: project controls and interim payments

The application foundation includes Supabase-backed registration, sign-in,
sign-out, email confirmation callbacks, and password recovery. These features
require a configured Supabase project. Clients create projects, choose the
contract form and delivery mode, set up the project's organisation, and
appoint project managers. Clients and project managers can invite members and
manage their project roles.

Common contract forms and delivery modes are provided, with an `Other` option
for project-specific values. The client creates the project and its contract
form becomes immutable after creation. The client can assign project managers;
clients and project managers can invite team members and assign or update their
project access and professional roles. No organisation owner or admin role is
used for project permissions.

The project and organisation records use Row Level Security and database
functions for authorization. Clients can update the project name and delivery
mode, but cannot change the contract form after project creation. Project
managers can manage team invitations, roles, tasks, and task reviews, but
cannot appoint another project manager. Team members can view project
information and submit work for tasks assigned to them. Professional titles
identify a member's discipline and do not grant extra application permissions.

Each project now has a shared document register. Clients and project managers
can upload contract files, drawings, specifications, reports, correspondence,
and other project records. Each new upload can be added as a version, retaining
earlier versions in the register. Files are stored in a private Supabase
Storage bucket; active project members can view and download them, while only
clients and assigned project managers can upload.

The task board has two workflows. In the management workflow, clients and
project managers assign work to a team member and review the submission.
Clients, project managers, and members can also assign a task to another active
project member; in this workflow, the assigning member or project management
can review the submission. Reviewers can accept a submission to complete the
task or request changes with feedback; the member can then upload a revised
submission. Submission files are kept in private project storage, and earlier
submissions remain available in the task history.

Clients and assigned project managers use `/owner` to set up projects, manage
their teams, maintain project documents, and review tasks. Invited team
members use `/member` to view assigned projects and documents and to submit
their assigned tasks. Both portals provide a collapsible workspace menu that
switches between a circular-metric home dashboard, projects, and tasks.
Members can browse every project where they have active membership and can
create a project of their own; creators can manage that project in the owner
portal.
Invitation links are verified by the browser confirmation page, pending
membership is activated after confirmation, and new invitees set a password
before entering the member portal. `/home` routes signed-in users to the
appropriate portal.

Project managers can create milestones with planned dates and an assigned
active member. The responsible member can submit progress notes and a percentage,
optionally with private document or photo evidence. Project managers review
updates or request changes; approved progress updates the project milestone.
Both portals include a milestone workspace and a project-progress dashboard
metric.

The workspace notification center records project task, document, milestone,
event, membership, invitation, role, and payment activity. Notifications are
private to each recipient and can be marked read individually or together.
Project managers can also publish announcements and schedule meetings, site
visits, and other project events for the active team.

The Financing workspace lets the project owner record contract and payment
terms, assign an application preparer and approver, and define the evidence
required for each claim. The assigned preparer drafts and submits interim
payment applications with supporting documents; the approver assesses them or
requests changes. The owner can record one or more payments against an approved
claim, reverse an approval before payment, review application history, and
print a payment statement. Home dashboards compare recorded payments with the
contract amount; approved claims are not counted as paid until a payment is
recorded.

Supporting files are stored in the private project documents bucket and limited
to 10 MB. Apply all migrations before using their features. This stage is not
production-ready.

## Run locally

Requirements: Node.js 20.9 or later and npm.

1. Copy `.env.example` to `.env.local` if it does not already exist.
2. Set the Supabase project URL, publishable key, and site URL in `.env.local`.
3. Set `SUPABASE_SECRET_KEY` to the server-side secret key from Supabase. The
   legacy `SUPABASE_SERVICE_ROLE_KEY` name is also supported. This key is
   required to send account invitation emails and securely finish invitation
   password setup. Keep it server-only: never use a `NEXT_PUBLIC_` prefix or
   commit the value.
4. In Supabase Authentication URL Configuration, set the local site URL to
   `http://localhost:3000` and allow `http://localhost:3000/**` as a redirect.
   Configure Supabase Auth email delivery (SMTP). The default Supabase
   confirmation and invitation email templates can be used; no email-template
   edit is required. The app handles the confirmation tokens returned in the
   browser URL. Ensure the allowed redirect URLs include
   `http://localhost:3000/auth/confirm` (or use
   `http://localhost:3000/**` for local development). If Supabase email
   delivery is rate-limited, a client or project manager can create a shareable
   invitation link in the owner portal and send it privately. Treat that link
   like a one-time sign-in credential and share it only with the intended member.
5. In the Supabase SQL Editor, run these migrations in order:
   - `supabase/migrations/20261101100000_organisations_and_memberships.sql`
   - `supabase/migrations/20261101120000_projects_and_email_invitations.sql`
   - `supabase/migrations/20261101130000_fix_membership_role_checks.sql`
   - `supabase/migrations/20261101140000_member_professional_roles.sql`
   - `supabase/migrations/20261101150000_project_configuration_permissions.sql`
   - `supabase/migrations/20261101160000_client_project_manager_roles.sql`
   - `supabase/migrations/20261103170000_project_document_register.sql`
   - `supabase/migrations/20261103180000_project_task_workflow.sql`
   - `supabase/migrations/20261103190000_member_task_delegation.sql`
   - `supabase/migrations/20261103194000_owner_task_assignment.sql`
   - `supabase/migrations/20261103195000_project_milestones_activity_events.sql`
   - `supabase/migrations/20261103196000_project_interim_payments.sql`
   They create the organisation and project tables, access policies, and
   authorization functions. If earlier migrations were already applied, run
   only the migrations that have not yet succeeded. The professional-role
   migration adds the field used to record a member's professional role, which
   the client or project manager assigns during invitation.
   The project-configuration migration adds editable settings, restricted to
   the client, while locking the contract form. The client/project-manager
   migration changes
   access to client/project-manager/project-member roles and enables assigned
   team roles. The document-register migration creates the private storage
   bucket, project document records, revision history, and upload access rules.
   The project-task migration creates task assignments, member submissions,
   reviewer decisions, and the task upload access rules. Apply it after the
   document-register migration. The member-task-delegation migration keeps
   management-assigned tasks and adds the separate member-delegation workflow.
   The owner-task-assignment migration lets clients and project managers also
   assign tasks through that second workflow. The milestones/activity/events
   migration adds reviewed progress updates and attachments, project
   announcements and scheduled events, recipient-specific notifications, and
   activity triggers. Apply it after the owner-task-assignment migration. The
   interim-payment migration adds contract finance terms, application evidence
   and review history, payment transactions, dashboard totals, and payment
   activity notifications. Apply it after the milestones/activity/events
   migration.
   Do not rerun migrations that have already succeeded.
6. In this directory, run `npm run dev` and open `http://localhost:3000`.

## Deploying on Vercel

Set `NEXT_PUBLIC_SITE_URL` to the deployed site URL in the Vercel project
environment variables, for example `https://your-project.vercel.app`. If it is
unset or still points to localhost, authentication, invitation, and shareable
invitation links use Vercel's production domain automatically (or the current
deployment URL if no production domain is available). In Supabase
Authentication URL Configuration, set the Site URL to the deployed URL and add
`https://your-project.vercel.app/**` to the allowed redirect URLs. Replace the
example domain with your Vercel or custom domain.

The publishable key is intended for use in the application, but it does not
replace authorization policies. Apply all database migrations before using
their features. The milestone, event, notification, and financing workflows
remain unavailable until their migrations are applied in Supabase.

## Checks

- `npm run lint` runs ESLint.
- `npm run build` performs a production build and TypeScript check.

## Planned implementation order

1. Application and authentication foundation — implemented.
2. Project, contract-form, delivery-mode, and organisation setup — initial
   implementation.
3. Project participation, invitations, professional roles, and portal access —
   initial implementation.
4. Project configuration and client / project-manager permissions — initial
   implementation.
5. Milestone and project progress reporting — initial implementation.
6. Workspace notifications and project events — initial implementation.
7. Interim Payment Application and Assessment — initial implementation.
8. Additional project workflows.

Features not available yet must be described as planned, not operational.
