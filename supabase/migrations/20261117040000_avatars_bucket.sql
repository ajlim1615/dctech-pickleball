-- Profile photos move out of profiles.avatar_url (base64 text, copied into every
-- list query) into a public Storage bucket. The row keeps only the file's URL, and
-- browsers/CDN cache the file, so each photo downloads about once per device.
-- Only the server (service role) writes here, after checking who is uploading.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 300000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
