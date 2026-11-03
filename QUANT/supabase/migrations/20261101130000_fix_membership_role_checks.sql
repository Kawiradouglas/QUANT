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

  select member.role
  into caller_membership_role
  from public.organisation_members as member
  where member.organisation_id = p_organisation_id
    and member.user_id = current_user_id
    and member.status = 'active';

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

create or replace function public.attach_invited_organisation_member(
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

  select member.role
  into caller_membership_role
  from public.organisation_members as member
  where member.organisation_id = p_organisation_id
    and member.user_id = current_user_id
    and member.status = 'active';

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

create or replace function public.update_organisation_member_role(
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
  target_membership_role text;
begin
  if current_user_id is null then
    raise exception 'Sign in to manage organisation members.';
  end if;

  select member.role
  into caller_membership_role
  from public.organisation_members as member
  where member.organisation_id = p_organisation_id
    and member.user_id = current_user_id
    and member.status = 'active';

  if caller_membership_role is distinct from 'owner' then
    raise exception 'Only the organisation owner can change member roles.';
  end if;

  if p_role not in ('admin', 'member') then
    raise exception 'Choose admin or member as the new role.';
  end if;

  select member.role
  into target_membership_role
  from public.organisation_members as member
  where member.organisation_id = p_organisation_id
    and member.user_id = p_user_id;

  if target_membership_role is null then
    raise exception 'That account is not a member of this organisation.';
  end if;

  if target_membership_role = 'owner' then
    raise exception 'The organisation owner role cannot be changed.';
  end if;

  update public.organisation_members
  set role = p_role
  where organisation_id = p_organisation_id
    and user_id = p_user_id;
end;
$$;

revoke all on function public.add_organisation_member(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.attach_invited_organisation_member(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.update_organisation_member_role(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.add_organisation_member(uuid, text, text)
  to authenticated;
grant execute on function public.attach_invited_organisation_member(uuid, text, text)
  to authenticated;
grant execute on function public.update_organisation_member_role(uuid, uuid, text)
  to authenticated;
