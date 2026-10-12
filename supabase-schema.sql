-- Run this once in your Supabase project's SQL Editor (Supabase dashboard → SQL Editor → New query).

-- 1) The data table. Mirrors the simple key/value shape the app already
--    uses (questions, topics, presentations, presentation topics are each
--    one row, stored as a JSON string in `value`, exactly like before).
create table if not exists kv_store (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- 2) Row Level Security: everyone (including students, who are not logged
--    in) can READ the data — that's what makes the site work as a public
--    class resource. Only an authenticated user (you, the teacher) can
--    WRITE. This is the real access control that replaces the old
--    prompt()-based password check.
alter table kv_store enable row level security;

create policy "Public read access"
  on kv_store for select
  using (true);

create policy "Authenticated write access"
  on kv_store for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated update access"
  on kv_store for update
  using (auth.role() = 'authenticated');

create policy "Authenticated delete access"
  on kv_store for delete
  using (auth.role() = 'authenticated');

-- 3) Storage bucket for pasted/dragged images (worksheets, diagrams, etc).
--    Run this too — it creates a public bucket named 'lesson-images'.
insert into storage.buckets (id, name, public)
values ('lesson-images', 'lesson-images', true)
on conflict (id) do nothing;

create policy "Public read images"
  on storage.objects for select
  using (bucket_id = 'lesson-images');

create policy "Authenticated upload images"
  on storage.objects for insert
  with check (bucket_id = 'lesson-images' and auth.role() = 'authenticated');

create policy "Authenticated delete images"
  on storage.objects for delete
  using (bucket_id = 'lesson-images' and auth.role() = 'authenticated');

-- 4) Finally, create your own admin login:
--    Supabase dashboard → Authentication → Users → Add user
--    Use your own email + a password you choose. There is no public
--    sign-up page in this app — you are the only account that can exist
--    unless you create more from this same screen.
