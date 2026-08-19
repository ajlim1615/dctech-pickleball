-- ==============================================================================
-- DCTECH | Pickleball - Seed Test Users & Profiles
-- Run this in Supabase SQL Editor to populate test employee accounts
-- Password for all test users: password123
-- ==============================================================================

-- 1. Insert into auth.users (enables authentication & satisfies foreign key constraint)
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-000000000001', 'authenticated', 'authenticated', 'victor.sterling@dctechmicro.com', crypt('password123', gen_salt('bf')), now(), null, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Victor Sterling"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-000000000002', 'authenticated', 'authenticated', 'elena.rostova@dctechmicro.com', crypt('password123', gen_salt('bf')), now(), null, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Elena Rostova"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-000000000003', 'authenticated', 'authenticated', 'lucas.kim@dctechmicro.com', crypt('password123', gen_salt('bf')), now(), null, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Lucas Kim"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-000000000004', 'authenticated', 'authenticated', 'alex.rivera@dctechmicro.com', crypt('password123', gen_salt('bf')), now(), null, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Alex Rivera"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-000000000005', 'authenticated', 'authenticated', 'sophia.zhang@dctechmicro.com', crypt('password123', gen_salt('bf')), now(), null, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sophia Zhang"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-000000000006', 'authenticated', 'authenticated', 'dave.oconnor@dctechmicro.com', crypt('password123', gen_salt('bf')), now(), null, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dave O''Connor"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-000000000007', 'authenticated', 'authenticated', 'chris.patterson@dctechmicro.com', crypt('password123', gen_salt('bf')), now(), null, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Chris Patterson"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-000000000008', 'authenticated', 'authenticated', 'marcus.vance@dctechmicro.com', crypt('password123', gen_salt('bf')), now(), null, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Marcus Vance"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-000000000009', 'authenticated', 'authenticated', 'nathan.drake@dctechmicro.com', crypt('password123', gen_salt('bf')), now(), null, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Nathan Drake"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-000000000010', 'authenticated', 'authenticated', 'tanya.morales@dctechmicro.com', crypt('password123', gen_salt('bf')), now(), null, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Tanya Morales"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-000000000011', 'authenticated', 'authenticated', 'chloe.bennett@dctechmicro.com', crypt('password123', gen_salt('bf')), now(), null, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Chloe Bennett"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-000000000012', 'authenticated', 'authenticated', 'maya.lin@dctechmicro.com', crypt('password123', gen_salt('bf')), now(), null, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Maya Lin"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-000000000013', 'authenticated', 'authenticated', 'jordan.miller@dctechmicro.com', crypt('password123', gen_salt('bf')), now(), null, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Jordan Miller"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-000000000014', 'authenticated', 'authenticated', 'isabella.rossi@dctechmicro.com', crypt('password123', gen_salt('bf')), now(), null, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Isabella Rossi"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-000000000015', 'authenticated', 'authenticated', 'liam.gallagher@dctechmicro.com', crypt('password123', gen_salt('bf')), now(), null, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Liam Gallagher"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-000000000016', 'authenticated', 'authenticated', 'emma.watson@dctechmicro.com', crypt('password123', gen_salt('bf')), now(), null, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Emma Watson"}', now(), now(), '', '', '', '')
on conflict (id) do update set
  email = excluded.email,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

-- 2. Upsert corresponding Profiles with specific DUPR Ratings & Stats
insert into public.profiles (
  id,
  email,
  full_name,
  display_name,
  role,
  skill_rating,
  games_played,
  games_won,
  is_active
)
values
  -- Tier 1: Advanced & Pro (4.00 - 5.00)
  ('11111111-1111-1111-1111-000000000001', 'victor.sterling@dctechmicro.com', 'Victor Sterling', 'Victor S.', 'player', 4.80, 18, 15, true),
  ('11111111-1111-1111-1111-000000000002', 'elena.rostova@dctechmicro.com', 'Elena Rostova', 'Elena R.', 'admin', 4.50, 14, 11, true),
  ('11111111-1111-1111-1111-000000000003', 'lucas.kim@dctechmicro.com', 'Lucas Kim', 'Lucas K.', 'player', 4.35, 12, 9, true),
  ('11111111-1111-1111-1111-000000000004', 'alex.rivera@dctechmicro.com', 'Alex Rivera', 'Alex R.', 'player', 4.20, 16, 12, true),
  ('11111111-1111-1111-1111-000000000005', 'sophia.zhang@dctechmicro.com', 'Sophia Zhang', 'Sophia Z.', 'player', 4.10, 10, 7, true),

  -- Tier 2: Strong Intermediate (3.50 - 3.99)
  ('11111111-1111-1111-1111-000000000006', 'dave.oconnor@dctechmicro.com', 'Dave O''Connor', 'Dave O.', 'player', 3.95, 15, 9, true),
  ('11111111-1111-1111-1111-000000000007', 'chris.patterson@dctechmicro.com', 'Chris Patterson', 'Chris P.', 'player', 3.90, 12, 7, true),
  ('11111111-1111-1111-1111-000000000008', 'marcus.vance@dctechmicro.com', 'Marcus Vance', 'Marcus V.', 'player', 3.85, 14, 8, true),
  ('11111111-1111-1111-1111-000000000009', 'nathan.drake@dctechmicro.com', 'Nathan Drake', 'Nathan D.', 'player', 3.70, 8, 4, true),
  ('11111111-1111-1111-1111-000000000010', 'tanya.morales@dctechmicro.com', 'Tanya Morales', 'Tanya M.', 'player', 3.65, 11, 6, true),
  ('11111111-1111-1111-1111-000000000011', 'chloe.bennett@dctechmicro.com', 'Chloe Bennett', 'Chloe B.', 'player', 3.50, 9, 5, true),

  -- Tier 3: Intermediate & Social (3.00 - 3.49)
  ('11111111-1111-1111-1111-000000000012', 'maya.lin@dctechmicro.com', 'Maya Lin', 'Maya L.', 'player', 3.40, 7, 3, true),
  ('11111111-1111-1111-1111-000000000013', 'jordan.miller@dctechmicro.com', 'Jordan Miller', 'Jordan M.', 'player', 3.20, 6, 2, true),

  -- Tier 4: Novice & Beginners (2.50 - 2.99)
  ('11111111-1111-1111-1111-000000000014', 'isabella.rossi@dctechmicro.com', 'Isabella Rossi', 'Isabella R.', 'player', 2.95, 4, 1, true),
  ('11111111-1111-1111-1111-000000000015', 'liam.gallagher@dctechmicro.com', 'Liam Gallagher', 'Liam G.', 'player', 2.80, 5, 2, true),
  ('11111111-1111-1111-1111-000000000016', 'emma.watson@dctechmicro.com', 'Emma Watson', 'Emma W.', 'player', 2.65, 3, 1, true)
on conflict (id) do update set
  full_name = excluded.full_name,
  display_name = excluded.display_name,
  skill_rating = excluded.skill_rating,
  role = excluded.role,
  games_played = excluded.games_played,
  games_won = excluded.games_won,
  is_active = excluded.is_active;

-- Verification
select id, full_name, email, skill_rating, role from public.profiles order by skill_rating desc;
