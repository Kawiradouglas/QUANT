create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  responsible_user_id uuid not null references auth.users(id) on delete restrict,
  responsible_email text not null,
  planned_start date not null,
  planned_finish date not null,
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'at_risk', 'completed')),
  progress_percent smallint not null default 0
    check (progress_percent between 0 and 100),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (planned_finish >= planned_start)
);

create index project_milestones_project_idx
  on public.project_milestones (project_id, planned_start);
create index project_milestones_responsible_idx
  on public.project_milestones (responsible_user_id, status);

create table public.project_milestone_updates (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null
    references public.project_milestones(id) on delete cascade,
  progress_percent smallint not null check (progress_percent between 0 and 100),
  update_note text not null check (char_length(update_note) between 2 and 2000),
  storage_path text unique,
  file_name text check (file_name is null or char_length(file_name) between 1 and 200),
  content_type text,
  file_size integer check (file_size is null or file_size between 1 and 10485760),
  submitted_by uuid not null references auth.users(id) on delete restrict,
  submitted_by_email text,
  status text not null default 'submitted'
    check (status in ('submitted', 'revision_requested', 'approved')),
  review_note text not null default '' check (char_length(review_note) <= 1000),
  reviewed_by_email text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (storage_path is null and file_name is null and content_type is null and file_size is null)
    or
    (storage_path is not null and file_name is not null and content_type is not null and file_size is not null)
  )
);

create index project_milestone_updates_milestone_idx
  on public.project_milestone_updates (milestone_id, created_at desc);

create table public.project_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null
    check (kind in ('announcement', 'meeting', 'site_visit', 'other')),
  title text not null check (char_length(title) between 2 and 200),
  details text not null default '' check (char_length(details) <= 4000),
  starts_at timestamptz,
  location text not null default '' check (char_length(location) <= 300),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_by_email text,
  created_at timestamptz not null default now(),
  check (kind = 'announcement' or starts_at is not null)
);

create index project_events_project_idx
  on public.project_events (project_id, starts_at, created_at desc);

create table public.project_notifications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 2 and 60),
  title text not null check (char_length(title) between 2 and 200),
  message text not null default '' check (char_length(message) <= 500),
  entity_type text not null check (char_length(entity_type) between 2 and 60),
  entity_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index project_notifications_recipient_idx
  on public.project_notifications (recipient_user_id, created_at desc);
create index project_notifications_unread_idx
  on public.project_notifications (recipient_user_id, created_at desc)
  where read_at is null;

alter table public.project_milestones enable row level security;
alter table public.project_milestone_updates enable row level security;
alter table public.project_events enable row level security;
alter table public.project_notifications enable row level security;

create or replace function public.is_active_project_member(p_project_id uuid)
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

create or replace function public.can_access_project_milestone(
  p_milestone_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_milestones as milestone
    where milestone.id = p_milestone_id
      and public.is_active_project_member(milestone.project_id)
  );
$$;

create or replace function public.can_submit_project_milestone_update(
  p_milestone_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_milestones as milestone
    join public.organisations as organisation
      on organisation.project_id = milestone.project_id
    join public.organisation_members as member
      on member.organisation_id = organisation.id
    where milestone.id = p_milestone_id
      and milestone.responsible_user_id = (select auth.uid())
      and milestone.status <> 'completed'
      and not exists (
        select 1
        from public.project_milestone_updates as milestone_update
        where milestone_update.milestone_id = milestone.id
          and milestone_update.status = 'submitted'
      )
      and member.user_id = (select auth.uid())
      and member.status = 'active'
  );
$$;

revoke all on function public.is_active_project_member(uuid)
  from public, anon;
revoke all on function public.can_access_project_milestone(uuid)
  from public, anon;
revoke all on function public.can_submit_project_milestone_update(uuid)
  from public, anon;
grant execute on function public.is_active_project_member(uuid)
  to authenticated;
grant execute on function public.can_access_project_milestone(uuid)
  to authenticated;
grant execute on function public.can_submit_project_milestone_update(uuid)
  to authenticated;

create policy "Project members can view milestones"
  on public.project_milestones
  for select
  to authenticated
  using (public.is_active_project_member(project_id));

create policy "Project members can view milestone progress updates"
  on public.project_milestone_updates
  for select
  to authenticated
  using (
    public.can_access_project_milestone(milestone_id)
  );

