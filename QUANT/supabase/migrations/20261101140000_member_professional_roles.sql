alter table public.organisation_members
  add column professional_role text
  check (
    professional_role is null
    or char_length(btrim(professional_role)) between 2 and 80
  );

create function public.set_organisation_member_professional_role(
  p_organisation_id uuid,
  p_professional_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  clean_professional_role text := btrim(p_professional_role);
begin
  if current_user_id is null then
    raise exception 'Sign in to save your project role.';
  end if;

  if clean_professional_role is null
    or char_length(clean_professional_role) < 2
    or char_length(clean_professional_role) > 80 then
    raise exception 'Project roles must be between 2 and 80 characters.';
  end if;

  update public.organisation_members
  set professional_role = clean_professional_role
  where organisation_id = p_organisation_id
    and user_id = current_user_id
    and status = 'active'
    and role in ('admin', 'member');

  if not found then
    raise exception 'You do not have an active member invitation for this project.';
  end if;
end;
$$;

revoke all on function public.set_organisation_member_professional_role(uuid, text)
  from public, anon, authenticated;
grant execute on function public.set_organisation_member_professional_role(uuid, text)
  to authenticated;
