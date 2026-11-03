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

  update public.projects
  set
    name = clean_name,
    contract_type = clean_contract_type,
    delivery_mode = clean_delivery_mode
  where id = p_project_id
    and created_by = current_user_id;

  if not found then
    raise exception 'Only the project manager who created this project can change its configuration.';
  end if;
end;
$$;

revoke all on function public.update_project_configuration(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.update_project_configuration(uuid, text, text, text)
  to authenticated;
