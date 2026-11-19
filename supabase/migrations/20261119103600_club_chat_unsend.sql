-- ==============================================================================
-- Club Chat Unsend Support (5-Minute Player Window + Soft "Unsent message" State)
--   * Adds is_unsent boolean column to public.club_messages
--   * Replaces hard DELETE for users with soft-unsend UPDATE
--   * Enforces 5-minute unsend window for players (admins can moderate anytime)
--   * BEFORE UPDATE trigger locks immutable columns and scrubs body to 'Unsent message'
-- ==============================================================================

alter table public.club_messages
  add column if not exists is_unsent boolean not null default false;

drop policy if exists "Users can delete own messages or admins can delete any" on public.club_messages;

drop policy if exists "Users can unsend own recent messages or admins can unsend any" on public.club_messages;
create policy "Users can unsend own recent messages or admins can unsend any"
  on public.club_messages for update
  to authenticated
  using (
    (auth.uid() = sender_id and created_at > now() - interval '5 minutes')
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    is_unsent = true
  );

create or replace function public.club_messages_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if old.is_unsent is true then
    raise exception 'already_unsent';
  end if;

  select exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.role = 'admin'
  ) into v_is_admin;

  if not v_is_admin then
    if old.sender_id <> v_uid then
      raise exception 'not_sender';
    end if;
    if old.created_at <= now() - interval '5 minutes' then
      raise exception 'unsend_expired';
    end if;
  end if;

  -- Lock immutable identity/timestamp fields and scrub body
  new.id := old.id;
  new.room := old.room;
  new.sender_id := old.sender_id;
  new.sender_name := old.sender_name;
  new.created_at := old.created_at;
  new.is_unsent := true;
  new.body := 'Unsent message';

  return new;
end;
$$;

revoke execute on function public.club_messages_before_update() from public, anon, authenticated;

drop trigger if exists club_messages_before_update on public.club_messages;
create trigger club_messages_before_update
  before update on public.club_messages
  for each row execute function public.club_messages_before_update();
