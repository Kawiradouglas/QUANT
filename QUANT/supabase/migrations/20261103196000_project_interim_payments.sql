create table public.project_finance_terms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  currency_code text not null default 'USD'
    check (currency_code ~ '^[A-Z]{3}$'),
  contract_amount numeric(14, 2) not null check (contract_amount > 0),
  performance_security_amount numeric(14, 2)
    check (performance_security_amount is null or performance_security_amount >= 0),
  performance_security_percent numeric(7, 4)
    check (performance_security_percent is null
      or performance_security_percent between 0 and 100),
  performance_security_clause text not null default ''
    check (char_length(performance_security_clause) <= 300),
  performance_security_expiry date,
  advance_payment_amount numeric(14, 2)
    check (advance_payment_amount is null or advance_payment_amount >= 0),
  advance_payment_percent numeric(7, 4)
    check (advance_payment_percent is null
      or advance_payment_percent between 0 and 100),
  advance_recovery_percent numeric(7, 4) not null default 0
    check (advance_recovery_percent between 0 and 100),
  advance_payment_clause text not null default ''
    check (char_length(advance_payment_clause) <= 300),
  retention_percent numeric(7, 4) not null default 0
    check (retention_percent between 0 and 100),
  retention_cap_amount numeric(14, 2)
    check (retention_cap_amount is null or retention_cap_amount >= 0),
  retention_release_clause text not null default ''
    check (char_length(retention_release_clause) <= 1000),
  maximum_claim_amount numeric(14, 2)
    check (maximum_claim_amount is null or maximum_claim_amount > 0),
  maximum_claim_percent numeric(7, 4)
    check (maximum_claim_percent is null
      or maximum_claim_percent between 0 and 100),
  interim_payment_clause text not null default ''
    check (char_length(interim_payment_clause) <= 1000),
  applicant_user_id uuid not null references auth.users(id) on delete restrict,
  approver_user_id uuid not null references auth.users(id) on delete restrict,
  configured_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    performance_security_amount is null
    or performance_security_percent is null
  ),
  check (
    advance_payment_amount is null
    or advance_payment_percent is null
  ),
  check (
    maximum_claim_amount is null
    or maximum_claim_percent is null
  )
);

create table public.project_payment_required_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  document_name text not null check (char_length(document_name) between 2 and 100),
  created_at timestamptz not null default now(),
  unique (project_id, document_name)
);

create index project_payment_required_documents_project_idx
  on public.project_payment_required_documents (project_id, document_name);

create table public.project_payment_applications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  finance_terms_id uuid not null
    references public.project_finance_terms(id) on delete restrict,
  reference_number text not null check (char_length(reference_number) between 1 and 80),
  period_start date not null,
  period_end date not null,
  gross_claim_amount numeric(14, 2) not null check (gross_claim_amount > 0),
  advance_recovery numeric(14, 2) not null default 0 check (advance_recovery >= 0),
  retention_withheld numeric(14, 2) not null default 0 check (retention_withheld >= 0),
  retention_released numeric(14, 2) not null default 0 check (retention_released >= 0),
  other_deductions numeric(14, 2) not null default 0 check (other_deductions >= 0),
  net_amount numeric(14, 2) generated always as (
    gross_claim_amount - advance_recovery - retention_withheld
      + retention_released - other_deductions
  ) stored,
  applicant_user_id uuid not null references auth.users(id) on delete restrict,
  approver_user_id uuid not null references auth.users(id) on delete restrict,
  review_due_date date,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'changes_requested', 'approved', 'reversed')),
  applicant_note text not null default ''
    check (char_length(applicant_note) <= 2000),
  review_note text not null default ''
    check (char_length(review_note) <= 2000),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  reversed_by uuid references auth.users(id) on delete restrict,
  reversed_at timestamptz,
  reversal_reason text not null default ''
    check (char_length(reversal_reason) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  check (net_amount >= 0),
  unique (project_id, period_start, period_end),
  unique (project_id, reference_number)
);

create index project_payment_applications_project_idx
  on public.project_payment_applications (project_id, created_at desc);
create index project_payment_applications_applicant_idx
  on public.project_payment_applications (applicant_user_id, status);
create index project_payment_applications_approver_idx
  on public.project_payment_applications (approver_user_id, status);

create table public.project_payment_application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null
    references public.project_payment_applications(id) on delete cascade,
  document_type text not null
    check (char_length(document_type) between 2 and 100),
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200),
  content_type text not null,
  file_size integer not null check (file_size between 1 and 10485760),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  uploaded_by_email text,
  created_at timestamptz not null default now()
);

