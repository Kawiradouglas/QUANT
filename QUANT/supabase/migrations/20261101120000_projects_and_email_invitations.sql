create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  contract_type text not null check (char_length(contract_type) between 2 and 100),
  delivery_mode text not null check (char_length(delivery_mode) between 2 and 100),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index projects_created_by_idx on public.projects (created_by);
alter table public.projects enable row level security;

alter table public.organisations
  add column project_id uuid unique references public.projects(id) on delete cascade;

alter table public.organisation_members
  add column status text not null default 'active'
  check (status in ('active', 'invited'));

create or replace function public.is_organisation_member(p_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organisation_members
    where organisation_id = p_organisation_id
      and user_id = (select auth.uid())
      and status = 'active'
  );
$$;

drop policy if exists "Members can view their organisations"
  on public.organisations;
create policy "Members can view their organisations"
  on public.organisations
  for select
  to authenticated
  using (public.is_organisation_member(id));

drop policy if exists "Members can view their organisation membership"
  on public.organisation_members;
create policy "Members can view their organisation membership"
  on public.organisation_members
  for select
  to authenticated
  using (public.is_organisation_member(organisation_id));

create policy "Project creators and organisation members can view projects"
  on public.projects
  for select
  to authenticated
  using (
    created_by = (select auth.uid())
    or exists (
      select 1
      from public.organisations
      where project_id = projects.id
        and public.is_organisation_member(organisations.id)
    )
  );

revoke all on public.projects from anon, authenticated;
grant select on public.projects to authenticated;

create function public.create_project(
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

create function public.create_project_organisation(
  p_project_id uuid,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  clean_name text := btrim(p_name);
  new_organisation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Sign in to create an organisation.';
  end if;

  if clean_name is null or char_length(clean_name) < 2 or char_length(clean_name) > 100 then
    raise exception 'Organisation names must be between 2 and 100 characters.';
  end if;

  if not exists (
    select 1
    from public.projects
    where id = p_project_id
      and created_by = current_user_id
  ) then
    raise exception 'Only the project creator can set up its organisation.';
  end if;

  if exists (
    select 1 from public.organisations where project_id = p_project_id
  ) then
    raise exception 'This project already has an organisation.';
  end if;

  select lower(email)
  into current_email
  from auth.users
  where id = current_user_id;

  if current_email is null then
    raise exception 'Your account must have an email address to create an organisation.';
  end if;

  insert into public.organisations (name, project_id)
  values (clean_name, p_project_id)
  returning id into new_organisation_id;

  insert into public.organisation_members (organisation_id, user_id, email, role)
  values (new_organisation_id, current_user_id, current_email, 'owner');

  return new_organisation_id;
end;
$$;

create or replace function public.add_organisation_member(
  p_organisation_id uuid,
  p_email text,
  p_role text
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
  caller_membership_role text;
  clean_email text := lower(btrim(p_email));
  target_confirmed boolean;
begin
  if current_user_id is null then
    raise exception 'Sign in to manage organisation members.';
  end if;

  select role
  into caller_membership_role
  from public.organisation_members
  where organisation_id = p_organisation_id
    and user_id = current_user_id
    and status = 'active';

  if caller_membership_role is null then
    raise exception 'You are not an active member of this organisation.';
  end if;

  if caller_membership_role not in ('owner', 'admin') then
    raise exception 'Only organisation owners and admins can add members.';
  end if;

  if p_role not in ('admin', 'member')
    or (caller_membership_role = 'admin' and p_role <> 'member') then
    raise exception 'You do not have permission to assign that role.';
  end if;

  if clean_email is null or clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address.';
  end if;

  select id, lower(email), email_confirmed_at is not null
  into target_user_id, target_email, target_confirmed
  from auth.users
  where lower(email) = clean_email;

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
    status
  )
  values (
    p_organisation_id,
    target_user_id,
    target_email,
    p_role,
    'active'
  );
exception
  when unique_violation then
    raise exception 'That account is already a member of this organisation.';
end;
$$;

create function public.attach_invited_organisation_member(
  p_organisation_id uuid,
  p_email text,
  p_role text
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
  caller_membership_role text;
  clean_email text := lower(btrim(p_email));
begin
  if current_user_id is null then
    raise exception 'Sign in to manage organisation members.';
  end if;

  select role
  into caller_membership_role
  from public.organisation_members
  where organisation_id = p_organisation_id
    and user_id = current_user_id
    and status = 'active';

  if caller_membership_role is null then
    raise exception 'You are not an active member of this organisation.';
  end if;

  if caller_membership_role not in ('owner', 'admin') then
    raise exception 'Only organisation owners and admins can invite members.';
  end if;

  if p_role not in ('admin', 'member')
    or (caller_membership_role = 'admin' and p_role <> 'member') then
    raise exception 'You do not have permission to assign that role.';
  end if;

  select id, lower(email)
  into target_user_id, target_email
  from auth.users
  where lower(email) = clean_email
    and email_confirmed_at is null;

  if target_user_id is null then
    raise exception 'The invited account was not found or has already confirmed its email.';
  end if;

  insert into public.organisation_members (
    organisation_id,
    user_id,
    email,
    role,
    status
  )
  values (
    p_organisation_id,
    target_user_id,
    target_email,
    p_role,
    'invited'
  );
exception
  when unique_violation then
    raise exception 'That account is already a member or has a pending invitation.';
end;
$$;

create function public.activate_organisation_memberships()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
begin
  if current_user_id is null then
    raise exception 'Sign in to accept organisation invitations.';
  end if;

  select lower(email)
  into current_email
  from auth.users
  where id = current_user_id
    and email_confirmed_at is not null;

  if current_email is null then
    return;
  end if;

  update public.organisation_members
  set status = 'active'
  where user_id = current_user_id
    and lower(email) = current_email
    and status = 'invited';
end;
$$;

revoke all on function public.create_project(text, text, text) from public, anon, authenticated;
revoke all on function public.create_project_organisation(uuid, text) from public, anon, authenticated;
revoke all on function public.create_organisation(text) from public, anon, authenticated;
revoke all on function public.add_organisation_member(uuid, text, text) from public, anon, authenticated;
revoke all on function public.attach_invited_organisation_member(uuid, text, text) from public, anon, authenticated;
revoke all on function public.activate_organisation_memberships() from public, anon, authenticated;
grant execute on function public.create_project(text, text, text) to authenticated;
grant execute on function public.create_project_organisation(uuid, text) to authenticated;
grant execute on function public.add_organisation_member(uuid, text, text) to authenticated;
grant execute on function public.attach_invited_organisation_member(uuid, text, text) to authenticated;
grant execute on function public.activate_organisation_memberships() to authenticated;
