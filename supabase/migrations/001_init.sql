-- ============================================================================
-- Ganesh Mandal Ledger System — Initial Schema
-- Minimal schema: users, income, expense, receipt_counter, voucher_counter
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. USERS (profile table mirroring auth.users, holds role)
-- ----------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'collector')),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. EXPENSE HEADS lookup (small, admin-managed list — required by the
--    "Manage Expense Heads" admin feature). Seeded with the default heads.
-- ----------------------------------------------------------------------------
create table if not exists public.expense_heads (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into public.expense_heads (name) values
  ('Decoration'), ('Murti'), ('Prasad'), ('Lighting'), ('Mandap'), ('Other')
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- 3. RECEIPT / VOUCHER COUNTERS — single-row tables, never touched directly
--    by clients. Only mutated via the SECURITY DEFINER RPC functions below.
-- ----------------------------------------------------------------------------
create table if not exists public.receipt_counter (
  id smallint primary key default 1,
  current_number integer not null default 0,
  constraint single_row check (id = 1)
);
insert into public.receipt_counter (id, current_number) values (1, 0)
on conflict (id) do nothing;

create table if not exists public.voucher_counter (
  id smallint primary key default 1,
  current_number integer not null default 0,
  constraint single_row check (id = 1)
);
insert into public.voucher_counter (id, current_number) values (1, 0)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 4. INCOME
-- ----------------------------------------------------------------------------
create table if not exists public.income (
  id uuid primary key default gen_random_uuid(),
  receipt_number integer not null,
  amount numeric(12, 2) not null check (amount > 0),
  donor_name text not null,
  mobile_number text,
  payment_mode text not null check (payment_mode in ('cash', 'online')),
  collected_by uuid references public.users(id),
  collected_by_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists income_created_at_idx on public.income (created_at desc);
create index if not exists income_receipt_number_idx on public.income (receipt_number);

-- ----------------------------------------------------------------------------
-- 5. EXPENSE
-- ----------------------------------------------------------------------------
create table if not exists public.expense (
  id uuid primary key default gen_random_uuid(),
  voucher_number integer not null,
  amount numeric(12, 2) not null check (amount > 0),
  paid_to text not null,
  expense_head text not null,
  payment_mode text not null check (payment_mode in ('cash', 'online')),
  paid_by uuid references public.users(id),
  paid_by_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists expense_created_at_idx on public.expense (created_at desc);
create index if not exists expense_voucher_number_idx on public.expense (voucher_number);

-- ============================================================================
-- ATOMIC RPC FUNCTIONS
-- Uses pg_advisory_xact_lock so concurrent calls are serialized within the
-- transaction — guarantees no two collectors ever get the same number, even
-- if they click Save at the exact same instant.
-- ============================================================================

create or replace function public.create_income_entry(
  p_amount numeric,
  p_donor_name text,
  p_mobile_number text,
  p_payment_mode text,
  p_collected_by uuid,
  p_collected_by_name text
) returns public.income
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_number integer;
  v_row public.income;
begin
  -- Serialize all concurrent callers on this specific lock key for this transaction.
  perform pg_advisory_xact_lock(hashtext('receipt_counter'));

  update public.receipt_counter
    set current_number = current_number + 1
    where id = 1
    returning current_number into v_next_number;

  insert into public.income (
    receipt_number, amount, donor_name, mobile_number,
    payment_mode, collected_by, collected_by_name
  ) values (
    v_next_number, p_amount, p_donor_name, p_mobile_number,
    p_payment_mode, p_collected_by, p_collected_by_name
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.create_expense_entry(
  p_amount numeric,
  p_paid_to text,
  p_expense_head text,
  p_payment_mode text,
  p_paid_by uuid,
  p_paid_by_name text
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
    where id = 1
    returning current_number into v_next_number;

  insert into public.expense (
    voucher_number, amount, paid_to, expense_head, payment_mode, paid_by, paid_by_name
  ) values (
    v_next_number, p_amount, p_paid_to, p_expense_head, p_payment_mode, p_paid_by, p_paid_by_name
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- Admin-only: reset counters (optional feature from spec).
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
  update public.receipt_counter set current_number = 0 where id = 1;
end;
$$;

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
  update public.voucher_counter set current_number = 0 where id = 1;
end;
$$;

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

  update public.receipt_counter set current_number = 0 where id = 1;
  update public.voucher_counter set current_number = 0 where id = 1;
end;
$$;

grant execute on function public.create_income_entry to authenticated;
grant execute on function public.create_expense_entry to authenticated;
grant execute on function public.reset_receipt_counter to authenticated;
grant execute on function public.reset_voucher_counter to authenticated;
grant execute on function public.fresh_start to authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.users enable row level security;
alter table public.income enable row level security;
alter table public.expense enable row level security;
alter table public.expense_heads enable row level security;
alter table public.receipt_counter enable row level security;
alter table public.voucher_counter enable row level security;

-- receipt_counter / voucher_counter: no client policies at all.
-- They are only ever touched by the SECURITY DEFINER functions above.

-- users: any authenticated user can read the list (needed for the
-- "Collected By" dropdown); only admins can write.
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

-- expense_heads: everyone reads, only admin manages.
drop policy if exists "expense_heads_select_all" on public.expense_heads;
create policy "expense_heads_select_all" on public.expense_heads
  for select to authenticated using (true);

drop policy if exists "expense_heads_admin_write" on public.expense_heads;
create policy "expense_heads_admin_write" on public.expense_heads
  for all to authenticated using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  ) with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- income: all authenticated can read + insert (via RPC, but direct insert
-- policy kept as a safety net is intentionally omitted — inserts must go
-- through create_income_entry). Only admin can update/delete.
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

-- expense: same pattern as income.
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
-- REALTIME — publish income & expense so the dashboard updates live
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
