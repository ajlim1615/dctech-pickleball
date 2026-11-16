-- Apply AFTER the app version that writes players' line entries server-side is live.
-- Players used to be able to write their own queue_entries row through the API:
-- set joined_at to jump the line, or flip status to skip the one-break / one-rejoin
-- limits. Now only admins write directly; players' Join, Leave and Take a break go
-- through server actions that check the rules and write with the service key.
drop policy if exists "Users can join the queue" on public.queue_entries;
drop policy if exists "Users can update or leave the queue" on public.queue_entries;
drop policy if exists "Users can delete their own queue entry" on public.queue_entries;

create policy "Admins can add queue entries"
  on public.queue_entries for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins can change queue entries"
  on public.queue_entries for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can delete queue entries"
  on public.queue_entries for delete to authenticated
  using ((select public.is_admin()));
