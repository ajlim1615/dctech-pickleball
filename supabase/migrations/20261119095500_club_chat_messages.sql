-- ==============================================================================
-- Club Chat Messages (Free-Tier Hardened)
--   * room-scoped table (default 'club') for site-wide & future session chat
--   * DB-enforced 2-second per-sender cooldown & 1..300 char body limit
--   * Server-resolved sender_id & sender_name (anti-spoofing, no avatar blobs)
--   * Opportunistic 14-day retention pruning inside BEFORE INSERT trigger
-- ==============================================================================

create table if not exists public.club_messages (
  id uuid primary key default gen_random_uuid(),
  room text not null default 'club' check (char_length(room) between 1 and 64),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  sender_name text not null,
  body text not null check (char_length(trim(body)) between 1 and 300),
  created_at timestamptz not null default now()
);

create index if not exists club_messages_room_created_idx
  on public.club_messages (room, created_at desc);

create index if not exists club_messages_sender_created_idx
  on public.club_messages (sender_id, created_at desc);

alter table public.club_messages enable row level security;

create policy "Club messages are viewable by authenticated users"
  on public.club_messages for select
  to authenticated
  using (true);

create policy "Authenticated users can insert their own club messages"
  on public.club_messages for insert
  to authenticated
  with check (auth.uid() = sender_id);

create policy "Users can delete own messages or admins can delete any"
  on public.club_messages for delete
  to authenticated
  using (
    auth.uid() = sender_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create or replace function public.club_messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_active boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.full_name), ''), 'Player'),
    coalesce(p.is_active, false)
  into v_name, v_active
  from public.profiles p
  where p.id = v_uid;

  if v_active is not true then
    raise exception 'inactive_profile';
  end if;

  if exists (
    select 1
    from public.club_messages m
    where m.sender_id = v_uid
      and m.created_at > now() - interval '2 seconds'
  ) then
    raise exception 'rate_limit';
  end if;

  new.sender_id := v_uid;
  new.sender_name := v_name;
  new.room := coalesce(nullif(trim(new.room), ''), 'club');
  new.body := trim(new.body);
  new.created_at := now();

  -- Self-maintaining 14-day retention (~2% of inserts)
  if random() < 0.02 then
    delete from public.club_messages
    where created_at < now() - interval '14 days';
  end if;

  return new;
end;
$$;

revoke execute on function public.club_messages_before_insert() from public, anon, authenticated;

drop trigger if exists club_messages_before_insert on public.club_messages;
create trigger club_messages_before_insert
  before insert on public.club_messages
  for each row execute function public.club_messages_before_insert();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'club_messages'
  ) then
    alter publication supabase_realtime add table public.club_messages;
  end if;
end $$;
