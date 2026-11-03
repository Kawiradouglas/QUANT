create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  assignee_user_id uuid not null references auth.users(id) on delete restrict,
  assignee_email text not null,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  due_date date,
  status text not null default 'assigned'
    check (status in ('assigned', 'submitted', 'revision_requested', 'completed')),
  review_note text not null default '' check (char_length(review_note) <= 1000),
  reviewed_by_email text,
  reviewed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_tasks_project_id_idx
  on public.project_tasks (project_id, created_at desc);
create index project_tasks_assignee_idx
  on public.project_tasks (assignee_user_id, status);

create table public.project_task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200),
  content_type text not null,
  file_size integer not null check (file_size between 1 and 10485760),
  submitted_by uuid not null references auth.users(id) on delete restrict,
  submitted_by_email text,
  created_at timestamptz not null default now()
);

create index project_task_submissions_task_id_idx
  on public.project_task_submissions (task_id, created_at desc);

alter table public.project_tasks enable row level security;
alter table public.project_task_submissions enable row level security;

create function public.can_access_project_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_tasks as task
    where task.id = p_task_id
      and (
        public.can_manage_project_documents(task.project_id)
        or (
          task.assignee_user_id = (select auth.uid())
          and exists (
            select 1
            from public.organisations as organisation
            join public.organisation_members as member
              on member.organisation_id = organisation.id
            where organisation.project_id = task.project_id
              and member.user_id = (select auth.uid())
              and member.status = 'active'
          )
        )
      )
  );
$$;

create function public.can_submit_project_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_tasks as task
    join public.organisations as organisation
      on organisation.project_id = task.project_id
    join public.organisation_members as member
      on member.organisation_id = organisation.id
    where task.id = p_task_id
      and task.assignee_user_id = (select auth.uid())
      and task.status in ('assigned', 'revision_requested')
      and member.user_id = (select auth.uid())
      and member.status = 'active'
  );
$$;

revoke all on function public.can_access_project_task(uuid)
  from public, anon;
revoke all on function public.can_submit_project_task(uuid)
  from public, anon;
grant execute on function public.can_access_project_task(uuid)
  to authenticated;
grant execute on function public.can_submit_project_task(uuid)
  to authenticated;

create policy "Assigned members and project managers can view tasks"
  on public.project_tasks
  for select
  to authenticated
  using (public.can_access_project_task(id));

create policy "Task participants can view submissions"
  on public.project_task_submissions
  for select
  to authenticated
  using (public.can_access_project_task(task_id));

revoke all on public.project_tasks from anon, authenticated;
revoke all on public.project_task_submissions from anon, authenticated;
grant select on public.project_tasks to authenticated;
grant select on public.project_task_submissions to authenticated;