create policy "Project members can view project events"
  on public.project_events
  for select
  to authenticated
  using (public.is_active_project_member(project_id));

create policy "Recipients can view their project notifications"
  on public.project_notifications
  for select
  to authenticated
  using (recipient_user_id = (select auth.uid()));

revoke all on public.project_milestones from anon, authenticated;
revoke all on public.project_milestone_updates from anon, authenticated;
revoke all on public.project_events from anon, authenticated;
revoke all on public.project_notifications from anon, authenticated;
grant select on public.project_milestones to authenticated;
grant select on public.project_milestone_updates to authenticated;
grant select on public.project_events to authenticated;
grant select on public.project_notifications to authenticated;

create function public.record_project_activity(
  p_project_id uuid,
  p_actor_id uuid,
  p_event_type text,
  p_title text,
  p_message text,
  p_entity_type text,
  p_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.project_notifications (
    project_id,
    recipient_user_id,
    event_type,
    title,
    message,
    entity_type,
    entity_id
  )
  select
    p_project_id,
    member.user_id,
    p_event_type,
    p_title,
    left(p_message, 500),
    p_entity_type,
    p_entity_id
  from public.organisations as organisation
  join public.organisation_members as member
    on member.organisation_id = organisation.id
  where organisation.project_id = p_project_id
    and member.status = 'active'
    and member.user_id is distinct from p_actor_id;

  insert into public.project_notifications (
    project_id,
    recipient_user_id,
    event_type,
    title,
    message,
    entity_type,
    entity_id
  )
  select
    project.id,
    project.created_by,
    p_event_type,
    p_title,
    left(p_message, 500),
    p_entity_type,
    p_entity_id
  from public.projects as project
  where project.id = p_project_id
    and project.created_by is distinct from p_actor_id
    and not exists (
      select 1
      from public.organisations as organisation
      join public.organisation_members as member
        on member.organisation_id = organisation.id
      where organisation.project_id = project.id
        and member.user_id = project.created_by
        and member.status = 'active'
    );
end;
$$;

create function public.notify_membership_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_project_id uuid;
  actor_id uuid := auth.uid();
begin
  select project_id
  into target_project_id
  from public.organisations
  where id = new.organisation_id;

  if target_project_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'invited' then
      insert into public.project_notifications (
        project_id, recipient_user_id, event_type, title, message,
        entity_type, entity_id
      )
      values (
        target_project_id, new.user_id, 'invitation', 'Project invitation',
        'You have been invited to join a project team.',
        'membership', new.organisation_id
      );
    elsif new.status = 'active' then
      perform public.record_project_activity(
        target_project_id, actor_id, 'member_joined', 'New project member',
        new.email || ' joined the project team.',
        'membership', new.organisation_id
      );
    end if;
    return new;
  end if;

  if old.status is distinct from new.status and new.status = 'active' then
    perform public.record_project_activity(
      target_project_id, actor_id, 'member_joined', 'New project member',
      new.email || ' joined the project team.',
      'membership', new.organisation_id
    );
  elsif old.project_access_role is distinct from new.project_access_role
    or old.professional_role is distinct from new.professional_role then
    if new.status <> 'active' then
      insert into public.project_notifications (
        project_id, recipient_user_id, event_type, title, message,
        entity_type, entity_id
      )
      values (
        target_project_id, new.user_id, 'role_changed',
        'Your project role changed',
        'Your project access or professional role was updated.',
        'membership', new.organisation_id
      );
    end if;
    perform public.record_project_activity(
      target_project_id, coalesce(actor_id, new.user_id), 'role_changed',
      'Project role updated', new.email || '''s project role was updated.',
      'membership', new.organisation_id
    );
  end if;

  return new;
end;
$$;

create trigger project_membership_activity
  after insert or update of status, project_access_role, professional_role
  on public.organisation_members
  for each row
  execute function public.notify_membership_activity();

create function public.notify_project_task_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  activity_title text;
  activity_message text;
  activity_type text;
begin
  if tg_op = 'INSERT' then
    activity_type := 'task_assigned';
    activity_title := 'New task assigned';
    activity_message := new.title || ' was assigned to ' || new.assignee_email || '.';
  else
    activity_type := 'task_' || new.status;
    activity_title := case new.status
      when 'submitted' then 'Task submitted for review'
      when 'completed' then 'Task completed'
      when 'revision_requested' then 'Task changes requested'
      else 'Task status updated'
    end;
    activity_message := new.title || ' is now ' ||
      replace(new.status, '_', ' ') || '.';
  end if;

  perform public.record_project_activity(
    new.project_id, auth.uid(), activity_type, activity_title,
    activity_message, 'task', new.id
  );
  return new;
end;
$$;

create trigger project_task_activity_insert
  after insert on public.project_tasks
  for each row
  execute function public.notify_project_task_activity();
create trigger project_task_activity_status
  after update of status on public.project_tasks
  for each row
  when (old.status is distinct from new.status)
  execute function public.notify_project_task_activity();

create function public.notify_project_document_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_project_id uuid;
  document_title text;
begin
  select project_id, title
  into target_project_id, document_title
  from public.project_documents
  where id = new.document_id;

  if target_project_id is not null then
    perform public.record_project_activity(
      target_project_id, new.uploaded_by, 'document_added',
      'Project document updated', document_title || ' has a new document version.',
      'document', new.document_id
    );
  end if;
  return new;
end;
$$;

create trigger project_document_activity
  after insert on public.project_document_versions
  for each row
  execute function public.notify_project_document_activity();

create function public.create_project_milestone(
  p_project_id uuid,
  p_title text,
  p_description text,
  p_responsible_user_id uuid,
  p_planned_start date,
  p_planned_finish date
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
  responsible_member_email text;
  new_milestone_id uuid;
begin
  if current_user_id is null then
    raise exception 'Sign in to create project milestones.';
  end if;
  if not public.can_manage_project_documents(p_project_id) then
    raise exception 'Only the client or project manager can create milestones.';
  end if;
  if clean_title is null or char_length(clean_title) not between 2 and 200 then
    raise exception 'Milestone titles must be between 2 and 200 characters.';
  end if;
  if char_length(clean_description) > 2000 then
    raise exception 'Milestone details must be 2000 characters or fewer.';
  end if;
  if p_planned_start is null or p_planned_finish is null
    or p_planned_finish < p_planned_start then
    raise exception 'Choose valid milestone start and finish dates.';
  end if;

  select lower(member.email)
  into responsible_member_email
  from public.organisations as organisation
  join public.organisation_members as member
    on member.organisation_id = organisation.id
  where organisation.project_id = p_project_id
    and member.user_id = p_responsible_user_id
    and member.status = 'active'
    and member.project_access_role in ('member', 'project_manager');
  if responsible_member_email is null then
    raise exception 'Assign the milestone to an active project member or project manager.';
  end if;

  insert into public.project_milestones (
    project_id, title, description, responsible_user_id, responsible_email,
    planned_start, planned_finish, created_by
  )
  values (
    p_project_id, clean_title, clean_description, p_responsible_user_id,
    responsible_member_email, p_planned_start, p_planned_finish, current_user_id
  )
  returning id into new_milestone_id;
  return new_milestone_id;
end;
$$;

create function public.update_project_milestone(
  p_milestone_id uuid,
  p_title text,
  p_description text,
  p_responsible_user_id uuid,
  p_planned_start date,
  p_planned_finish date,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_project_id uuid;
  responsible_member_email text;
  clean_title text := btrim(p_title);
  clean_description text := coalesce(btrim(p_description), '');
begin
  if auth.uid() is null then
    raise exception 'Sign in to update project milestones.';
  end if;
  select project_id into target_project_id
  from public.project_milestones
  where id = p_milestone_id
  for update;
  if target_project_id is null then
    raise exception 'The project milestone was not found.';
  end if;
  if not public.can_manage_project_documents(target_project_id) then
    raise exception 'Only the client or project manager can update milestones.';
  end if;
  if clean_title is null or char_length(clean_title) not between 2 and 200
    or char_length(clean_description) > 2000 then
    raise exception 'Enter a milestone title and details within the allowed limits.';
  end if;
  if p_planned_start is null or p_planned_finish is null
    or p_planned_finish < p_planned_start then
    raise exception 'Choose valid milestone start and finish dates.';
  end if;
  if p_status is null
    or p_status not in ('planned', 'in_progress', 'at_risk', 'completed') then
    raise exception 'Choose a valid milestone status.';
  end if;

  select lower(member.email)
  into responsible_member_email
  from public.organisations as organisation
  join public.organisation_members as member
    on member.organisation_id = organisation.id
  where organisation.project_id = target_project_id
    and member.user_id = p_responsible_user_id
    and member.status = 'active'
    and member.project_access_role in ('member', 'project_manager');
  if responsible_member_email is null then
    raise exception 'Assign the milestone to an active project member or project manager.';
  end if;

  update public.project_milestones
  set title = clean_title,
      description = clean_description,
      responsible_user_id = p_responsible_user_id,
      responsible_email = responsible_member_email,
      planned_start = p_planned_start,
      planned_finish = p_planned_finish,
      status = p_status,
      progress_percent = case
        when p_status = 'completed' then 100
        else progress_percent
      end,
      updated_at = now()
  where id = p_milestone_id;
end;
$$;

create function public.submit_project_milestone_update(
  p_milestone_id uuid,
  p_progress_percent integer,
  p_update_note text,
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
  clean_note text := btrim(p_update_note);
  current_email text;
  new_update_id uuid := gen_random_uuid();
begin
  if current_user_id is null then
    raise exception 'Sign in to submit milestone progress.';
  end if;
  select project_id into target_project_id
  from public.project_milestones
  where id = p_milestone_id
  for update;
  if target_project_id is null then
    raise exception 'The project milestone was not found.';
  end if;
  if not public.can_submit_project_milestone_update(p_milestone_id) then
    raise exception 'Only the responsible active project member can submit progress.';
  end if;
  if p_progress_percent is null or p_progress_percent not between 0 and 100 then
    raise exception 'Progress must be between 0 and 100 percent.';
  end if;
  if clean_note is null or char_length(clean_note) not between 2 and 2000 then
    raise exception 'Progress notes must be between 2 and 2000 characters.';
  end if;

  if p_storage_path is null then
    if p_file_name is not null or p_content_type is not null or p_file_size is not null then
      raise exception 'Provide all attachment details or omit the attachment.';
    end if;
  else
    if p_file_name is null or p_content_type is null or p_file_size is null
      or not public.is_valid_project_document_file(
        p_file_name, p_content_type, p_file_size
      ) then
      raise exception 'Choose a supported milestone file no larger than 10 MB.';
    end if;
    if p_storage_path not like
      target_project_id::text || '/milestone-updates/' ||
      p_milestone_id::text || '/%' then
      raise exception 'The uploaded file path does not match this milestone.';
    end if;
    if not exists (
      select 1 from storage.objects
      where bucket_id = 'project-documents' and name = p_storage_path
    ) then
      raise exception 'Upload the progress attachment before submitting it.';
    end if;
  end if;

  select lower(email) into current_email
  from auth.users where id = current_user_id;

  insert into public.project_milestone_updates (
    id, milestone_id, progress_percent, update_note, storage_path,
    file_name, content_type, file_size, submitted_by, submitted_by_email
  )
  values (
    new_update_id, p_milestone_id, p_progress_percent, clean_note,
    p_storage_path, p_file_name, p_content_type, p_file_size,
    current_user_id, current_email
  );
  return new_update_id;
end;
$$;

create function public.review_project_milestone_update(
  p_update_id uuid,
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
  target_milestone_id uuid;
  target_project_id uuid;
  target_progress integer;
  clean_note text := btrim(p_review_note);
  current_email text;
begin
  if current_user_id is null then
    raise exception 'Sign in to review milestone progress.';
  end if;
  select milestone.id, milestone.project_id, milestone_update.progress_percent
  into target_milestone_id, target_project_id, target_progress
  from public.project_milestone_updates as milestone_update
  join public.project_milestones as milestone
    on milestone.id = milestone_update.milestone_id
  where milestone_update.id = p_update_id
  for update of milestone_update;
  if target_milestone_id is null then
    raise exception 'The milestone progress update was not found.';
  end if;
  if not public.can_manage_project_documents(target_project_id) then
    raise exception 'Only the client or project manager can review milestone progress.';
  end if;
  if p_decision is null or p_decision not in ('approve', 'request_changes') then
    raise exception 'Choose approve or request changes.';
  end if;
  if p_decision = 'request_changes'
    and (
      clean_note is null
      or char_length(clean_note) not between 2 and 1000
    ) then
    raise exception 'Give review instructions between 2 and 1000 characters.';
  end if;
  if not exists (
    select 1 from public.project_milestone_updates
    where id = p_update_id and status = 'submitted'
  ) then
    raise exception 'This milestone update is not awaiting review.';
  end if;

  select lower(email) into current_email
  from auth.users where id = current_user_id;

  update public.project_milestone_updates
  set status = case when p_decision = 'approve'
        then 'approved' else 'revision_requested' end,
      review_note = case when p_decision = 'approve'
        then '' else clean_note end,
      reviewed_by_email = current_email,
      reviewed_at = now()
  where id = p_update_id and status = 'submitted';

  if p_decision = 'approve' then
    update public.project_milestones
    set progress_percent = target_progress,
        status = case when target_progress = 100
          then 'completed'
          when status = 'planned' then 'in_progress'
          else status end,
        updated_at = now()
    where id = target_milestone_id;
  end if;
end;
$$;

create function public.create_project_event(
  p_project_id uuid,
  p_kind text,
  p_title text,
  p_details text,
  p_starts_at timestamptz,
  p_location text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  clean_title text := btrim(p_title);
  clean_details text := coalesce(btrim(p_details), '');
  clean_location text := coalesce(btrim(p_location), '');
  current_email text;
  new_event_id uuid;
begin
  if current_user_id is null then
    raise exception 'Sign in to publish project events.';
  end if;
  if not public.can_manage_project_documents(p_project_id) then
    raise exception 'Only the client or project manager can publish events and announcements.';
  end if;
  if p_kind is null
    or p_kind not in ('announcement', 'meeting', 'site_visit', 'other') then
    raise exception 'Choose a valid event type.';
  end if;
  if clean_title is null or char_length(clean_title) not between 2 and 200 then
    raise exception 'Titles must be between 2 and 200 characters.';
  end if;
  if char_length(clean_details) > 4000 or char_length(clean_location) > 300 then
    raise exception 'Event details or location exceed the allowed length.';
  end if;
  if p_kind <> 'announcement' and p_starts_at is null then
    raise exception 'Choose a date and time for this event.';
  end if;

  select lower(email) into current_email
  from auth.users where id = current_user_id;
  insert into public.project_events (
    project_id, kind, title, details, starts_at, location,
    created_by, created_by_email
  )
  values (
    p_project_id, p_kind, clean_title, clean_details, p_starts_at,
    clean_location, current_user_id, current_email
  )
  returning id into new_event_id;
  return new_event_id;
end;
$$;

create function public.mark_project_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.project_notifications
  set read_at = now()
  where id = p_notification_id
    and recipient_user_id = auth.uid()
    and read_at is null;
  if not found then
    raise exception 'The notification was not found or is already read.';
  end if;
end;
$$;

create function public.mark_all_project_notifications_read()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to update notifications.';
  end if;
  update public.project_notifications
  set read_at = now()
  where recipient_user_id = auth.uid()
    and read_at is null;
end;
$$;

create function public.notify_milestone_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_project_id uuid;
  target_title text;
  target_user_id uuid;
begin
  if tg_table_name = 'project_milestones' then
    target_project_id := new.project_id;
    target_title := new.title;
    target_user_id := new.created_by;
    perform public.record_project_activity(
      target_project_id, target_user_id, 'milestone_created',
      'New project milestone', target_title || ' was added to the project schedule.',
      'milestone', new.id
    );
  else
    select project_id, title into target_project_id, target_title
    from public.project_milestones where id = new.milestone_id;
    target_user_id := case
      when tg_op = 'INSERT' then new.submitted_by
      else auth.uid()
    end;
    perform public.record_project_activity(
      target_project_id, target_user_id, 'milestone_update',
      case when tg_op = 'INSERT' then 'Milestone progress submitted'
        else 'Milestone progress reviewed' end,
      target_title || case
        when tg_op = 'INSERT' then ' has a new progress update.'
        else ' progress update was reviewed.'
      end,
      'milestone', new.milestone_id
    );
  end if;
  return new;
end;
$$;

create trigger project_milestone_activity
  after insert on public.project_milestones
  for each row execute function public.notify_milestone_activity();
create trigger project_milestone_update_activity
  after insert or update of status on public.project_milestone_updates
  for each row execute function public.notify_milestone_activity();

create function public.notify_project_milestone_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.record_project_activity(
    new.project_id, auth.uid(), 'milestone_updated',
    'Project milestone updated',
    new.title || ' schedule or ownership was updated.',
    'milestone', new.id
  );
  return new;
end;
$$;

create trigger project_milestone_change_activity
  after update of responsible_user_id, planned_start, planned_finish, status
  on public.project_milestones
  for each row
  when (
    old.responsible_user_id is distinct from new.responsible_user_id
    or old.planned_start is distinct from new.planned_start
    or old.planned_finish is distinct from new.planned_finish
    or old.status is distinct from new.status
  )
  execute function public.notify_project_milestone_change();

create function public.notify_project_event_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.record_project_activity(
    new.project_id, new.created_by,
    case when new.kind = 'announcement' then 'announcement' else 'event' end,
    case when new.kind = 'announcement' then 'New project announcement'
      else 'New project event' end,
    new.title || case when new.starts_at is null then ''
      else ' · ' || to_char(new.starts_at at time zone 'UTC', 'Mon DD, YYYY HH24:MI') || ' UTC'
    end,
    'event', new.id
  );
  return new;
end;
$$;

create trigger project_event_activity
  after insert on public.project_events
  for each row execute function public.notify_project_event_activity();

create function public.notify_project_configuration_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.record_project_activity(
    new.id, auth.uid(), 'project_updated', 'Project details updated',
    'Project name or delivery mode was updated.',
    'project', new.id
  );
  return new;
end;
$$;

create trigger project_configuration_activity
  after update of name, delivery_mode on public.projects
  for each row
  when (
    old.name is distinct from new.name
    or old.delivery_mode is distinct from new.delivery_mode
  )
  execute function public.notify_project_configuration_activity();

revoke all on function public.record_project_activity(
  uuid, uuid, text, text, text, text, uuid
) from public, anon, authenticated;
revoke all on function public.create_project_milestone(
  uuid, text, text, uuid, date, date
) from public, anon, authenticated;
revoke all on function public.update_project_milestone(
  uuid, text, text, uuid, date, date, text
) from public, anon, authenticated;
revoke all on function public.submit_project_milestone_update(
  uuid, integer, text, text, text, text, integer
) from public, anon, authenticated;
revoke all on function public.review_project_milestone_update(
  uuid, text, text
) from public, anon, authenticated;
revoke all on function public.create_project_event(
  uuid, text, text, text, timestamptz, text
) from public, anon, authenticated;
revoke all on function public.mark_project_notification_read(uuid)
  from public, anon, authenticated;
revoke all on function public.mark_all_project_notifications_read()
  from public, anon, authenticated;

grant execute on function public.create_project_milestone(
  uuid, text, text, uuid, date, date
) to authenticated;
grant execute on function public.update_project_milestone(
  uuid, text, text, uuid, date, date, text
) to authenticated;
grant execute on function public.submit_project_milestone_update(
  uuid, integer, text, text, text, text, integer
) to authenticated;
grant execute on function public.review_project_milestone_update(
  uuid, text, text
) to authenticated;
grant execute on function public.create_project_event(
  uuid, text, text, text, timestamptz, text
) to authenticated;
grant execute on function public.mark_project_notification_read(uuid)
  to authenticated;
grant execute on function public.mark_all_project_notifications_read()
  to authenticated;

create policy "Assigned members can upload milestone progress files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'project-documents'
    and case
      when (storage.foldername(name))[1] ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and (storage.foldername(name))[2] = 'milestone-updates'
        and (storage.foldername(name))[3] ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.can_submit_project_milestone_update(
        ((storage.foldername(name))[3])::uuid
      )
        and exists (
          select 1
          from public.project_milestones as milestone
          where milestone.id = ((storage.foldername(name))[3])::uuid
            and milestone.responsible_user_id = (select auth.uid())
            and milestone.status <> 'completed'
        )
        and exists (
          select 1
          from public.project_milestones as milestone
          where milestone.id = ((storage.foldername(name))[3])::uuid
            and milestone.project_id = ((storage.foldername(name))[1])::uuid
        )
      else false
    end
  );

create policy "Assigned members can remove unregistered milestone files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'project-documents'
    and case
      when (storage.foldername(name))[1] ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and (storage.foldername(name))[2] = 'milestone-updates'
        and (storage.foldername(name))[3] ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.can_access_project_milestone(
        ((storage.foldername(name))[3])::uuid
      )
        and exists (
          select 1
          from public.project_milestones as milestone
          where milestone.id = ((storage.foldername(name))[3])::uuid
            and milestone.responsible_user_id = (select auth.uid())
            and milestone.status <> 'completed'
        )
        and not exists (
          select 1
          from public.project_milestone_updates as milestone_update
          where milestone_update.storage_path = name
        )
      else false
    end
  );
