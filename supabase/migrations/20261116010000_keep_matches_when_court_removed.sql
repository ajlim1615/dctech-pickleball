-- Removing a court (admin "Courts" count) used to cascade-delete every match
-- played on it, and with it match_players and player_ratings_history.
-- Keep the history instead: the match just loses its court link.

alter table public.matches
  alter column court_id drop not null;

alter table public.matches
  drop constraint if exists matches_court_id_fkey;

alter table public.matches
  add constraint matches_court_id_fkey
  foreign key (court_id) references public.courts (id) on delete set null;
