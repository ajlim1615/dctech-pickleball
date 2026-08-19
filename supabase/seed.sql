-- ==============================================================================
-- DCPaddl: supabase/seed.sql
-- Seed Data: Initial Courts, Default Sessions, and Initial Setup
-- ==============================================================================

-- 1. Insert Initial Courts
insert into public.courts (id, name, surface_type, status, sort_order)
values
  ('00000000-0000-0000-0000-000000000001', 'Court 1 (Championship)', 'Acrylic Pro', 'available', 1),
  ('00000000-0000-0000-0000-000000000002', 'Court 2', 'Cushioned Hardcourt', 'available', 2),
  ('00000000-0000-0000-0000-000000000003', 'Court 3', 'Cushioned Hardcourt', 'available', 3),
  ('00000000-0000-0000-0000-000000000004', 'Court 4', 'Indoor Wood', 'available', 4)
on conflict (id) do nothing;
