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
    and not public.can_manage_project_documents(p_project_id)
    and not exists (
      select 1
      from public.organisations as organisation
      join public.organisation_members as member
        on member.organisation_id = organisation.id
      where organisation.project_id = p_project_id
        and member.user_id = current_user_id
        and member.status = 'active'
    ) then
    raise exception 'Only project management or an active project member can assign tasks.';
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
