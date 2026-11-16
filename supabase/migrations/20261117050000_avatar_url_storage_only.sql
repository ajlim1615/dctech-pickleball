-- Apply AFTER the Storage-photo code is deployed (the old build saved base64 here).
-- profiles.avatar_url may only hold a short link to a file in the "avatars" bucket,
-- so a photo can never again be copied into every list query as base64 text.
alter table public.profiles drop constraint if exists profiles_avatar_url_storage_only;
alter table public.profiles add constraint profiles_avatar_url_storage_only check (
  avatar_url is null
  or (
    length(avatar_url) <= 300
    and avatar_url ~ '^https://[a-z0-9.-]+/storage/v1/object/public/avatars/[0-9a-f-]{36}\.jpg(\?v=[0-9]+)?$'
  )
);
