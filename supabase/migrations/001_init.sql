-- ============================================================================
-- Production-Ready Supabase Schema (001_init.sql)
-- Complete database setup from scratch for Ganesh Mandal Ledger Management System
-- Compatible with Supabase, Next.js, Prisma, Vercel, and TypeScript
-- ============================================================================

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- 1.1 USERS (Profile table mirroring auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'collector' check (role in ('admin', 'collector')),
  is_active boolean not null default true,
  full_report_access boolean not null default false,
  created_at timestamptz not null default now()
);

-- 1.2 EXPENSE HEADS (Lookup table for expense categories)
create table if not exists public.expense_heads (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- 1.3 RECEIPT COUNTER (Single-row tracking table)
create table if not exists public.receipt_counter (
  id uuid primary key default gen_random_uuid(),
  current_number integer not null default 0
);

-- 1.4 VOUCHER COUNTER (Single-row tracking table)
create table if not exists public.voucher_counter (
  id uuid primary key default gen_random_uuid(),
  current_number integer not null default 0
);

-- 1.5 INCOME
-- receipt_number is NOT UNIQUE. Only id (UUID) is permanently unique.
create table if not exists public.income (
  id uuid primary key default gen_random_uuid(),
  receipt_number integer not null,
  amount numeric(12, 2) not null check (amount > 0),
  donor_name text not null,
  mobile_number text,
  payment_mode text not null check (payment_mode in ('cash', 'online')),
  collected_by uuid references public.users(id) on delete set null,
  collected_by_name text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 1.6 EXPENSE
-- voucher_number is NOT UNIQUE. Only id (UUID) is permanently unique.
create table if not exists public.expense (
  id uuid primary key default gen_random_uuid(),
  voucher_number integer not null,
  amount numeric(12, 2) not null check (amount > 0),
  paid_to text not null,
  expense_head text not null,
  payment_mode text not null check (payment_mode in ('cash', 'online')),
  paid_by uuid references public.users(id) on delete set null,
  paid_by_name text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================
create index if not exists income_created_at_idx on public.income (created_at desc);
create index if not exists income_receipt_number_idx on public.income (receipt_number);
create index if not exists expense_created_at_idx on public.expense (created_at desc);
create index if not exists expense_voucher_number_idx on public.expense (voucher_number);

-- ============================================================================
-- 3. AUTOMATIC PROFILE CREATION TRIGGER
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, full_name, role, is_active, full_report_access)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email, 'User'),
    coalesce(new.raw_user_meta_data->>'role', 'collector'),
    true,
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- 4. SEED DATA
-- ============================================================================
-- Seed default expense heads
insert into public.expense_heads (name) values
  ('Decoration'), ('Murti'), ('Prasad'), ('Lighting'), ('Mandap'), ('Other')
on conflict (name) do nothing;

-- Seed counters if empty
insert into public.receipt_counter (current_number)
select 0
where not exists (select 1 from public.receipt_counter);

insert into public.voucher_counter (current_number)
select 0
where not exists (select 1 from public.voucher_counter);

-- ============================================================================
-- 5. RPC FUNCTIONS
-- ============================================================================

-- 5.1 create_income_entry()
-- Uses pg_advisory_xact_lock, increments counter, inserts receipt_number,
-- assigns auth.uid() to created_by, and returns the inserted row.
create or replace function public.create_income_entry(
  p_amount numeric,
  p_donor_name text,
  p_mobile_number text default null,
  p_payment_mode text default 'cash',
  p_collected_by uuid default null,
  p_collected_by_name text default ''
) returns public.income
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_number integer;
  v_row public.income;
begin
  perform pg_advisory_xact_lock(hashtext('receipt_counter'));

  update public.receipt_counter
    set current_number = current_number + 1
    where true
    returning current_number into v_next_number;

  insert into public.income (
    receipt_number,
    amount,
    donor_name,
    mobile_number,
    payment_mode,
    collected_by,
    collected_by_name,
    created_by
  ) values (
    v_next_number,
    p_amount,
    p_donor_name,
    p_mobile_number,
    p_payment_mode,
    p_collected_by,
    p_collected_by_name,
    auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- 5.2 create_expense_entry()
-- Uses pg_advisory_xact_lock, increments counter, inserts voucher_number,
-- assigns auth.uid() to created_by, and returns the inserted row.
create or replace function public.create_expense_entry(
  p_amount numeric,
  p_paid_to text,
  p_expense_head text,
  p_payment_mode text default 'cash',
  p_paid_by uuid default null,
  p_paid_by_name text default ''
) returns public.expense
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_number integer;
  v_row public.expense;
begin
  perform pg_advisory_xact_lock(hashtext('voucher_counter'));

  update public.voucher_counter
    set current_number = current_number + 1
    where true
    returning current_number into v_next_number;

  insert into public.expense (
    voucher_number,
    amount,
    paid_to,
    expense_head,
    payment_mode,
    paid_by,
    paid_by_name,
    created_by
  ) values (
    v_next_number,
    p_amount,
    p_paid_to,
    p_expense_head,
    p_payment_mode,
    p_paid_by,
    p_paid_by_name,
    auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- 5.3 reset_receipt_counter()
-- Admin-only reset: deletes income records and resets counter to 0 (next entry = 1).
create or replace function public.reset_receipt_counter()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Only admin can reset the receipt counter';
  end if;

  delete from public.income;
  update public.receipt_counter set current_number = 0 where true;
end;
$$;

-- 5.4 reset_voucher_counter()
-- Admin-only reset: deletes expense records and resets counter to 0 (next entry = 1).
create or replace function public.reset_voucher_counter()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Only admin can reset the voucher counter';
  end if;

  delete from public.expense;
  update public.voucher_counter set current_number = 0 where true;
end;
$$;

-- Grant execution privileges to authenticated users
grant execute on function public.create_income_entry to authenticated;
grant execute on function public.create_expense_entry to authenticated;
grant execute on function public.reset_receipt_counter to authenticated;
grant execute on function public.reset_voucher_counter to authenticated;

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) & POLICIES
-- ============================================================================

alter table public.users enable row level security;
alter table public.income enable row level security;
alter table public.expense enable row level security;
alter table public.expense_heads enable row level security;
alter table public.receipt_counter enable row level security;
alter table public.voucher_counter enable row level security;

-- 6.1 USERS POLICIES
-- Everyone authenticated can SELECT. Admin can INSERT, UPDATE, DELETE.
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

-- 6.2 EXPENSE HEADS POLICIES
-- Everyone can SELECT. Admin manages (INSERT, UPDATE, DELETE).
drop policy if exists "expense_heads_select_all" on public.expense_heads;
create policy "expense_heads_select_all" on public.expense_heads
  for select using (true);

drop policy if exists "expense_heads_admin_all" on public.expense_heads;
create policy "expense_heads_admin_all" on public.expense_heads
  for all to authenticated using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- 6.3 INCOME POLICIES
-- Everyone authenticated can SELECT (Shared Dashboard, Shared Reports, Shared Recent Transactions).
-- Admin UPDATE/DELETE only.
drop policy if exists "income_select_all" on public.income;
create policy "income_select_all" on public.income
  for select to authenticated using (true);

drop policy if exists "income_admin_update" on public.income;
create policy "income_admin_update" on public.income
  for update to authenticated using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

drop policy if exists "income_admin_delete" on public.income;
create policy "income_admin_delete" on public.income
  for delete to authenticated using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- 6.4 EXPENSE POLICIES
-- Everyone authenticated can SELECT (Shared Dashboard, Shared Reports, Shared Recent Transactions).
-- Admin UPDATE/DELETE only.
drop policy if exists "expense_select_all" on public.expense;
create policy "expense_select_all" on public.expense
  for select to authenticated using (true);

drop policy if exists "expense_admin_update" on public.expense;
create policy "expense_admin_update" on public.expense
  for update to authenticated using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

drop policy if exists "expense_admin_delete" on public.expense;
create policy "expense_admin_delete" on public.expense
  for delete to authenticated using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- ============================================================================
-- 7. SUPABASE REALTIME
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'income'
  ) then
    alter publication supabase_realtime add table public.income;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'expense'
  ) then
    alter publication supabase_realtime add table public.expense;
  end if;
exception
  when undefined_object then
    null;
end $$;
