create table public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 200),
  reference_number text check (
    reference_number is null or char_length(reference_number) <= 100
  ),
  category text not null check (
    category in (
      'Contract',
      'Drawing',
      'Specification',
      'Report',
      'Correspondence',
      'Other'
    )
  ),
  description text not null default '' check (char_length(description) <= 1000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index project_documents_project_id_idx
  on public.project_documents (project_id, created_at desc);

create table public.project_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.project_documents(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200),
  content_type text not null,
  file_size integer not null check (file_size between 1 and 10485760),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  uploaded_by_email text,
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);

create index project_document_versions_document_id_idx
  on public.project_document_versions (document_id, version_number desc);

alter table public.project_documents enable row level security;
alter table public.project_document_versions enable row level security;

create or replace function public.can_access_project_documents(
  p_project_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects as project
    where project.id = p_project_id
      and (
        project.created_by = (select auth.uid())
        or exists (
          select 1
          from public.organisations as organisation
          join public.organisation_members as member
            on member.organisation_id = organisation.id
          where organisation.project_id = project.id
            and member.user_id = (select auth.uid())
            and member.status = 'active'
        )
      )
  );
$$;

create or replace function public.can_manage_project_documents(
  p_project_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects as project
    where project.id = p_project_id
      and (
        project.created_by = (select auth.uid())
        or exists (
          select 1
          from public.organisations as organisation
          join public.organisation_members as member
            on member.organisation_id = organisation.id
          where organisation.project_id = project.id
            and member.user_id = (select auth.uid())
            and member.status = 'active'
            and member.project_access_role = 'project_manager'
        )
      )
  );
$$;

revoke all on function public.can_access_project_documents(uuid)
  from public, anon;
revoke all on function public.can_manage_project_documents(uuid)
  from public, anon;
grant execute on function public.can_access_project_documents(uuid)
  to authenticated;
grant execute on function public.can_manage_project_documents(uuid)
  to authenticated;

create policy "Project members can view document registers"
  on public.project_documents
  for select
  to authenticated
  using (public.can_access_project_documents(project_id));

create policy "Project managers can view document versions"
  on public.project_document_versions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.project_documents as document
      where document.id = document_id
        and public.can_access_project_documents(document.project_id)
    )
  );

revoke all on public.project_documents from anon, authenticated;
revoke all on public.project_document_versions from anon, authenticated;
grant select on public.project_documents to authenticated;
grant select on public.project_document_versions to authenticated;

create function public.is_valid_project_document_file(
  p_file_name text,
  p_content_type text,
  p_file_size integer
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_file_name is not null
    and char_length(p_file_name) between 1 and 200
    and p_file_size between 1 and 10485760
    and p_content_type in (
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'text/plain'
    ), false);
$$;

create function public.create_project_document(
  p_project_id uuid,
  p_document_id uuid,
  p_title text,
  p_reference_number text,
  p_category text,
  p_description text,
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
  clean_title text := btrim(p_title);
  clean_reference text := nullif(btrim(p_reference_number), '');
  clean_description text := btrim(p_description);
  current_email text;
begin
  if current_user_id is null then
    raise exception 'Sign in to add project documents.';
  end if;
  if not public.can_manage_project_documents(p_project_id) then
    raise exception 'Only the client or an assigned project manager can upload project documents.';
  end if;
  if clean_title is null or char_length(clean_title) not between 2 and 200 then
    raise exception 'Document titles must be between 2 and 200 characters.';
  end if;
  if clean_reference is not null and char_length(clean_reference) > 100 then
    raise exception 'Document references must be 100 characters or fewer.';
  end if;
  if p_category not in (
    'Contract',
    'Drawing',
    'Specification',
    'Report',
    'Correspondence',
    'Other'
  ) then
    raise exception 'Choose a valid document category.';
  end if;
  if char_length(clean_description) > 1000 then
    raise exception 'Document descriptions must be 1000 characters or fewer.';
  end if;
  if not public.is_valid_project_document_file(
    p_file_name,
    p_content_type,
    p_file_size
  ) then
    raise exception 'Choose a supported file no larger than 10 MB.';
  end if;

  if p_document_id is null then
    raise exception 'Choose a valid document identifier.';
  end if;

  if p_storage_path not like
    p_project_id::text || '/' || p_document_id::text || '/%' then
    raise exception 'The uploaded file path does not match this project document.';
  end if;
  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'project-documents'
      and name = p_storage_path
  ) then
    raise exception 'Upload the document file before registering it.';
  end if;

  select lower(email)
  into current_email
  from auth.users
  where id = current_user_id;

  insert into public.project_documents (
    id,
    project_id,
    title,
    reference_number,
    category,
    description,
    created_by
  )
  values (
    p_document_id,
    p_project_id,
    clean_title,
    clean_reference,
    p_category,
    clean_description,
    current_user_id
  );

  insert into public.project_document_versions (
    document_id,
    version_number,
    storage_path,
    file_name,
    content_type,
    file_size,
    uploaded_by,
    uploaded_by_email
  )
  values (
    p_document_id,
    1,
    p_storage_path,
    p_file_name,
    p_content_type,
    p_file_size,
    current_user_id,
    current_email
  );

  return p_document_id;
