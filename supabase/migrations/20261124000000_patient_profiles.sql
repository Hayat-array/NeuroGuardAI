create table if not exists public.patient_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.patient_profiles enable row level security;
revoke all on public.patient_profiles from anon, authenticated;
grant select, insert, update, delete on public.patient_profiles to authenticated;

drop policy if exists "patient_profiles_select_own" on public.patient_profiles;
drop policy if exists "patient_profiles_insert_own" on public.patient_profiles;
drop policy if exists "patient_profiles_update_own" on public.patient_profiles;
drop policy if exists "patient_profiles_delete_own" on public.patient_profiles;

create policy "patient_profiles_select_own" on public.patient_profiles
  for select to authenticated using (auth.uid() = user_id);
create policy "patient_profiles_insert_own" on public.patient_profiles
  for insert to authenticated with check (auth.uid() = user_id);
create policy "patient_profiles_update_own" on public.patient_profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "patient_profiles_delete_own" on public.patient_profiles
  for delete to authenticated using (auth.uid() = user_id);
