-- ==============================================================================
-- DCPaddl: 20260820000000_philippines_timezone.sql
-- Configure Database and Connection Roles for Philippine Standard Time (PST / PHT)
-- Time Zone: Asia/Manila (UTC+8)
-- ==============================================================================

-- 1. Set default database timezone to Asia/Manila
alter database postgres set timezone to 'Asia/Manila';

-- 2. Ensure connection roles default to Asia/Manila
alter role postgres set timezone to 'Asia/Manila';
alter role authenticated set timezone to 'Asia/Manila';
alter role anon set timezone to 'Asia/Manila';
alter role service_role set timezone to 'Asia/Manila';

-- 3. Convenience function to get current timestamp in Philippine Time
create or replace function public.get_philippines_time()
returns timestamp
language sql
stable
as $$
  select timezone('Asia/Manila', now());
$$;

-- Comment documentation
comment on function public.get_philippines_time() is 'Returns the current wall-clock date and time in Asia/Manila (Philippine Standard Time, UTC+8).';
