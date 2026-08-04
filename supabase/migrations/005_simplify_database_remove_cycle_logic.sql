-- ============================================================================
-- Migration 005: Simplify Database - Remove Cycle/Season Logic
-- ============================================================================
-- This migration removes all cycle/season complexity and restores the original
-- simple database design as requested.
--
-- Changes:
-- 1. Drop all UNIQUE constraints on receipt_number and voucher_number
-- 2. Remove cycle_number column from all tables
-- 3. Remove cycle_started_at column from counter tables
-- 4. Keep created_by column for auditing; remove RLS filtering on created_by
-- 5. Restore simple RPC functions without cycle logic
-- 6. Restore full-reset RPC functions (delete records + reset counters)
-- 7. Restore simple RLS policies (shared access for all)
-- 8. Remove get_active_cycle_info RPC function
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Drop cycle-scoped and original UNIQUE constraints on receipt/voucher numbers
--    (all must be dropped or duplicate-key errors persist after counter resets)
-- ----------------------------------------------------------------------------
alter table public.income drop constraint if exists income_cycle_receipt_number_key;
alter table public.expense drop constraint if exists expense_cycle_voucher_number_key;
alter table public.income drop constraint if exists income_receipt_number_key;
alter table public.expense drop constraint if exists expense_voucher_number_key;

-- Note: We do NOT restore UNIQUE(receipt_number) or UNIQUE(voucher_number)
-- because this causes duplicate key errors after counter resets.
-- The id UUID PRIMARY KEY is sufficient for uniqueness.

-- ----------------------------------------------------------------------------
-- 2. Remove cycle_number columns
-- ----------------------------------------------------------------------------
alter table public.income drop column if exists cycle_number;
alter table public.expense drop column if exists cycle_number;
alter table public.receipt_counter drop column if exists cycle_number;
alter table public.voucher_counter drop column if exists cycle_number;

-- ----------------------------------------------------------------------------
-- 3. Remove cycle_started_at columns
-- ----------------------------------------------------------------------------
alter table public.receipt_counter drop column if exists cycle_started_at;
alter table public.voucher_counter drop column if exists cycle_started_at;

-- ----------------------------------------------------------------------------
-- 4. Keep created_by columns for future auditing (do NOT drop)
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 5. Restore simple RPC functions (no cycle logic; populate created_by)
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
    voucher_number, amount, paid_to, expense_head, payment_mode, paid_by, paid_by_name, created_by
  ) values (
    v_next_number, p_amount, p_paid_to, p_expense_head, p_payment_mode, p_paid_by, p_paid_by_name, auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Restore full-reset RPC functions (delete all records + reset counter to 0)
--    Next entry after reset becomes Receipt/Voucher No. 1.
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

-- ----------------------------------------------------------------------------
-- 7. Remove get_active_cycle_info function (no longer needed)
-- ----------------------------------------------------------------------------
drop function if exists public.get_active_cycle_info();

-- ----------------------------------------------------------------------------
-- 8. Restore simple RLS policies (shared access; no created_by filtering)
-- ----------------------------------------------------------------------------
drop policy if exists "income_select_admin_all" on public.income;
drop policy if exists "income_select_own" on public.income;
drop policy if exists "income_select_own_active_cycle" on public.income;

create policy "income_select_all" on public.income
  for select to authenticated using (true);

drop policy if exists "expense_select_admin_all" on public.expense;
drop policy if exists "expense_select_own" on public.expense;
drop policy if exists "expense_select_own_active_cycle" on public.expense;

create policy "expense_select_all" on public.expense
  for select to authenticated using (true);

-- ----------------------------------------------------------------------------
-- 9. Re-grant execute permissions
-- ----------------------------------------------------------------------------
grant execute on function public.create_income_entry to authenticated;
grant execute on function public.create_expense_entry to authenticated;
grant execute on function public.reset_receipt_counter to authenticated;
grant execute on function public.reset_voucher_counter to authenticated;
