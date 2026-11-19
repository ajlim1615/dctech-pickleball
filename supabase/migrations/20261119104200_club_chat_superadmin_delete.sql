-- Restrict chat Unsend (soft-update to "Unsent message") strictly to the sender within 5 minutes,
-- and grant full message Delete (hard DELETE of any message) exclusively to admin@dctechmicro.com.

drop policy if exists "club_messages_update_unsend" on public.club_messages;
create policy "club_messages_update_unsend"
  on public.club_messages
  for update
  to authenticated
  using (
    not is_unsent
    and auth.uid() = sender_id
    and created_at > now() - interval '5 minutes'
  )
  with check (
    is_unsent = true
    and body = 'Unsent message'
  );

create or replace function public.club_messages_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_unsent then
    raise exception 'already_unsent' using errcode = 'P0001';
  end if;

  if auth.uid() is distinct from old.sender_id then
    raise exception 'not_message_sender' using errcode = 'P0001';
  end if;

  if old.created_at <= now() - interval '5 minutes' then
    raise exception 'unsend_expired' using errcode = 'P0001';
  end if;

  -- Lock immutable columns and scrub message body
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

drop policy if exists "club_messages_delete_own_or_admin" on public.club_messages;
drop policy if exists "club_messages_delete_superadmin" on public.club_messages;
create policy "club_messages_delete_superadmin"
  on public.club_messages
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and lower(p.email) = 'admin@dctechmicro.com'
    )
  );
