-- ============================================================================
-- Migration 003: Mahaprasad Material Donations Table & Fresh Start Update
-- Creates public.mahaprasad_donations table for physical non-monetary items.
-- ============================================================================

-- 1. CREATE MAHAPRASAD_DONATIONS TABLE
create table if not exists public.mahaprasad_donations (
  id uuid primary key default gen_random_uuid(),
  donor_name text not null,
  mobile_number text,
  items_donated text not null,
  collected_by uuid references public.users(id),
  collected_by_name text not null,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists mahaprasad_created_at_idx on public.mahaprasad_donations (created_at desc);

-- 2. ENABLE ROW LEVEL SECURITY
alter table public.mahaprasad_donations enable row level security;

drop policy if exists "mahaprasad_select_all" on public.mahaprasad_donations;
create policy "mahaprasad_select_all" on public.mahaprasad_donations
  for select to authenticated using (true);

drop policy if exists "mahaprasad_insert_authenticated" on public.mahaprasad_donations;
create policy "mahaprasad_insert_authenticated" on public.mahaprasad_donations
  for insert to authenticated with check (true);

drop policy if exists "mahaprasad_update_admin" on public.mahaprasad_donations;
create policy "mahaprasad_update_admin" on public.mahaprasad_donations
  for update to authenticated using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

drop policy if exists "mahaprasad_delete_admin" on public.mahaprasad_donations;
create policy "mahaprasad_delete_admin" on public.mahaprasad_donations
  for delete to authenticated using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- 3. PUBLISH TO REALTIME
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mahaprasad_donations'
  ) then
    alter publication supabase_realtime add table public.mahaprasad_donations;
  end if;
exception
  when undefined_object then
    null;
end $$;

-- 4. UPDATE FRESH_START TO CLEAR MAHAPRASAD DONATIONS AS WELL
create or replace function public.fresh_start()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Only admin can perform a Fresh Start';
  end if;

  delete from public.income;
  delete from public.expense;
  delete from public.mahaprasad_donations;

  update public.receipt_counter set current_number = 0 where id = 1;
  update public.voucher_counter set current_number = 0 where id = 1;
end;
$$;
