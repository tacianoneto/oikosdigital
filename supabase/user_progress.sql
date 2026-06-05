create table if not exists public.user_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_progress enable row level security;

create policy "user_progress_select_own"
on public.user_progress
for select
to authenticated
using (user_id = auth.uid());

create policy "user_progress_insert_own"
on public.user_progress
for insert
to authenticated
with check (user_id = auth.uid());

create policy "user_progress_update_own"
on public.user_progress
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "user_progress_delete_own"
on public.user_progress
for delete
to authenticated
using (user_id = auth.uid());
