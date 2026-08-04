-- ============================================================================
-- Migration 002: RBAC record visibility + fresh-cycle counter resets
-- Run this AFTER 001_init.sql on an existing database.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Activate/Deactivate support for member accounts.
-- ----------------------------------------------------------------------------
alter table public.users
  add column if not exists is_active boolean not null default true;

-- ----------------------------------------------------------------------------
-- 0b. Track who actually SUBMITTED each entry (the logged-in session),
--     separate from collected_by/paid_by which is just the display name
--     chosen on the form (a collector can enter a receipt on someone
--     else's behalf while still being the one who should see it in
--     "My Records"). Set automatically by the RPCs below — never trust a
--     client-supplied value for this.
-- ----------------------------------------------------------------------------
alter table public.income
  add column if not exists created_by uuid references public.users(id);

alter table public.expense
  add column if not exists created_by uuid references public.users(id);

-- Backfill existing rows so nothing becomes invisible after the upgrade.
update public.income set created_by = collected_by where created_by is null;
update public.expense set created_by = paid_by where created_by is null;

-- ----------------------------------------------------------------------------
-- 1. Track when each counter was last reset, so we know which records
--    belong to the "active" cycle vs. archived history.
-- ----------------------------------------------------------------------------
alter table public.receipt_counter
  add column if not exists cycle_started_at timestamptz not null default now();

alter table public.voucher_counter
  add column if not exists cycle_started_at timestamptz not null default now();

-- ----------------------------------------------------------------------------
-- 2. Re-create the entry RPCs so they also stamp created_by = auth.uid().
--    (Signatures are unchanged — only the insert gains one extra column.)
-- ----------------------------------------------------------------------------
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
  perform pg_advisory_xact_lock(hashtext('receipt_counter'));

  update public.receipt_counter
    set current_number = current_number + 1
    where id = 1
    returning current_number into v_next_number;

  insert into public.income (
    receipt_number, amount, donor_name, mobile_number,
    payment_mode, collected_by, collected_by_name, created_by
  ) values (
    v_next_number, p_amount, p_donor_name, p_mobile_number,
    p_payment_mode, p_collected_by, p_collected_by_name, auth.uid()
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
    voucher_number, amount, paid_to, expense_head, payment_mode,
    paid_by, paid_by_name, created_by
  ) values (
    v_next_number, p_amount, p_paid_to, p_expense_head, p_payment_mode,
    p_paid_by, p_paid_by_name, auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.create_income_entry to authenticated;
grant execute on function public.create_expense_entry to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Reset functions now also start a new cycle (admin-only, unchanged check).
-- ----------------------------------------------------------------------------
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
  update public.receipt_counter
    set current_number = 0, cycle_started_at = now()
    where id = 1;
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
  update public.voucher_counter
    set current_number = 0, cycle_started_at = now()
    where id = 1;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Record visibility (RBAC):
--    - Admin: sees everything, always (active + archived history).
--    - Collector ("User" role): sees only entries THEY submitted
--      (created_by = auth.uid()), and only from the current active cycle
--      (i.e. created after the latest reset). This is independent of whose
--      name was picked in the "Collected By" dropdown on the form — a
--      member always retains visibility into what they personally entered.
--      Older records still exist in the database as archived history, but
--      are hidden from normal users once a reset happens.
-- ----------------------------------------------------------------------------
drop policy if exists "income_select_all" on public.income;
drop policy if exists "expense_select_all" on public.expense;

create policy "income_select_admin_all" on public.income
  for select to authenticated using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy "income_select_own_active_cycle" on public.income
  for select to authenticated using (
    created_by = auth.uid()
    and created_at >= (select cycle_started_at from public.receipt_counter where id = 1)
  );

create policy "expense_select_admin_all" on public.expense
  for select to authenticated using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

create policy "expense_select_own_active_cycle" on public.expense
  for select to authenticated using (
    created_by = auth.uid()
    and created_at >= (select cycle_started_at from public.voucher_counter where id = 1)
  );
