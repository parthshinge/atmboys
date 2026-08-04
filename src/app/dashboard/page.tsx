"use client";

import { useEffect, useState, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import type { IncomeEntry, ExpenseEntry } from "@/types/database";
import { formatCurrency, formatDate, padNumber } from "@/lib/utils";
import { ArrowUpCircle, ArrowDownCircle, Wallet } from "lucide-react";

type Transaction =
  | ({ kind: "income" } & IncomeEntry)
  | ({ kind: "expense" } & ExpenseEntry);

export default function DashboardPage() {
  const [todayIncome, setTodayIncome] = useState(0);
  const [todayExpense, setTodayExpense] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data: profile } = await supabase
      .from("users")
      .select("role, full_report_access")
      .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
      .single();

    const shouldRestrict = profile?.role !== "admin" && !profile?.full_report_access;
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const incomeQuery = supabase.from("income").select("amount, created_at");
    const expenseQuery = supabase.from("expense").select("amount, created_at");
    const recentIncomeQuery = supabase.from("income").select("*").order("created_at", {
      ascending: false,
    })
      .limit(10);
    const recentExpenseQuery = supabase.from("expense").select("*").order("created_at", {
      ascending: false,
    })
      .limit(10);

    if (shouldRestrict && userId) {
      incomeQuery.eq("created_by", userId);
      expenseQuery.eq("created_by", userId);
      recentIncomeQuery.eq("created_by", userId);
      recentExpenseQuery.eq("created_by", userId);
    }

    const [
      { data: incomeAll },
      { data: expenseAll },
      { data: recentIncome },
      { data: recentExpense },
    ] = await Promise.all([incomeQuery, expenseQuery, recentIncomeQuery, recentExpenseQuery]);

    const income = incomeAll ?? [];
    const expense = expenseAll ?? [];

    const totalIncomeValue = income.reduce((sum, r) => sum + Number(r.amount), 0);
    const totalExpenseValue = expense.reduce((sum, r) => sum + Number(r.amount), 0);
    const todayIncomeValue = income
      .filter((r) => new Date(r.created_at) >= startOfDay)
      .reduce((sum, r) => sum + Number(r.amount), 0);
    const todayExpenseValue = expense
      .filter((r) => new Date(r.created_at) >= startOfDay)
      .reduce((sum, r) => sum + Number(r.amount), 0);

    setTotalIncome(totalIncomeValue);
    setTotalExpense(totalExpenseValue);
    setTodayIncome(todayIncomeValue);
    setTodayExpense(todayExpenseValue);
    const combined: Transaction[] = [
      ...(recentIncome ?? []).map((r) => ({ kind: "income" as const, ...r })),
      ...(recentExpense ?? []).map((r) => ({ kind: "expense" as const, ...r })),
    ]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    setRecent(combined);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();

    const supabase = createClient();
    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "income" },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "expense" },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const balance = totalIncome - totalExpense;

  return (
    <div className="min-h-screen bg-[#fdfbf7]">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Today's Income"
            value={formatCurrency(todayIncome)}
            icon={<ArrowUpCircle className="text-green-600" size={22} />}
          />
          <StatCard
            label="Today's Expense"
            value={formatCurrency(todayExpense)}
            icon={<ArrowDownCircle className="text-red-600" size={22} />}
          />
          <StatCard
            label="Current Balance"
            value={formatCurrency(balance)}
            icon={<Wallet className="text-saffron-600" size={22} />}
          />
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold text-gray-800">Recent Transactions</h2>
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : recent.length === 0 ? (
            <p className="text-sm text-gray-500">No transactions yet.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              {recent.map((tx) => (
                <div
                  key={`${tx.kind}-${tx.id}`}
                  className="flex items-center justify-between border-b border-gray-100 px-4 py-3 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    {tx.kind === "income" ? (
                      <ArrowUpCircle className="text-green-600" size={20} />
                    ) : (
                      <ArrowDownCircle className="text-red-600" size={20} />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {tx.kind === "income"
                          ? `${tx.donor_name} · Receipt #${padNumber(tx.receipt_number)}`
                          : `${tx.paid_to} · Voucher #${padNumber(tx.voucher_number)}`}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(tx.created_at)}</p>
                    </div>
                  </div>
                  <p
                    className={`text-sm font-bold ${
                      tx.kind === "income" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {tx.kind === "income" ? "+" : "-"}
                    {formatCurrency(Number(tx.amount))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