create index project_payment_application_documents_application_idx
  on public.project_payment_application_documents (application_id, created_at);

create table public.project_payment_application_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null
    references public.project_payment_applications(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_email text,
  action text not null check (char_length(action) between 2 and 40),
  note text not null default '' check (char_length(note) <= 2000),
  previous_status text,
  new_status text,
  amount numeric(14, 2),
  created_at timestamptz not null default now()
);

create index project_payment_application_history_idx
  on public.project_payment_application_history (application_id, created_at);

create table public.project_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null
    references public.project_payment_applications(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  paid_at date not null,
  payment_reference text not null
    check (char_length(payment_reference) between 1 and 100),
  note text not null default '' check (char_length(note) <= 1000),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_by_email text,
  created_at timestamptz not null default now()
);

create index project_payment_transactions_application_idx
  on public.project_payment_transactions (application_id, paid_at desc);

alter table public.project_finance_terms enable row level security;
alter table public.project_payment_required_documents enable row level security;
alter table public.project_payment_applications enable row level security;
alter table public.project_payment_application_documents enable row level security;
alter table public.project_payment_application_history enable row level security;
alter table public.project_payment_transactions enable row level security;

create function public.can_access_project_payment(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_payment_applications as application
    where application.id = p_application_id
      and (
        public.can_manage_project_documents(application.project_id)
        or (
          public.is_active_project_member(application.project_id)
          and (
            application.applicant_user_id = (select auth.uid())
            or application.approver_user_id = (select auth.uid())
          )
        )
      )
  );
$$;

revoke all on function public.can_access_project_payment(uuid)
  from public, anon;
grant execute on function public.can_access_project_payment(uuid)
  to authenticated;

create policy "Active project members can view finance terms"
  on public.project_finance_terms
  for select
  to authenticated
  using (public.is_active_project_member(project_id));

create policy "Active project members can view required payment documents"
  on public.project_payment_required_documents
  for select
  to authenticated
  using (public.is_active_project_member(project_id));

create policy "Payment application participants can view applications"
  on public.project_payment_applications
  for select
  to authenticated
  using (public.can_access_project_payment(id));

create policy "Payment application participants can view supporting documents"
  on public.project_payment_application_documents
  for select
  to authenticated
  using (public.can_access_project_payment(application_id));

create policy "Payment application participants can view review history"
  on public.project_payment_application_history
  for select
  to authenticated
  using (public.can_access_project_payment(application_id));

create policy "Payment application participants can view payment transactions"
  on public.project_payment_transactions
  for select
  to authenticated
  using (public.can_access_project_payment(application_id));

revoke all on public.project_finance_terms from anon, authenticated;
revoke all on public.project_payment_required_documents from anon, authenticated;
revoke all on public.project_payment_applications from anon, authenticated;
revoke all on public.project_payment_application_documents from anon, authenticated;
revoke all on public.project_payment_application_history from anon, authenticated;
revoke all on public.project_payment_transactions from anon, authenticated;
grant select on public.project_finance_terms to authenticated;
grant select on public.project_payment_required_documents to authenticated;
grant select on public.project_payment_applications to authenticated;
grant select on public.project_payment_application_documents to authenticated;
grant select on public.project_payment_application_history to authenticated;
grant select on public.project_payment_transactions to authenticated;

