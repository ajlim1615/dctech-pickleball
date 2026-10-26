-- ==============================================================================
-- DCTECH | Pickleball: Create Admin User Account
-- Email:    admin@dctechmicro.com
-- Password: dctech
-- File:     supabase/create_admin_user.sql
-- ==============================================================================

-- 1. Create or update auth.users account
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
values (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@dctechmicro.com',
  crypt('dctech', gen_salt('bf')),
  now(),
  null,
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin DCTECH"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
)
on conflict (email) where is_sso_user = false do update set
  email = excluded.email,
  encrypted_password = crypt('dctech', gen_salt('bf')),
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

-- 2. Insert into auth.identities (Required by Supabase for email/password authentication)
insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
select gen_random_uuid(), u.id, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', u.email, now(), now(), now()
from auth.users u
where u.email = 'admin@dctechmicro.com'
on conflict (provider, provider_id) do update set
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  updated_at = now();

-- 3. Upsert into public.profiles with role = 'admin'
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
select
  u.id,
  'admin@dctechmicro.com',
  'Admin DCTECH',
  'Admin',
  'admin',
  4.50,
  0,
  0,
  true
from auth.users u
where u.email = 'admin@dctechmicro.com'
on conflict (id) do update set
  email = excluded.email,
  role = 'admin',
  full_name = excluded.full_name,
  is_active = true;
