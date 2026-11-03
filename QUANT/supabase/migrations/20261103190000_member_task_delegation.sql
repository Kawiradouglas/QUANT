alter table public.project_tasks
  add column assigned_by_email text;

alter table public.project_tasks
  add column workflow text not null default 'management'
  check (workflow in ('management', 'delegated'));

update public.project_tasks as task
set assigned_by_email = lower(account.email)
from auth.users as account
where account.id = task.assigned_by
  and task.assigned_by_email is null;

create or replace function public.can_access_project_task(p_task_id uuid)
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
        or (
          task.assigned_by = (select auth.uid())
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

create or replace function public.create_project_task(
  p_project_id uuid,
  p_workflow text,
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
  clean_description text := coalesce(btrim(p_description), '');
  clean_assignee_email text;
  current_email text;
  new_task_id uuid;
begin
  if current_user_id is null then
    raise exception 'Sign in to assign project tasks.';
  end if;
  if p_workflow is null or p_workflow not in ('management', 'delegated') then
    raise exception 'Choose a management or member-delegated task workflow.';
  end if;
  if p_workflow = 'management'
    and not public.can_manage_project_documents(p_project_id) then
    raise exception 'Only the client or an assigned project manager can create management tasks.';
  end if;
  if p_workflow = 'delegated'
    and not exists (
      select 1
      from public.organisations as organisation
      join public.organisation_members as member
        on member.organisation_id = organisation.id
      where organisation.project_id = p_project_id
        and member.user_id = current_user_id
        and member.status = 'active'
    ) then
    raise exception 'Only an active project member can delegate project tasks.';
  end if;
  if clean_title is null or char_length(clean_title) not between 2 and 200 then
    raise exception 'Task titles must be between 2 and 200 characters.';
  end if;
  if char_length(clean_description) > 2000 then
    raise exception 'Task instructions must be 2000 characters or fewer.';
  end if;
  if p_assignee_user_id is null or p_assignee_user_id = current_user_id then
    raise exception 'Assign tasks to another active member of this project.';
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
    raise exception 'Assign tasks to another active member of this project.';
  end if;

  select lower(email)
  into current_email
  from auth.users
  where id = current_user_id;

  insert into public.project_tasks (
    project_id,
    title,
    description,
    assignee_user_id,
    assignee_email,
    assigned_by,
    assigned_by_email,
    workflow,
    due_date
  )
  values (
    p_project_id,
    clean_title,
    clean_description,
    p_assignee_user_id,
    clean_assignee_email,
    current_user_id,
    current_email,
    p_workflow,
    p_due_date
  )
  returning id into new_task_id;

  return new_task_id;
end;
$$;

create or replace function public.review_project_task(
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
  task_assigner_id uuid;
  task_workflow text;
  current_email text;
begin
  if current_user_id is null then
    raise exception 'Sign in to review project tasks.';
  end if;

  select project_id, assigned_by, workflow
  into task_project_id, task_assigner_id, task_workflow
  from public.project_tasks
  where id = p_task_id
  for update;

  if task_project_id is null then
    raise exception 'The project task was not found.';
  end if;
  if not public.can_manage_project_documents(task_project_id)
    and (
      task_workflow <> 'delegated'
      or
      task_assigner_id is distinct from current_user_id
      or not exists (
        select 1
        from public.organisations as organisation
        join public.organisation_members as member
          on member.organisation_id = organisation.id
        where organisation.project_id = task_project_id
          and member.user_id = current_user_id
          and member.status = 'active'
      )
    ) then
    raise exception 'Only the task assigner or the client/project manager can review this task.';
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
revoke all on function public.create_project_task(uuid, text, text, text, uuid, date)
  from public, anon, authenticated;
grant execute on function public.create_project_task(uuid, text, text, text, uuid, date)
  to authenticated;
