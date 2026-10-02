-- ══════════════════════════════════════════════════════════════════
-- Member notifications
--
-- Creates in-app notifications for members when something happens to them:
-- a badge is awarded, they're tagged in a photo, someone comments on or likes
-- their photo, they're added to a trip, or a trip they're on posts an update.
-- (News notifications are created by the news API on publish, because the
-- audience depends on tags saved after the post itself.)
--
-- Triggers run SECURITY DEFINER so they work no matter which client inserted
-- the row (browser, API route or service role). Members never get notified
-- about their own actions, and each category can be switched off per member
-- in profiles.notification_preferences.
-- ══════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists notification_preferences jsonb not null default '{}'::jsonb;

comment on column public.profiles.notification_preferences is
  'In-app notification switches, e.g. {"badges": true, "tags": true, "comments": true, "likes": false, "trips": true, "news": true}. Missing keys = on.';

-- Members can dismiss their own notifications (read + mark-read policies already exist).
drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- ── Helpers ───────────────────────────────────────────────────────

create or replace function public.member_display_name(p_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(p.nickname), ''), nullif(trim(p.full_name), ''), 'A rider')
  from public.profiles p
  where p.id = p_profile_id;
$$;

/**
 * Insert one notification unless the recipient is the actor, isn't an active
 * member, or has switched this category off.
 */
