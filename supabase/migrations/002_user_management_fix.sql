-- ============================================================================
-- Migration 002: User Management Fix & Automatic Profile Trigger
-- Ensures public.users schema compatibility, adds default columns, and installs
-- the auth.users -> public.users automatic profile creation trigger.
-- ============================================================================

-- 1. Ensure required columns exist on public.users
alter table public.users add column if not exists is_active boolean not null default true;
alter table public.users add column if not exists full_report_access boolean not null default false;

-- 2. Handle trigger function for auto profile creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (
    id,
    full_name,
    role,
    is_active,
    full_report_access
  )
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      split_part(new.email, '@', 1)
    ),
    case
      when lower(coalesce(new.raw_user_meta_data->>'role', '')) in ('admin', 'collector')
        then lower(new.raw_user_meta_data->>'role')
      else 'collector'
    end,
    true,
    case
      when lower(coalesce(new.raw_user_meta_data->>'role', '')) = 'admin' then true
      else false
    end
  )
  on conflict (id) do update set
    full_name = coalesce(nullif(trim(excluded.full_name), ''), public.users.full_name),
    role = coalesce(excluded.role, public.users.role);

  return new;
end;
$$;

-- 3. Install trigger on auth.users safely
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Ensure RLS policies are up-to-date
alter table public.users enable row level security;

drop policy if exists "users_select_all_authenticated" on public.users;
create policy "users_select_all_authenticated" on public.users
  for select to authenticated using (true);

drop policy if exists "users_admin_insert" on public.users;
create policy "users_admin_insert" on public.users
  for insert to authenticated with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

drop policy if exists "users_admin_update" on public.users;
create policy "users_admin_update" on public.users
  for update to authenticated using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

drop policy if exists "users_admin_delete" on public.users;
create policy "users_admin_delete" on public.users
  for delete to authenticated using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
