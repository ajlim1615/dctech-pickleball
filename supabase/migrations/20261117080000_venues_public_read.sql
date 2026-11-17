-- Allow unauthenticated (anon) visitors on the public home/kiosk and session pages
-- to read venue names and Google Maps links.
drop policy if exists "Authenticated users can view venues" on public.venues;

create policy "Anyone can view venues"
  on public.venues for select to anon, authenticated
  using (true);
