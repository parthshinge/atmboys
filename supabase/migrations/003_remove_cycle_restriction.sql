-- ============================================================================
-- Migration 003: Allow collectors to see all of their own records across cycles.
-- ----------------------------------------------------------------------------
-- When counters are reset, collectors should not lose access to their own
-- historical income and expense entries. Admins already see all records.
-- ============================================================================

drop policy if exists "income_select_own_active_cycle" on public.income;
create policy "income_select_own" on public.income
  for select to authenticated using (
    created_by = auth.uid()
  );

drop policy if exists "expense_select_own_active_cycle" on public.expense;
create policy "expense_select_own" on public.expense
  for select to authenticated using (
    created_by = auth.uid()
  );
