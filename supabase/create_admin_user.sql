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
  'a0000000-0000-0000-0000-000000000001',
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
on conflict (id) do update set
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
values (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '{"sub":"a0000000-0000-0000-0000-000000000001","email":"admin@dctechmicro.com"}',
  'email',
  'admin@dctechmicro.com',
  now(),
  now(),
  now()
)
on conflict (provider, provider_id) do update set
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
values (
  'a0000000-0000-0000-0000-000000000001',
  'admin@dctechmicro.com',
  'Admin DCTECH',
  'Admin',
  'admin',
  4.50,
  0,
  0,
  true
)
on conflict (id) do update set
  email = excluded.email,
  role = 'admin',
  full_name = excluded.full_name,
  is_active = true;
