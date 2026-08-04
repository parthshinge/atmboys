"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import type { IncomeEntry, ExpenseEntry } from "@/types/database";
import { formatCurrency, formatDate, padNumber } from "@/lib/utils";
import { FileSpreadsheet } from "lucide-react";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthISO() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState(firstOfMonthISO());
  const [toDate, setToDate] = useState(todayISO());
  const [income, setIncome] = useState<IncomeEntry[]>([]);
  const [expense, setExpense] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    const supabase = createClient();
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    const incomeQuery = supabase
      .from("income")
      .select("*")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .order("receipt_number", { ascending: true });
    const expenseQuery = supabase
      .from("expense")
      .select("*")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .order("voucher_number", { ascending: true });

    const [{ data: incomeData }, { data: expenseData }] = await Promise.all([
      incomeQuery,
      expenseQuery,
    ]);

    setIncome(incomeData ?? []);
    setExpense(expenseData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleExportExcel() {
    const XLSX = await import("xlsx");

    const incomeSheet = XLSX.utils.json_to_sheet(
      income.map((r) => ({
        "Receipt No": padNumber(r.receipt_number),
        Date: formatDate(r.created_at),
        "Donor Name": r.donor_name,
        Mobile: r.mobile_number ?? "",
        "Amount (₹)": Number(r.amount),
        "Payment Mode": r.payment_mode,
        "Collected By": r.collected_by_name,
      }))
    );

    const expenseSheet = XLSX.utils.json_to_sheet(
      expense.map((r) => ({
        "Voucher No": padNumber(r.voucher_number),
        Date: formatDate(r.created_at),
        "Paid To": r.paid_to,
        "Expense Head": r.expense_head,
        "Amount (₹)": Number(r.amount),
        "Payment Mode": r.payment_mode,
        "Paid By": r.paid_by_name,
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, incomeSheet, "Income");
    XLSX.utils.book_append_sheet(workbook, expenseSheet, "Expense");

    XLSX.writeFile(workbook, `mandal-report-${fromDate}-to-${toDate}.xlsx`);
  }

  const totalIncome = income.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalExpense = expense.reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <div className="min-h-screen bg-[#fdfbf7]">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="mb-4 text-xl font-bold text-gray-900">Reports</h1>

        <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={loadData}
            className="rounded-lg bg-saffron-600 px-4 py-2 text-sm font-semibold text-white hover:bg-saffron-700"
          >
            Filter
          </button>
          <button
            onClick={handleExportExcel}
            className="ml-auto flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100"
          >
            <FileSpreadsheet size={16} />
            Export Excel
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ReportTable
              title={`Income (${income.length}) · ${formatCurrency(totalIncome)}`}
              headers={["Receipt", "Donor", "Amount", "Mode", "By"]}
              rows={income.map((r) => [
                padNumber(r.receipt_number),
                r.donor_name,
                formatCurrency(Number(r.amount)),
                r.payment_mode,
                r.collected_by_name,
              ])}
            />
            <ReportTable
              title={`Expense (${expense.length}) · ${formatCurrency(totalExpense)}`}
              headers={["Voucher", "Paid To", "Amount", "Head", "By"]}
              rows={expense.map((r) => [
                padNumber(r.voucher_number),
                r.paid_to,
                formatCurrency(Number(r.amount)),
                r.expense_head,
                r.paid_by_name,
              ])}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function ReportTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-bold text-gray-800">
        {title}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-3 py-4 text-center text-gray-400">
                  No records
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="border-t border-gray-100">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 text-gray-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