create function public.create_project_task(
  p_project_id uuid,
  p_title text,
  p_description text,
  p_assignee_user_id uuid,
  p_due_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  clean_title text := btrim(p_title);
  clean_description text := btrim(p_description);
  clean_assignee_email text;
  new_task_id uuid;
begin
  if current_user_id is null then
    raise exception 'Sign in to assign project tasks.';
  end if;
  if not public.can_manage_project_documents(p_project_id) then
    raise exception 'Only the client or an assigned project manager can assign project tasks.';
  end if;
  if clean_title is null or char_length(clean_title) not between 2 and 200 then
    raise exception 'Task titles must be between 2 and 200 characters.';
  end if;
  if char_length(clean_description) > 2000 then
    raise exception 'Task instructions must be 2000 characters or fewer.';
  end if;

  select lower(member.email)
  into clean_assignee_email
  from public.organisations as organisation
  join public.projects as project
    on project.id = organisation.project_id
  join public.organisation_members as member
    on member.organisation_id = organisation.id
  where organisation.project_id = p_project_id
    and project.created_by <> p_assignee_user_id
    and member.user_id = p_assignee_user_id
    and member.status = 'active';

  if clean_assignee_email is null then
    raise exception 'Assign tasks to an active member of this project.';
  end if;

  insert into public.project_tasks (
    project_id,
    title,
    description,
    assignee_user_id,
    assignee_email,
    assigned_by,
    due_date
  )
  values (
    p_project_id,
    clean_title,
    clean_description,
    p_assignee_user_id,
    clean_assignee_email,
    current_user_id,
    p_due_date
  )
  returning id into new_task_id;

  return new_task_id;
end;
$$;

create function public.submit_project_task(
  p_task_id uuid,
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
  target_project_id uuid;
  new_submission_id uuid := gen_random_uuid();
  current_email text;
begin
  if current_user_id is null then
    raise exception 'Sign in to submit a project task.';
  end if;

  select project_id
  into target_project_id
  from public.project_tasks
  where id = p_task_id
  for update;

  if target_project_id is null then
    raise exception 'The project task was not found.';
  end if;
  if not public.can_submit_project_task(p_task_id) then
    raise exception 'Only the assigned member can submit a file for an open task.';
  end if;
  if not public.is_valid_project_document_file(
    p_file_name,
    p_content_type,
    p_file_size
  ) then
    raise exception 'Choose a supported file no larger than 10 MB.';
  end if;
  if p_storage_path not like
    target_project_id::text || '/' || p_task_id::text || '/%' then
    raise exception 'The uploaded file path does not match this task.';
  end if;
  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'project-documents'
      and name = p_storage_path
  ) then
    raise exception 'Upload the task file before submitting it.';
  end if;

  select lower(email)
  into current_email
  from auth.users
  where id = current_user_id;

  insert into public.project_task_submissions (
    id,
    task_id,
    storage_path,
    file_name,
    content_type,
    file_size,
    submitted_by,
    submitted_by_email
  )
  values (
    new_submission_id,
    p_task_id,
    p_storage_path,
    p_file_name,
    p_content_type,
    p_file_size,
    current_user_id,
    current_email
  );

  update public.project_tasks
  set
    status = 'submitted',
    review_note = '',
    reviewed_by_email = null,
    reviewed_at = null,
    completed_at = null,
    updated_at = now()
  where id = p_task_id;

  return new_submission_id;
end;
$$;

create function public.review_project_task(
  p_task_id uuid,
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
  clean_review_note text := btrim(p_review_note);
  task_project_id uuid;
  current_email text;
begin
  if current_user_id is null then
    raise exception 'Sign in to review project tasks.';
  end if;

  select project_id
  into task_project_id
  from public.project_tasks
  where id = p_task_id
  for update;

  if task_project_id is null then
    raise exception 'The project task was not found.';
  end if;
  if not public.can_manage_project_documents(task_project_id) then
    raise exception 'Only the client or an assigned project manager can review project tasks.';
  end if;
  if p_decision is null or p_decision not in ('accept', 'request_changes') then
    raise exception 'Choose accept or request changes.';
  end if;
  if p_decision = 'request_changes'
    and (
      clean_review_note is null
      or char_length(clean_review_note) not between 2 and 1000
    ) then
    raise exception 'Give the member review instructions between 2 and 1000 characters.';
  end if;

  if not exists (
    select 1
    from public.project_tasks as task
    join public.project_task_submissions as submission
      on submission.task_id = task.id
    where task.id = p_task_id
      and task.status = 'submitted'
  ) then
    raise exception 'This task has no submission awaiting review.';
  end if;

  select lower(email)
  into current_email
  from auth.users
  where id = current_user_id;

  update public.project_tasks
  set
    status = case
      when p_decision = 'accept' then 'completed'
      else 'revision_requested'
    end,
    review_note = case
      when p_decision = 'accept' then ''
      else clean_review_note
    end,
    reviewed_by_email = current_email,
    reviewed_at = now(),
    completed_at = case
      when p_decision = 'accept' then now()
      else null
    end,
    updated_at = now()
  where id = p_task_id
    and status = 'submitted';
end;
$$;

revoke all on function public.create_project_task(uuid, text, text, uuid, date)
  from public, anon, authenticated;
revoke all on function public.submit_project_task(uuid, text, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.review_project_task(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.create_project_task(uuid, text, text, uuid, date)
  to authenticated;
grant execute on function public.submit_project_task(uuid, text, text, text, integer)
  to authenticated;
grant execute on function public.review_project_task(uuid, text, text)
  to authenticated;

create policy "Assigned members can submit task files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'project-documents'
    and case
      when (storage.foldername(name))[1] ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and (storage.foldername(name))[2] ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.can_submit_project_task(((storage.foldername(name))[2])::uuid)
        and exists (
          select 1
          from public.project_tasks as task
          where task.id = ((storage.foldername(name))[2])::uuid
            and task.project_id = ((storage.foldername(name))[1])::uuid
        )
      else false
    end
  );
