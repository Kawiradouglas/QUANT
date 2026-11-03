alter table public.organisation_members
  add column project_access_role text not null default 'member'
  check (project_access_role in ('project_manager', 'member'));

update public.organisation_members as member
set project_access_role = 'member'
where member.project_access_role not in ('project_manager', 'member');

create or replace function public.can_manage_project_team(
  p_organisation_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organisations as organisation
    join public.projects as project
      on project.id = organisation.project_id
    where organisation.id = p_organisation_id
      and (
        project.created_by = p_user_id
        or exists (
          select 1
          from public.organisation_members as manager
          where manager.organisation_id = organisation.id
            and manager.user_id = p_user_id
            and manager.status = 'active'
            and manager.project_access_role = 'project_manager'
        )
      )
  );
$$;

revoke all on function public.can_manage_project_team(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.add_organisation_member(
  p_organisation_id uuid,
  p_email text,
  p_project_access_role text,
  p_professional_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_user_id uuid;
  target_email text;
  target_confirmed boolean;
  project_creator_id uuid;
  clean_email text := lower(btrim(p_email));
  clean_professional_role text := btrim(p_professional_role);
begin
  if current_user_id is null then
    raise exception 'Sign in to manage project members.';
  end if;

  if not public.can_manage_project_team(p_organisation_id, current_user_id) then
    raise exception 'Only the client or an assigned project manager can invite members.';
  end if;

  select project.created_by
  into project_creator_id
  from public.organisations as organisation
  join public.projects as project on project.id = organisation.project_id
  where organisation.id = p_organisation_id;

  if p_project_access_role not in ('project_manager', 'member') then
    raise exception 'Choose project manager or project member.';
  end if;
  if p_project_access_role = 'project_manager'
    and project_creator_id is distinct from current_user_id then
    raise exception 'Only the client can assign a project manager.';
  end if;
  if clean_professional_role is null
    or char_length(clean_professional_role) < 2
    or char_length(clean_professional_role) > 80 then
    raise exception 'Professional roles must be between 2 and 80 characters.';
  end if;
  if clean_email is null
    or clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address.';
  end if;

  select account.id, lower(account.email), account.email_confirmed_at is not null
  into target_user_id, target_email, target_confirmed
  from auth.users as account
  where lower(account.email) = clean_email;

  if target_user_id is null then
    raise exception 'No account exists for that email address.';
  end if;
  if not target_confirmed then
    raise exception 'That account has not confirmed its email address yet.';
  end if;

  insert into public.organisation_members (
    organisation_id,
    user_id,
    email,
    role,
    project_access_role,
    professional_role,
    status
  )
  values (
    p_organisation_id,
    target_user_id,
    target_email,
    'member',
    p_project_access_role,
    clean_professional_role,
    'active'
  );
exception
  when unique_violation then
    raise exception 'That account is already a member or has a pending invitation.';
end;
$$;

create or replace function public.attach_invited_organisation_member(
  p_organisation_id uuid,
  p_email text,
  p_project_access_role text,
  p_professional_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_user_id uuid;
  target_email text;
  project_creator_id uuid;
  clean_email text := lower(btrim(p_email));
  clean_professional_role text := btrim(p_professional_role);
begin
  if current_user_id is null then
    raise exception 'Sign in to manage project members.';
  end if;

  if not public.can_manage_project_team(p_organisation_id, current_user_id) then
    raise exception 'Only the client or an assigned project manager can invite members.';
  end if;

  select project.created_by
  into project_creator_id
  from public.organisations as organisation
  join public.projects as project on project.id = organisation.project_id
  where organisation.id = p_organisation_id;

  if p_project_access_role not in ('project_manager', 'member') then
    raise exception 'Choose project manager or project member.';
  end if;
  if p_project_access_role = 'project_manager'
    and project_creator_id is distinct from current_user_id then
    raise exception 'Only the client can assign a project manager.';
  end if;
  if clean_professional_role is null
    or char_length(clean_professional_role) < 2
    or char_length(clean_professional_role) > 80 then
    raise exception 'Professional roles must be between 2 and 80 characters.';
  end if;

  select account.id, lower(account.email)
  into target_user_id, target_email
  from auth.users as account
  where lower(account.email) = clean_email
    and account.email_confirmed_at is null;

  if target_user_id is null then
    raise exception 'The invited account was not found or has already confirmed its email.';
  end if;

  insert into public.organisation_members (
    organisation_id,
    user_id,
    email,
    role,
    project_access_role,
    professional_role,
    status
  )
  values (
    p_organisation_id,
    target_user_id,
    target_email,
    'member',
    p_project_access_role,
    clean_professional_role,
    'invited'
  );
exception
  when unique_violation then
    raise exception 'That account is already a member or has a pending invitation.';
end;
$$;

create or replace function public.update_project_member_assignment(
  p_organisation_id uuid,
  p_user_id uuid,
  p_project_access_role text,
  p_professional_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  project_creator_id uuid;
  current_target_role text;
  clean_professional_role text := btrim(p_professional_role);
begin
  if current_user_id is null then
    raise exception 'Sign in to manage project members.';
  end if;

  if not public.can_manage_project_team(p_organisation_id, current_user_id) then
    raise exception 'Only the client or an assigned project manager can change project roles.';
  end if;

  select project.created_by
  into project_creator_id
  from public.organisations as organisation
  join public.projects as project on project.id = organisation.project_id
  where organisation.id = p_organisation_id;

  if p_project_access_role not in ('project_manager', 'member') then
    raise exception 'Choose project manager or project member.';
  end if;
  if p_project_access_role = 'project_manager'
    and project_creator_id is distinct from current_user_id then
    raise exception 'Only the client can assign a project manager.';
  end if;
  if clean_professional_role is null
    or char_length(clean_professional_role) < 2
    or char_length(clean_professional_role) > 80 then
    raise exception 'Professional roles must be between 2 and 80 characters.';
  end if;

  select member.project_access_role
  into current_target_role
  from public.organisation_members as member
  where member.organisation_id = p_organisation_id
    and member.user_id = p_user_id
    and member.status in ('active', 'invited');

  if current_target_role is null then
    raise exception 'That account is not a member of this project.';
  end if;
  if current_target_role = 'client' then
    raise exception 'The client role cannot be changed.';
  end if;
  if current_target_role = 'project_manager'
    and project_creator_id is distinct from current_user_id then
    raise exception 'Only the client can change a project manager assignment.';
  end if;

  update public.organisation_members
  set
    project_access_role = p_project_access_role,
    professional_role = clean_professional_role
  where organisation_id = p_organisation_id
    and user_id = p_user_id;
end;
$$;

create or replace function public.update_project_configuration(
  p_project_id uuid,
  p_name text,
  p_contract_type text,
  p_delivery_mode text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  clean_name text := btrim(p_name);
  clean_contract_type text := btrim(p_contract_type);
  clean_delivery_mode text := btrim(p_delivery_mode);
  existing_contract_type text;
begin
  if current_user_id is null then
    raise exception 'Sign in to update project configuration.';
  end if;

  if clean_name is null or char_length(clean_name) < 2 or char_length(clean_name) > 100 then
    raise exception 'Project names must be between 2 and 100 characters.';
  end if;
  if clean_contract_type is null or char_length(clean_contract_type) < 2 or char_length(clean_contract_type) > 100 then
    raise exception 'Contract forms must be between 2 and 100 characters.';
  end if;
  if clean_delivery_mode is null or char_length(clean_delivery_mode) < 2 or char_length(clean_delivery_mode) > 100 then
    raise exception 'Delivery modes must be between 2 and 100 characters.';
  end if;

  select project.contract_type
  into existing_contract_type
  from public.projects as project
  where project.id = p_project_id
    and project.created_by = current_user_id;

  if existing_contract_type is null then
    raise exception 'Only the client who created this project can change its configuration.';
  end if;
  if clean_contract_type is distinct from existing_contract_type then
    raise exception 'The contract form cannot be changed after project creation.';
  end if;

  update public.projects
  set
    name = clean_name,
    delivery_mode = clean_delivery_mode
  where id = p_project_id
    and created_by = current_user_id;
end;
$$;

create or replace function public.create_project(
  p_name text,
  p_contract_type text,
  p_delivery_mode text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  clean_name text := btrim(p_name);
  clean_contract_type text := btrim(p_contract_type);
  clean_delivery_mode text := btrim(p_delivery_mode);
  new_project_id uuid;
begin
  if current_user_id is null then
    raise exception 'Sign in to create a project.';
  end if;
  if exists (
    select 1
    from public.organisation_members as member
    where member.user_id = current_user_id
      and member.status = 'active'
      and member.project_access_role = 'project_manager'
  ) and not exists (
    select 1
    from public.projects as project
    where project.created_by = current_user_id
  ) then
    raise exception 'Only a client can create a project. Project managers can manage projects assigned to them.';
  end if;
  if clean_name is null or char_length(clean_name) < 2 or char_length(clean_name) > 100 then
    raise exception 'Project names must be between 2 and 100 characters.';
  end if;
  if clean_contract_type is null or char_length(clean_contract_type) < 2 or char_length(clean_contract_type) > 100 then
    raise exception 'Enter a contract form between 2 and 100 characters.';
  end if;
  if clean_delivery_mode is null or char_length(clean_delivery_mode) < 2 or char_length(clean_delivery_mode) > 100 then
    raise exception 'Enter a delivery mode between 2 and 100 characters.';
  end if;

  insert into public.projects (name, contract_type, delivery_mode, created_by)
  values (
    clean_name,
    clean_contract_type,
    clean_delivery_mode,
    current_user_id
  )
  returning id into new_project_id;

  return new_project_id;
end;
$$;

revoke all on function public.add_organisation_member(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.attach_invited_organisation_member(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.update_organisation_member_role(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.set_organisation_member_professional_role(uuid, text)
  from public, anon, authenticated;
revoke all on function public.update_project_configuration(uuid, text, text, text)
  from public, anon, authenticated;

revoke all on function public.add_organisation_member(uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.attach_invited_organisation_member(uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.update_project_member_assignment(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.add_organisation_member(uuid, text, text, text)
  to authenticated;
grant execute on function public.attach_invited_organisation_member(uuid, text, text, text)
  to authenticated;
grant execute on function public.update_project_member_assignment(uuid, uuid, text, text)
  to authenticated;
grant execute on function public.update_project_configuration(uuid, text, text, text)
  to authenticated;