create or replace function public.notify_member(
  p_user_id uuid,
  p_category text,
  p_type text,
  p_title text,
  p_message text,
  p_link text default null,
  p_metadata jsonb default null,
  p_actor_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefs jsonb;
  v_status text;
begin
  if p_user_id is null or p_user_id = p_actor_id then
    return;
  end if;

  select notification_preferences, status into v_prefs, v_status
  from public.profiles
  where id = p_user_id;

  if v_status is distinct from 'active' then
    return;
  end if;

  if coalesce((v_prefs ->> p_category)::boolean, true) = false then
    return;
  end if;

  insert into public.notifications (user_id, type, title, message, link, metadata)
  values (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_link,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('category', p_category, 'actor_id', p_actor_id)
  );
exception when others then
  -- Never let a notification problem block the badge, tag or comment that triggered it.
  raise warning 'notify_member failed for %: %', p_user_id, sqlerrm;
end;
$$;

revoke all on function public.notify_member(uuid, text, text, text, text, text, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.member_display_name(uuid) from public, anon, authenticated;

-- ── Badge awarded ─────────────────────────────────────────────────

create or replace function public.notify_badge_awarded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_badge record;
  v_trip_name text;
begin
  select name, badge_type into v_badge from public.badges where id = new.badge_id;
  select name into v_trip_name from public.trips where id = new.trip_id;

  perform public.notify_member(
    new.user_id,
    'badges',
    'award',
    'New badge: ' || coalesce(v_badge.name, 'Badge'),
    case
      when v_trip_name is not null then 'You earned ' || coalesce(v_badge.name, 'a badge') || ' on ' || v_trip_name || '.'
      else 'You earned ' || coalesce(v_badge.name, 'a badge') || '.'
    end,
    '/profile#badges',
    jsonb_build_object('badge_id', new.badge_id, 'trip_id', new.trip_id, 'badge_type', v_badge.badge_type),
    coalesce(new.awarded_by, auth.uid())
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_badge_awarded on public.user_badges;
create trigger trg_notify_badge_awarded
  after insert on public.user_badges
  for each row execute function public.notify_badge_awarded();

-- ── Tagged in a photo ─────────────────────────────────────────────

create or replace function public.notify_photo_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_photo record;
begin
  if new.tag_type <> 'person' then
    return new;
  end if;

  -- Person tags store the member's profile id; older tags hold a name and are skipped.
  begin
    v_member_id := new.tag_value::uuid;
  exception when invalid_text_representation then
    return new;
  end;

  select p.trip_id, p.uploaded_by, t.name as trip_name, t.slug as trip_slug
  into v_photo
  from public.photos p
  join public.trips t on t.id = p.trip_id
  where p.id = new.photo_id;

  if v_photo.trip_slug is null then
    return new;
  end if;

  perform public.notify_member(
    v_member_id,
    'tags',
    'tag',
    'You were tagged in a photo',
    coalesce(public.member_display_name(auth.uid()) || ' tagged you in a photo from ', 'You were tagged in a photo from ') || v_photo.trip_name || '.',
    '/gallery/' || v_photo.trip_slug,
    jsonb_build_object('photo_id', new.photo_id, 'trip_id', v_photo.trip_id),
    auth.uid()
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_photo_tag on public.photo_tags;
create trigger trg_notify_photo_tag
  after insert on public.photo_tags
  for each row execute function public.notify_photo_tag();

-- ── Comment on a photo ────────────────────────────────────────────
-- Notifies the uploader and everyone tagged in the photo.

create or replace function public.notify_photo_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_photo record;
  v_commenter text;
  v_excerpt text;
  v_recipient uuid;
begin
  select p.trip_id, p.uploaded_by, t.name as trip_name, t.slug as trip_slug
  into v_photo
  from public.photos p
  join public.trips t on t.id = p.trip_id
  where p.id = new.photo_id;

  if v_photo.trip_slug is null then
    return new;
  end if;

  v_commenter := public.member_display_name(new.user_id);
  v_excerpt := case when length(new.content) > 120 then left(new.content, 117) || '...' else new.content end;

  for v_recipient in
    select distinct recipient from (
      select v_photo.uploaded_by as recipient
      union
      select pt.tag_value::uuid
      from public.photo_tags pt
      where pt.photo_id = new.photo_id
        and pt.tag_type = 'person'
        and pt.tag_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) r
    where recipient is not null
  loop
    perform public.notify_member(
      v_recipient,
      'comments',
      'comment',
      case when v_recipient = v_photo.uploaded_by
        then v_commenter || ' commented on your photo'
        else v_commenter || ' commented on a photo you''re in'
      end,
      '"' || v_excerpt || '"',
      '/gallery/' || v_photo.trip_slug,
      jsonb_build_object('photo_id', new.photo_id, 'comment_id', new.id, 'trip_id', v_photo.trip_id),
      new.user_id
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_photo_comment on public.photo_comments;
create trigger trg_notify_photo_comment
  after insert on public.photo_comments
  for each row execute function public.notify_photo_comment();

-- ── Like on a photo ───────────────────────────────────────────────

create or replace function public.notify_photo_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_photo record;
begin
  select p.trip_id, p.uploaded_by, t.name as trip_name, t.slug as trip_slug
  into v_photo
  from public.photos p
  join public.trips t on t.id = p.trip_id
  where p.id = new.photo_id;

  if v_photo.trip_slug is null then
    return new;
  end if;

  perform public.notify_member(
    v_photo.uploaded_by,
    'likes',
    'like',
    public.member_display_name(new.user_id) || ' liked your photo',
    'From ' || v_photo.trip_name || '.',
    '/gallery/' || v_photo.trip_slug,
    jsonb_build_object('photo_id', new.photo_id, 'trip_id', v_photo.trip_id),
    new.user_id
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_photo_like on public.photo_likes;
create trigger trg_notify_photo_like
  after insert on public.photo_likes
  for each row execute function public.notify_photo_like();

-- ── Added to a trip ───────────────────────────────────────────────

create or replace function public.notify_trip_member_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip record;
  v_role text;
begin
  select name, slug, trip_type, start_date into v_trip from public.trips where id = new.trip_id;
  if v_trip.slug is null then
    return new;
  end if;

  v_role := case new.trip_role
    when 'captain' then 'Captain'
    when 'kitty_man' then 'Kitty Man'
    when 'organiser' then 'Organiser'
    else null
  end;

  perform public.notify_member(
    new.user_id,
    'trips',
    'trip_update',
    'You''re on ' || v_trip.name || '!',
    case
      when v_role is not null then 'You''ve been added to ' || v_trip.name || ' as ' || v_role || '.'
      else 'You''ve been added to ' || v_trip.name || '. Check the trip page for dates and details.'
    end,
    '/trips/' || v_trip.slug,
    jsonb_build_object('trip_id', new.trip_id, 'trip_role', new.trip_role),
    auth.uid()
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_trip_member_added on public.trip_members;
create trigger trg_notify_trip_member_added
  after insert on public.trip_members
  for each row execute function public.notify_trip_member_added();

-- ── Trip update posted ────────────────────────────────────────────

create or replace function public.notify_trip_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip record;
  v_member uuid;
begin
  select name, slug into v_trip from public.trips where id = new.trip_id;
  if v_trip.slug is null then
    return new;
  end if;

  for v_member in select user_id from public.trip_members where trip_id = new.trip_id loop
    perform public.notify_member(
      v_member,
      'trips',
      'trip_update',
      'New update: ' || v_trip.name,
      coalesce(nullif(trim(new.title), ''), 'There''s a new update on ' || v_trip.name || '.'),
      '/trips/' || v_trip.slug,
      jsonb_build_object('trip_id', new.trip_id, 'trip_update_id', new.id),
      coalesce(new.author_id, auth.uid())
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_notify_trip_update on public.trip_updates;
create trigger trg_notify_trip_update
  after insert on public.trip_updates
  for each row execute function public.notify_trip_update();