end;
$$;

create function public.add_project_document_version(
  p_document_id uuid,
  p_storage_path text,
  p_file_name text,
  p_content_type text,
  p_file_size integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_project_id uuid;
  next_version integer;
  current_email text;
begin
  if current_user_id is null then
    raise exception 'Sign in to upload a document revision.';
  end if;

  select project_id
  into target_project_id
  from public.project_documents
  where id = p_document_id
  for update;

  if target_project_id is null then
    raise exception 'The project document was not found.';
  end if;
  if not public.can_manage_project_documents(target_project_id) then
    raise exception 'Only the client or an assigned project manager can upload document revisions.';
  end if;
  if not public.is_valid_project_document_file(
    p_file_name,
    p_content_type,
    p_file_size
  ) then
    raise exception 'Choose a supported file no larger than 10 MB.';
  end if;
  if p_storage_path not like
    target_project_id::text || '/' || p_document_id::text || '/%' then
    raise exception 'The uploaded file path does not match this project document.';
  end if;
  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'project-documents'
      and name = p_storage_path
  ) then
    raise exception 'Upload the revision file before registering it.';
  end if;

  select coalesce(max(version_number), 0) + 1
  into next_version
  from public.project_document_versions
  where document_id = p_document_id;

  select lower(email)
  into current_email
  from auth.users
  where id = current_user_id;

  insert into public.project_document_versions (
    document_id,
    version_number,
    storage_path,
    file_name,
    content_type,
    file_size,
    uploaded_by,
    uploaded_by_email
  )
  values (
    p_document_id,
    next_version,
    p_storage_path,
    p_file_name,
    p_content_type,
    p_file_size,
    current_user_id,
    current_email
  );

  return next_version;
end;
$$;

revoke all on function public.is_valid_project_document_file(text, text, integer)
  from public, anon, authenticated;
revoke all on function public.create_project_document(
  uuid, uuid, text, text, text, text, text, text, text, integer
) from public, anon, authenticated;
revoke all on function public.add_project_document_version(
  uuid, text, text, text, integer
) from public, anon, authenticated;
grant execute on function public.create_project_document(
  uuid, uuid, text, text, text, text, text, text, text, integer
) to authenticated;
grant execute on function public.add_project_document_version(
  uuid, text, text, text, integer
) to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'project-documents',
  'project-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'text/plain'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Project members can download project documents"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'project-documents'
    and case
      when (storage.foldername(name))[1] ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.can_access_project_documents(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

create policy "Project managers can upload project documents"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'project-documents'
    and case
      when (storage.foldername(name))[1] ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.can_manage_project_documents(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

create policy "Project managers can remove unregistered project files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'project-documents'
    and case
      when (storage.foldername(name))[1] ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.can_manage_project_documents(((storage.foldername(name))[1])::uuid)
      else false
    end
  );
