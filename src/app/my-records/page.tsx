"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import type { IncomeEntry, ExpenseEntry } from "@/types/database";
import { formatCurrency, formatDate, padNumber } from "@/lib/utils";
import { ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import Link from "next/link";

export default function MyRecordsPage() {
  const [income, setIncome] = useState<IncomeEntry[]>([]);
  const [expense, setExpense] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const [{ data: incomeData }, { data: expenseData }] = await Promise.all([
        supabase
          .from("income")
          .select("*")
          .eq("created_by", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("expense")
          .select("*")
          .eq("created_by", user.id)
          .order("created_at", { ascending: false }),
      ]);
      setIncome(incomeData ?? []);
      setExpense(expenseData ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const totalIncome = income.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalExpense = expense.reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <div className="min-h-screen bg-[#fdfbf7]">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-1 text-xl font-bold text-gray-900">My Records</h1>
        <p className="mb-4 text-sm text-gray-500">
          Receipts and vouchers you&apos;ve created this cycle.
        </p>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">My Income Collected</p>
            <p className="mt-1 text-xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">My Expenses Paid</p>
            <p className="mt-1 text-xl font-bold text-red-600">{formatCurrency(totalExpense)}</p>
          </div>
        </div>

        <div className="mb-4 flex gap-3">
          <Link
            href="/income"
            className="flex-1 rounded-lg bg-saffron-600 py-2.5 text-center text-sm font-semibold text-white hover:bg-saffron-700"
          >
            + Add Income
          </Link>
          <Link
            href="/expense"
            className="flex-1 rounded-lg border border-saffron-600 py-2.5 text-center text-sm font-semibold text-saffron-700 hover:bg-saffron-50"
          >
            + Add Expense
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <div className="space-y-6">
            <section>
              <h2 className="mb-2 text-sm font-bold text-gray-700">
                My Income Receipts ({income.length})
              </h2>
              {income.length === 0 ? (
                <p className="text-sm text-gray-400">No income entries yet.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  {income.map((r) => (
                    <Link
                      key={r.id}
                      href={`/receipt/${r.id}`}
                      className="flex items-center justify-between border-b border-gray-100 px-4 py-3 last:border-b-0 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <ArrowUpCircle className="text-green-600" size={18} />
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {r.donor_name} · #{padNumber(r.receipt_number)}
                          </p>
                          <p className="text-xs text-gray-500">{formatDate(r.created_at)}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-green-600">
                        {formatCurrency(Number(r.amount))}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-2 text-sm font-bold text-gray-700">
                My Expense Vouchers ({expense.length})
              </h2>
              {expense.length === 0 ? (
                <p className="text-sm text-gray-400">No expense entries yet.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  {expense.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between border-b border-gray-100 px-4 py-3 last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <ArrowDownCircle className="text-red-600" size={18} />
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {r.paid_to} · #{padNumber(r.voucher_number)}
                          </p>
                          <p className="text-xs text-gray-500">{formatDate(r.created_at)}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-red-600">
                        {formatCurrency(Number(r.amount))}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
