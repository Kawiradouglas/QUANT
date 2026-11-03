create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  created_at timestamptz not null default now()
);

create table public.organisation_members (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organisation_id, user_id)
);

create index organisation_members_user_id_idx
  on public.organisation_members (user_id);

alter table public.organisations enable row level security;
alter table public.organisation_members enable row level security;

create function public.is_organisation_member(p_organisation_id uuid)
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
  );
$$;

revoke all on function public.is_organisation_member(uuid) from public, anon;
grant execute on function public.is_organisation_member(uuid) to authenticated;

create policy "Members can view their organisations"
  on public.organisations
  for select
  to authenticated
  using (public.is_organisation_member(id));

create policy "Members can view their organisation membership"
  on public.organisation_members
  for select
  to authenticated
  using (public.is_organisation_member(organisation_id));

revoke all on public.organisations from anon, authenticated;
revoke all on public.organisation_members from anon, authenticated;
grant select on public.organisations to authenticated;
grant select on public.organisation_members to authenticated;

create function public.create_organisation(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  new_organisation_id uuid;
  clean_name text := btrim(p_name);
begin
  if current_user_id is null then
    raise exception 'Sign in to create an organisation.';
  end if;

  if clean_name is null or char_length(clean_name) < 2 or char_length(clean_name) > 100 then
    raise exception 'Organisation names must be between 2 and 100 characters.';
  end if;

  select lower(email)
  into current_email
  from auth.users
  where id = current_user_id;

  if current_email is null then
    raise exception 'Your account must have an email address to create an organisation.';
  end if;

  insert into public.organisations (name)
  values (clean_name)
  returning id into new_organisation_id;

  insert into public.organisation_members (organisation_id, user_id, email, role)
  values (new_organisation_id, current_user_id, current_email, 'owner');

  return new_organisation_id;
end;
$$;

create function public.add_organisation_member(
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
    and user_id = current_user_id;

  if caller_membership_role is null then
    raise exception 'You are not a member of this organisation.';
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

  select id, lower(email)
  into target_user_id, target_email
  from auth.users
  where lower(email) = clean_email
    and email_confirmed_at is not null;

  if target_user_id is null then
    raise exception 'No confirmed account was found for that email address.';
  end if;

  insert into public.organisation_members (organisation_id, user_id, email, role)
  values (p_organisation_id, target_user_id, target_email, p_role);
exception
  when unique_violation then
    raise exception 'That account is already a member of this organisation.';
end;
$$;

create function public.update_organisation_member_role(
  p_organisation_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  caller_membership_role text;
  target_role text;
begin
  if current_user_id is null then
    raise exception 'Sign in to manage organisation members.';
  end if;

  select role
  into caller_membership_role
  from public.organisation_members
  where organisation_id = p_organisation_id
    and user_id = current_user_id;

  if caller_membership_role is distinct from 'owner' then
    raise exception 'Only the organisation owner can change member roles.';
  end if;

  if p_role not in ('admin', 'member') then
    raise exception 'Choose admin or member as the new role.';
  end if;

  select role
  into target_role
  from public.organisation_members
  where organisation_id = p_organisation_id
    and user_id = p_user_id;

  if target_role is null then
    raise exception 'That account is not a member of this organisation.';
  end if;

  if target_role = 'owner' then
    raise exception 'The organisation owner role cannot be changed.';
  end if;

  update public.organisation_members
  set role = p_role
  where organisation_id = p_organisation_id
    and user_id = p_user_id;
end;
$$;

revoke all on function public.create_organisation(text) from public, anon, authenticated;
revoke all on function public.add_organisation_member(uuid, text, text) from public, anon, authenticated;
revoke all on function public.update_organisation_member_role(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.create_organisation(text) to authenticated;
grant execute on function public.add_organisation_member(uuid, text, text) to authenticated;
grant execute on function public.update_organisation_member_role(uuid, uuid, text) to authenticated;
