-- ============================================================================
-- Migration 004: Add cycle scoping and restore shared Mandal reporting.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add explicit cycle numbers to counters and entries.
-- ----------------------------------------------------------------------------
alter table public.receipt_counter
  add column if not exists cycle_number integer not null default 1;

alter table public.voucher_counter
  add column if not exists cycle_number integer not null default 1;

alter table public.income
  add column if not exists cycle_number integer not null default 1;

alter table public.expense
  add column if not exists cycle_number integer not null default 1;

update public.income set cycle_number = 1 where cycle_number is null;
update public.expense set cycle_number = 1 where cycle_number is null;

-- ----------------------------------------------------------------------------
-- 2. Preserve unique numbers per cycle only, not across all archived history.
-- ----------------------------------------------------------------------------
alter table public.income drop constraint if exists income_receipt_number_key;
alter table public.expense drop constraint if exists expense_voucher_number_key;

alter table public.income
  add constraint income_cycle_receipt_number_key unique (cycle_number, receipt_number);

alter table public.expense
  add constraint expense_cycle_voucher_number_key unique (cycle_number, voucher_number);

-- ----------------------------------------------------------------------------
-- 3. Update insert/restart RPCs to use cycle numbers.
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
  v_cycle_number integer;
  v_row public.income;
begin
  perform pg_advisory_xact_lock(hashtext('receipt_counter'));

  update public.receipt_counter
    set current_number = current_number + 1
    where id = 1
    returning current_number, cycle_number into v_next_number, v_cycle_number;

  insert into public.income (
    receipt_number, cycle_number, amount, donor_name, mobile_number,
    payment_mode, collected_by, collected_by_name, created_by
  ) values (
    v_next_number, v_cycle_number, p_amount, p_donor_name, p_mobile_number,
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
  v_cycle_number integer;
  v_row public.expense;
begin
  perform pg_advisory_xact_lock(hashtext('voucher_counter'));

  update public.voucher_counter
    set current_number = current_number + 1
    where id = 1
    returning current_number, cycle_number into v_next_number, v_cycle_number;

  insert into public.expense (
    voucher_number, cycle_number, amount, paid_to, expense_head,
    payment_mode, paid_by, paid_by_name, created_by
  ) values (
    v_next_number, v_cycle_number, p_amount, p_paid_to, p_expense_head,
    p_payment_mode, p_paid_by, p_paid_by_name, auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

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
    set current_number = 0,
        cycle_number = cycle_number + 1,
        cycle_started_at = now()
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
    set current_number = 0,
        cycle_number = cycle_number + 1,
        cycle_started_at = now()
    where id = 1;
end;
$$;

create or replace function public.get_active_cycle_info()
returns table (
  receipt_cycle_number integer,
  receipt_cycle_started_at timestamptz,
  voucher_cycle_number integer,
  voucher_cycle_started_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    r.cycle_number,
    r.cycle_started_at,
    v.cycle_number,
    v.cycle_started_at
  from public.receipt_counter r,
       public.voucher_counter v
  where r.id = 1 and v.id = 1;
$$;

grant execute on function public.get_active_cycle_info to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Restore shared Mandal visibility for income/expense selects.
-- ----------------------------------------------------------------------------
drop policy if exists "income_select_own" on public.income;
drop policy if exists "expense_select_own" on public.expense;

create policy "income_select_all" on public.income
  for select to authenticated using (true);

create policy "expense_select_all" on public.expense
  for select to authenticated using (true);