create function public.configure_project_finance(
  p_project_id uuid,
  p_currency_code text,
  p_contract_amount numeric,
  p_performance_security_amount numeric,
  p_performance_security_percent numeric,
  p_performance_security_clause text,
  p_performance_security_expiry date,
  p_advance_payment_amount numeric,
  p_advance_payment_percent numeric,
  p_advance_recovery_percent numeric,
  p_advance_payment_clause text,
  p_retention_percent numeric,
  p_retention_cap_amount numeric,
  p_retention_release_clause text,
  p_maximum_claim_amount numeric,
  p_maximum_claim_percent numeric,
  p_interim_payment_clause text,
  p_applicant_user_id uuid,
  p_approver_user_id uuid,
  p_required_documents text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  finance_id uuid;
  document_name text;
begin
  if current_user_id is null then
    raise exception 'Sign in to configure project finance.';
  end if;
  if not exists (
    select 1
    from public.projects
    where id = p_project_id and created_by = current_user_id
  ) then
    raise exception 'Only the project owner can configure contract finance.';
  end if;
  if p_currency_code is null or p_currency_code !~ '^[A-Z]{3}$' then
    raise exception 'Enter a three-letter uppercase currency code.';
  end if;
  if p_contract_amount is null or p_contract_amount <= 0 then
    raise exception 'Contract amount must be greater than zero.';
  end if;
  if p_performance_security_amount is not null
    and p_performance_security_percent is not null then
    raise exception 'Set performance security as an amount or a percentage, not both.';
  end if;
  if p_advance_payment_amount is not null
    and p_advance_payment_percent is not null then
    raise exception 'Set advance payment as an amount or a percentage, not both.';
  end if;
  if p_maximum_claim_amount is not null
    and p_maximum_claim_percent is not null then
    raise exception 'Set the claim limit as an amount or a percentage, not both.';
  end if;
  if coalesce(p_performance_security_amount, 0) < 0
    or coalesce(p_performance_security_percent, 0) not between 0 and 100
    or coalesce(p_advance_payment_amount, 0) < 0
    or coalesce(p_advance_payment_percent, 0) not between 0 and 100
    or coalesce(p_advance_recovery_percent, 0) not between 0 and 100
    or coalesce(p_retention_percent, 0) not between 0 and 100
    or coalesce(p_retention_cap_amount, 0) < 0
    or coalesce(p_maximum_claim_amount, 0) < 0
    or coalesce(p_maximum_claim_percent, 0) not between 0 and 100 then
    raise exception 'Enter valid security, advance, retention, and claim limits.';
  end if;
  if char_length(coalesce(p_performance_security_clause, '')) > 300
    or char_length(coalesce(p_advance_payment_clause, '')) > 300
    or char_length(coalesce(p_retention_release_clause, '')) > 1000
    or char_length(coalesce(p_interim_payment_clause, '')) > 1000 then
    raise exception 'A financial clause reference exceeds its allowed length.';
  end if;
  if p_applicant_user_id is null or p_approver_user_id is null
    or p_applicant_user_id = p_approver_user_id then
    raise exception 'Choose separate active members to apply and approve payments.';
  end if;
  if not exists (
    select 1
    from public.organisations as organisation
    join public.organisation_members as member
      on member.organisation_id = organisation.id
    where organisation.project_id = p_project_id
      and member.user_id = p_applicant_user_id
      and member.status = 'active'
      and member.project_access_role in ('member', 'project_manager')
  ) or not exists (
    select 1
    from public.organisations as organisation
    join public.organisation_members as member
      on member.organisation_id = organisation.id
    where organisation.project_id = p_project_id
      and member.user_id = p_approver_user_id
      and member.status = 'active'
      and member.project_access_role in ('member', 'project_manager')
  ) then
    raise exception 'Applicants and approvers must be active project team members.';
  end if;
  if p_required_documents is null or cardinality(p_required_documents) = 0 then
    raise exception 'Add at least one required application document.';
  end if;

  insert into public.project_finance_terms (
    project_id, currency_code, contract_amount,
    performance_security_amount, performance_security_percent,
    performance_security_clause, performance_security_expiry,
    advance_payment_amount, advance_payment_percent,
    advance_recovery_percent, advance_payment_clause,
    retention_percent, retention_cap_amount, retention_release_clause,
    maximum_claim_amount, maximum_claim_percent, interim_payment_clause,
    applicant_user_id, approver_user_id, configured_by
  )
  values (
    p_project_id, p_currency_code, p_contract_amount,
    p_performance_security_amount, p_performance_security_percent,
    coalesce(btrim(p_performance_security_clause), ''),
    p_performance_security_expiry,
    p_advance_payment_amount, p_advance_payment_percent,
    coalesce(p_advance_recovery_percent, 0),
    coalesce(btrim(p_advance_payment_clause), ''),
    coalesce(p_retention_percent, 0), p_retention_cap_amount,
    coalesce(btrim(p_retention_release_clause), ''),
    p_maximum_claim_amount, p_maximum_claim_percent,
    coalesce(btrim(p_interim_payment_clause), ''),
    p_applicant_user_id, p_approver_user_id, current_user_id
  )
  on conflict (project_id) do update set
    currency_code = excluded.currency_code,
    contract_amount = excluded.contract_amount,
    performance_security_amount = excluded.performance_security_amount,
    performance_security_percent = excluded.performance_security_percent,
    performance_security_clause = excluded.performance_security_clause,
    performance_security_expiry = excluded.performance_security_expiry,
    advance_payment_amount = excluded.advance_payment_amount,
    advance_payment_percent = excluded.advance_payment_percent,
    advance_recovery_percent = excluded.advance_recovery_percent,
    advance_payment_clause = excluded.advance_payment_clause,
    retention_percent = excluded.retention_percent,
    retention_cap_amount = excluded.retention_cap_amount,
    retention_release_clause = excluded.retention_release_clause,
    maximum_claim_amount = excluded.maximum_claim_amount,
    maximum_claim_percent = excluded.maximum_claim_percent,
    interim_payment_clause = excluded.interim_payment_clause,
    applicant_user_id = excluded.applicant_user_id,
    approver_user_id = excluded.approver_user_id,
    configured_by = current_user_id,
    updated_at = now()
  returning id into finance_id;

  delete from public.project_payment_required_documents
  where project_id = p_project_id;
  for document_name in
    select distinct btrim(documents.value)
    from unnest(p_required_documents) as documents(value)
    where char_length(btrim(documents.value)) between 2 and 100
  loop
    insert into public.project_payment_required_documents (
      project_id, document_name
    ) values (p_project_id, document_name);
  end loop;

  if not exists (
    select 1 from public.project_payment_required_documents
    where project_id = p_project_id
  ) then
    raise exception 'Add at least one required application document.';
  end if;
  return finance_id;
end;
$$;

create function public.save_project_payment_application(
  p_application_id uuid,
  p_project_id uuid,
  p_reference_number text,
  p_period_start date,
  p_period_end date,
  p_review_due_date date,
  p_gross_claim_amount numeric,
  p_advance_recovery numeric,
  p_retention_withheld numeric,
  p_retention_released numeric,
  p_other_deductions numeric,
  p_applicant_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  terms public.project_finance_terms%rowtype;
  application public.project_payment_applications%rowtype;
  target_id uuid;
  is_new boolean;
begin
  if current_user_id is null then
    raise exception 'Sign in to prepare a payment application.';
  end if;
  select * into terms
  from public.project_finance_terms
  where project_id = p_project_id
  for share;
  if terms.id is null then
    raise exception 'The project owner must configure financing first.';
  end if;
  if current_user_id <> terms.applicant_user_id
    and not public.can_manage_project_documents(p_project_id) then
    raise exception 'Only the assigned applicant or project management can prepare this application.';
  end if;
  if current_user_id = terms.applicant_user_id
    and not public.is_active_project_member(p_project_id) then
    raise exception 'Applicants must remain active project members.';
  end if;
  if p_reference_number is null
    or char_length(btrim(p_reference_number)) not between 1 and 80 then
    raise exception 'Enter an application reference between 1 and 80 characters.';
  end if;
  if p_period_start is null or p_period_end is null
    or p_period_end < p_period_start then
    raise exception 'Choose a valid payment period.';
  end if;
  if p_gross_claim_amount is null or p_gross_claim_amount <= 0
    or coalesce(p_advance_recovery, 0) < 0
    or coalesce(p_retention_withheld, 0) < 0
    or coalesce(p_retention_released, 0) < 0
    or coalesce(p_other_deductions, 0) < 0
    or p_gross_claim_amount - coalesce(p_advance_recovery, 0)
      - coalesce(p_retention_withheld, 0) + coalesce(p_retention_released, 0)
      - coalesce(p_other_deductions, 0) < 0 then
    raise exception 'Enter valid claim values; the net amount cannot be negative.';
  end if;
  if terms.maximum_claim_amount is not null
    and p_gross_claim_amount > terms.maximum_claim_amount then
    raise exception 'The claim exceeds the configured maximum amount per application.';
  end if;
  if terms.maximum_claim_percent is not null
    and p_gross_claim_amount > terms.contract_amount
      * terms.maximum_claim_percent / 100 then
    raise exception 'The claim exceeds the configured percentage of contract value.';
  end if;

  select lower(email) into current_email
  from auth.users where id = current_user_id;

  if p_application_id is null then
    is_new := true;
    target_id := gen_random_uuid();
    insert into public.project_payment_applications (
      id, project_id, finance_terms_id, reference_number,
      period_start, period_end, gross_claim_amount, advance_recovery,
      retention_withheld, retention_released, other_deductions,
      applicant_user_id, approver_user_id, review_due_date, applicant_note
    )
    values (
      target_id, p_project_id, terms.id, btrim(p_reference_number),
      p_period_start, p_period_end, p_gross_claim_amount,
      coalesce(p_advance_recovery, 0), coalesce(p_retention_withheld, 0),
      coalesce(p_retention_released, 0), coalesce(p_other_deductions, 0),
      current_user_id, terms.approver_user_id, p_review_due_date,
      coalesce(btrim(p_applicant_note), '')
    )
    returning * into application;
  else
    is_new := false;
    select * into application
    from public.project_payment_applications
    where id = p_application_id
    for update;
    if application.id is null or application.project_id <> p_project_id then
      raise exception 'The payment application was not found in this project.';
    end if;
    if current_user_id <> application.applicant_user_id
      and not public.can_manage_project_documents(p_project_id) then
      raise exception 'Only the applicant or project management can edit this application.';
    end if;
    if current_user_id = application.applicant_user_id
      and not public.is_active_project_member(p_project_id) then
      raise exception 'Applicants must remain active project members.';
    end if;
    if application.status not in ('draft', 'changes_requested') then
      raise exception 'Only draft or returned applications can be edited.';
    end if;
    update public.project_payment_applications
    set reference_number = btrim(p_reference_number),
        period_start = p_period_start,
        period_end = p_period_end,
        gross_claim_amount = p_gross_claim_amount,
        advance_recovery = coalesce(p_advance_recovery, 0),
        retention_withheld = coalesce(p_retention_withheld, 0),
        retention_released = coalesce(p_retention_released, 0),
        other_deductions = coalesce(p_other_deductions, 0),
        applicant_note = coalesce(btrim(p_applicant_note), ''),
        finance_terms_id = terms.id,
        approver_user_id = terms.approver_user_id,
        review_due_date = p_review_due_date,
        review_note = '',
        updated_at = now()
    where id = p_application_id
    returning * into application;
    target_id := p_application_id;
  end if;

  insert into public.project_payment_application_history (
    application_id, actor_user_id, actor_email, action, note,
    previous_status, new_status
  )
  values (
    target_id, current_user_id, current_email,
    case when is_new then 'created' else 'updated' end,
    application.applicant_note,
    case when is_new then null else application.status end,
    application.status
  );
  return target_id;
end;
$$;

create function public.register_project_payment_document(
  p_application_id uuid,
  p_document_type text,
  p_storage_path text,
  p_file_name text,
  p_content_type text,
  p_file_size integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  application public.project_payment_applications%rowtype;
  document_id uuid := gen_random_uuid();
begin
  if current_user_id is null then
    raise exception 'Sign in to attach application documents.';
  end if;
  select * into application
  from public.project_payment_applications
  where id = p_application_id
  for update;
  if application.id is null then
    raise exception 'The payment application was not found.';
  end if;
  if application.status not in ('draft', 'changes_requested') then
    raise exception 'Documents can only be added to draft or returned applications.';
  end if;
  if current_user_id <> application.applicant_user_id
    and not public.can_manage_project_documents(application.project_id) then
    raise exception 'Only the applicant or project management can attach documents.';
  end if;
  if current_user_id = application.applicant_user_id
    and not public.is_active_project_member(application.project_id) then
    raise exception 'Applicants must remain active project members.';
  end if;
  if not exists (
    select 1
    from public.project_payment_required_documents as required
    where required.project_id = application.project_id
      and required.document_name = btrim(p_document_type)
  ) then
    raise exception 'Choose a document type required by the project owner.';
  end if;
  if not public.is_valid_project_document_file(
    p_file_name, p_content_type, p_file_size
  ) then
    raise exception 'Choose a supported file no larger than 10 MB.';
  end if;
  if p_storage_path not like
    application.project_id::text || '/payment-applications/' ||
    application.id::text || '/%' then
    raise exception 'The uploaded file path does not match this application.';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'project-documents' and name = p_storage_path
  ) then
    raise exception 'Upload the application document before registering it.';
  end if;
  select lower(email) into current_email
  from auth.users where id = current_user_id;

  insert into public.project_payment_application_documents (
    id, application_id, document_type, storage_path, file_name,
    content_type, file_size, uploaded_by, uploaded_by_email
  )
  values (
    document_id, application.id, btrim(p_document_type), p_storage_path,
    p_file_name, p_content_type, p_file_size, current_user_id, current_email
  );
  insert into public.project_payment_application_history (
    application_id, actor_user_id, actor_email, action, note,
    previous_status, new_status
  )
  values (
    application.id, current_user_id, current_email, 'document_added',
    p_document_type || ': ' || p_file_name, application.status, application.status
  );
  return document_id;
end;
$$;

create function public.submit_project_payment_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  target_project_id uuid;
  terms public.project_finance_terms%rowtype;
  application public.project_payment_applications%rowtype;
  missing_names text;
  committed_retention_withheld numeric;
  committed_retention_released numeric;
begin
  if current_user_id is null then
    raise exception 'Sign in to submit a payment application.';
  end if;
  select project_id into target_project_id
  from public.project_payment_applications
  where id = p_application_id;
  if target_project_id is null then
    raise exception 'The payment application was not found.';
  end if;
  select * into terms
  from public.project_finance_terms
  where project_id = target_project_id
  for update;
  if terms.id is null then
    raise exception 'The project finance terms were not found.';
  end if;
  select * into application
  from public.project_payment_applications
  where id = p_application_id
  for update;
  if application.id is null or application.project_id <> target_project_id then
    raise exception 'The payment application was not found.';
  end if;
  if current_user_id <> application.applicant_user_id
    and not public.can_manage_project_documents(application.project_id) then
    raise exception 'Only the assigned applicant can submit this application.';
  end if;
  if current_user_id = application.applicant_user_id
    and not public.is_active_project_member(application.project_id) then
    raise exception 'Applicants must remain active project members.';
  end if;
  if application.status not in ('draft', 'changes_requested') then
    raise exception 'Only draft or returned applications can be submitted.';
  end if;

  select string_agg(required.document_name, ', ' order by required.document_name)
  into missing_names
  from public.project_payment_required_documents as required
  where required.project_id = application.project_id
    and not exists (
      select 1
      from public.project_payment_application_documents as document
      where document.application_id = application.id
        and document.document_type = required.document_name
    );
  if missing_names is not null then
    raise exception 'Upload all required supporting documents before submitting: %', missing_names;
  end if;

  select coalesce(sum(retention_withheld), 0),
      coalesce(sum(retention_released), 0)
  into committed_retention_withheld, committed_retention_released
  from public.project_payment_applications
  where project_id = application.project_id
    and id <> application.id
    and status in ('submitted', 'approved');
  if committed_retention_released + application.retention_released
    > committed_retention_withheld + application.retention_withheld then
    raise exception 'Retention released cannot exceed retention withheld across submitted and approved applications.';
  end if;
  if terms.retention_cap_amount is not null
    and committed_retention_withheld - committed_retention_released
      + application.retention_withheld - application.retention_released
      > terms.retention_cap_amount then
    raise exception 'The application exceeds the remaining contract retention cap.';
  end if;

  select lower(email) into current_email
  from auth.users where id = current_user_id;
  update public.project_payment_applications
  set status = 'submitted',
      review_note = '',
      reviewed_by = null,
      reviewed_at = null,
      updated_at = now()
  where id = application.id;
  insert into public.project_payment_application_history (
    application_id, actor_user_id, actor_email, action, note,
    previous_status, new_status
  )
  values (
    application.id, current_user_id, current_email, 'submitted',
    'Submitted for payment assessment.', application.status, 'submitted'
  );
end;
$$;

create function public.review_project_payment_application(
  p_application_id uuid,
  p_decision text,
  p_review_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  application public.project_payment_applications%rowtype;
  next_status text;
begin
  if current_user_id is null then
    raise exception 'Sign in to review payment applications.';
  end if;
  select * into application
  from public.project_payment_applications
  where id = p_application_id
  for update;
  if application.id is null then
    raise exception 'The payment application was not found.';
  end if;
  if current_user_id <> application.approver_user_id
    and not exists (
      select 1 from public.projects
      where id = application.project_id and created_by = current_user_id
    ) then
    raise exception 'Only the assigned approver or project owner can review this application.';
  end if;
  if current_user_id = application.approver_user_id
    and not public.is_active_project_member(application.project_id) then
    raise exception 'The assigned approver must remain an active project member.';
  end if;
  if application.status <> 'submitted' then
    raise exception 'Only submitted applications can be reviewed.';
  end if;
  if p_decision is null or p_decision not in ('approve', 'request_changes') then
    raise exception 'Choose approve or request changes.';
  end if;
  if p_decision = 'request_changes'
    and (
      btrim(coalesce(p_review_note, '')) = ''
      or char_length(btrim(p_review_note)) not between 2 and 2000
    ) then
    raise exception 'Provide review instructions between 2 and 2000 characters.';
  end if;
  select lower(email) into current_email
  from auth.users where id = current_user_id;
  next_status := case when p_decision = 'approve'
    then 'approved' else 'changes_requested' end;

  update public.project_payment_applications
  set status = next_status,
      review_note = case when p_decision = 'approve'
        then '' else btrim(p_review_note) end,
      reviewed_by = current_user_id,
      reviewed_at = now(),
      updated_at = now()
  where id = application.id;
  insert into public.project_payment_application_history (
    application_id, actor_user_id, actor_email, action, note,
    previous_status, new_status, amount
  )
  values (
    application.id, current_user_id, current_email, next_status,
    coalesce(btrim(p_review_note), ''),
    application.status, next_status, application.net_amount
  );
end;
$$;

create function public.reverse_project_payment_approval(
  p_application_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  application public.project_payment_applications%rowtype;
  clean_reason text := btrim(p_reason);
begin
  if current_user_id is null then
    raise exception 'Sign in to reverse a payment approval.';
  end if;
  select * into application
  from public.project_payment_applications
  where id = p_application_id
  for update;
  if application.id is null then
    raise exception 'The payment application was not found.';
  end if;
  if not exists (
    select 1 from public.projects
    where id = application.project_id and created_by = current_user_id
  ) then
    raise exception 'Only the project owner can reverse an approval.';
  end if;
  if application.status <> 'approved' then
    raise exception 'Only an approved application can be reversed.';
  end if;
  if clean_reason is null or char_length(clean_reason) not between 2 and 1000 then
    raise exception 'Give a reversal reason between 2 and 1000 characters.';
  end if;
  if exists (
    select 1 from public.project_payment_transactions
    where application_id = application.id
  ) then
    raise exception 'An application with recorded payments cannot be reversed. Reconcile or correct its payment record first.';
  end if;
  select lower(email) into current_email
  from auth.users where id = current_user_id;

  update public.project_payment_applications
  set status = 'reversed',
      reversed_by = current_user_id,
      reversed_at = now(),
      reversal_reason = clean_reason,
      updated_at = now()
  where id = application.id;
  insert into public.project_payment_application_history (
    application_id, actor_user_id, actor_email, action, note,
    previous_status, new_status, amount
  )
  values (
    application.id, current_user_id, current_email, 'reversed',
    clean_reason, 'approved', 'reversed', application.net_amount
  );
end;
$$;

create function public.record_project_payment(
  p_application_id uuid,
  p_amount numeric,
  p_paid_at date,
  p_payment_reference text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  application public.project_payment_applications%rowtype;
  already_paid numeric(14, 2);
  transaction_id uuid := gen_random_uuid();
begin
  if current_user_id is null then
    raise exception 'Sign in to record project payments.';
  end if;
  select * into application
  from public.project_payment_applications
  where id = p_application_id
  for update;
  if application.id is null then
    raise exception 'The payment application was not found.';
  end if;
  if not exists (
    select 1 from public.projects
    where id = application.project_id and created_by = current_user_id
  ) then
    raise exception 'Only the project owner can record payments.';
  end if;
  if application.status <> 'approved' then
    raise exception 'Only approved applications can be marked as paid.';
  end if;
  if p_amount is null or p_amount <= 0 or p_paid_at is null
    or p_payment_reference is null
    or char_length(btrim(p_payment_reference)) not between 1 and 100
    or char_length(coalesce(p_note, '')) > 1000 then
    raise exception 'Enter a valid payment amount, date, and reference.';
  end if;
  select coalesce(sum(amount), 0)
  into already_paid
  from public.project_payment_transactions
  where application_id = application.id;
  if already_paid + p_amount > application.net_amount then
    raise exception 'Recorded payments cannot exceed the approved net application amount.';
  end if;

  select lower(email) into current_email
  from auth.users where id = current_user_id;
  insert into public.project_payment_transactions (
    id, application_id, amount, paid_at, payment_reference, note,
    recorded_by, recorded_by_email
  )
  values (
    transaction_id, application.id, p_amount, p_paid_at,
    btrim(p_payment_reference), coalesce(btrim(p_note), ''),
    current_user_id, current_email
  );
  insert into public.project_payment_application_history (
    application_id, actor_user_id, actor_email, action, note,
    previous_status, new_status, amount
  )
  values (
    application.id, current_user_id, current_email, 'payment_recorded',
    btrim(p_payment_reference), application.status, application.status, p_amount
  );
  return transaction_id;
end;
$$;

create function public.get_project_paid_totals(p_project_ids uuid[])
returns table (project_id uuid, paid_amount numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select application.project_id, coalesce(sum(payment.amount), 0)
  from public.project_payment_applications as application
  join public.project_payment_transactions as payment
    on payment.application_id = application.id
  where (select auth.uid()) is not null
    and application.project_id = any(p_project_ids)
    and application.status <> 'reversed'
    and public.is_active_project_member(application.project_id)
  group by application.project_id;
$$;

create function public.notify_project_payment_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  application public.project_payment_applications%rowtype;
  activity_title text;
  activity_message text;
  activity_type text;
  actor_id uuid;
begin
  if tg_table_name = 'project_payment_applications' then
    application := new;
    actor_id := auth.uid();
    if tg_op = 'INSERT' then
      activity_title := 'Payment application prepared';
      activity_message := new.reference_number || ' draft was created.';
      activity_type := 'payment_draft';
    elsif old.status is distinct from new.status then
      activity_title := case new.status
        when 'submitted' then 'Payment application submitted'
        when 'changes_requested' then 'Payment changes requested'
        when 'approved' then 'Payment application approved'
        when 'reversed' then 'Payment approval reversed'
        else 'Payment application updated'
      end;
      activity_message := new.reference_number || ' is now ' ||
        replace(new.status, '_', ' ') || '.';
      activity_type := 'payment_' || new.status;
    else
      return new;
    end if;
  elsif tg_table_name = 'project_payment_transactions' then
    actor_id := new.recorded_by;
    select * into application
    from public.project_payment_applications
    where id = new.application_id;
    activity_title := 'Project payment recorded';
    activity_message := application.reference_number || ' payment of ' ||
      new.amount::text || ' ' ||
      (select currency_code from public.project_finance_terms
       where project_id = application.project_id) || ' was recorded.';
    activity_type := 'payment_recorded';
  else
    return new;
  end if;

  perform public.record_project_activity(
    application.project_id,
    actor_id,
    activity_type,
    activity_title,
    activity_message,
    'payment_application',
    application.id
  );
  return new;
end;
$$;

create trigger project_payment_application_activity
  after insert or update of status on public.project_payment_applications
  for each row
  execute function public.notify_project_payment_activity();

create trigger project_payment_transaction_activity
  after insert on public.project_payment_transactions
  for each row
  execute function public.notify_project_payment_activity();

revoke all on function public.configure_project_finance(
  uuid, text, numeric, numeric, numeric, text, date, numeric, numeric,
  numeric, text, numeric, numeric, text, numeric, numeric, text, uuid, uuid,
  text[]
) from public, anon, authenticated;
revoke all on function public.save_project_payment_application(
  uuid, uuid, text, date, date, date, numeric, numeric, numeric, numeric, numeric, text
) from public, anon, authenticated;
revoke all on function public.register_project_payment_document(
  uuid, text, text, text, text, integer
) from public, anon, authenticated;
revoke all on function public.submit_project_payment_application(uuid)
  from public, anon, authenticated;
revoke all on function public.review_project_payment_application(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.reverse_project_payment_approval(uuid, text)
  from public, anon, authenticated;
revoke all on function public.record_project_payment(
  uuid, numeric, date, text, text
) from public, anon, authenticated;
revoke all on function public.get_project_paid_totals(uuid[])
  from public, anon;
grant execute on function public.get_project_paid_totals(uuid[])
  to authenticated;

grant execute on function public.configure_project_finance(
  uuid, text, numeric, numeric, numeric, text, date, numeric, numeric,
  numeric, text, numeric, numeric, text, numeric, numeric, text, uuid, uuid,
  text[]
) to authenticated;
grant execute on function public.save_project_payment_application(
  uuid, uuid, text, date, date, date, numeric, numeric, numeric, numeric, numeric, text
) to authenticated;
grant execute on function public.register_project_payment_document(
  uuid, text, text, text, text, integer
) to authenticated;
grant execute on function public.submit_project_payment_application(uuid)
  to authenticated;
grant execute on function public.review_project_payment_application(uuid, text, text)
  to authenticated;
grant execute on function public.reverse_project_payment_approval(uuid, text)
  to authenticated;
grant execute on function public.record_project_payment(
  uuid, numeric, date, text, text
) to authenticated;

create policy "Assigned applicants can upload payment application documents"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'project-documents'
    and case
      when (storage.foldername(name))[1] ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and (storage.foldername(name))[2] = 'payment-applications'
        and (storage.foldername(name))[3] ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then exists (
        select 1
        from public.project_payment_applications as application
        where application.id = ((storage.foldername(name))[3])::uuid
          and application.project_id = ((storage.foldername(name))[1])::uuid
          and application.status in ('draft', 'changes_requested')
          and (
            (
              application.applicant_user_id = (select auth.uid())
              and public.is_active_project_member(application.project_id)
            )
            or public.can_manage_project_documents(application.project_id)
          )
      )
      else false
    end
  );

create policy "Applicants can remove unregistered payment files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'project-documents'
    and case
      when (storage.foldername(name))[1] ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and (storage.foldername(name))[2] = 'payment-applications'
        and (storage.foldername(name))[3] ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then exists (
        select 1
        from public.project_payment_applications as application
        where application.id = ((storage.foldername(name))[3])::uuid
          and application.project_id = ((storage.foldername(name))[1])::uuid
          and application.status in ('draft', 'changes_requested')
          and (
            (
              application.applicant_user_id = (select auth.uid())
              and public.is_active_project_member(application.project_id)
            )
            or public.can_manage_project_documents(application.project_id)
          )
      )
        and not exists (
          select 1
          from public.project_payment_application_documents as document
          where document.storage_path = name
        )
      else false
    end
  );
