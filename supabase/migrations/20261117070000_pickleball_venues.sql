-- Pickleball venues directory (separate from live in-session court slots in public.courts)
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  maps_url text not null,
  address text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists venues_name_lower_idx
  on public.venues (lower(trim(name)));

alter table public.sessions
  add column if not exists venue_id uuid references public.venues(id) on delete set null;

create index if not exists sessions_venue_id_idx
  on public.sessions (venue_id);

alter table public.venues enable row level security;

create policy "Authenticated users can view venues"
  on public.venues for select to authenticated
  using (true);

create policy "Admins can insert venues"
  on public.venues for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins can update venues"
  on public.venues for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can delete venues"
  on public.venues for delete to authenticated
  using ((select public.is_admin()));

insert into public.venues (name, maps_url)
values
  ('The Forge Pickleball Court', 'https://maps.app.goo.gl/Ry6qjodsQBR6DavL8'),
  ('Balhai CrossCourt', 'https://maps.app.goo.gl/3ZoKoykpLfCtyThw5'),
  ('Flying pickle sports center', 'https://maps.app.goo.gl/9x3G1UHfAWTGCJ3T8'),
  ('Paddle Republic Sports Center', 'https://maps.app.goo.gl/pKx4GvHQK2d7hCoa9')
on conflict do nothing;
