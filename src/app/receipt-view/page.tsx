"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import type { IncomeEntry } from "@/types/database";
import { formatCurrency, formatDate, padNumber } from "@/lib/utils";
import { Search, ArrowRightCircle } from "lucide-react";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthISO() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export default function ReceiptViewPage() {
  const [fromDate, setFromDate] = useState(firstOfMonthISO());
  const [toDate, setToDate] = useState(todayISO());
  const [query, setQuery] = useState("");
  const [receipts, setReceipts] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadReceipts() {
    setLoading(true);
    const supabase = createClient();
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: profile } = await supabase
      .from("users")
      .select("role, full_report_access")
      .eq("id", user?.id ?? "")
      .single();

    const restrict = profile?.role !== "admin" && !profile?.full_report_access;
    const queryBuilder = supabase
      .from("income")
      .select("*")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .order("created_at", { ascending: false })
      .limit(100);

    if (restrict && user?.id) {
      queryBuilder.eq("created_by", user.id);
    }

    const trimmed = query.trim();
    if (trimmed) {
      const numeric = Number(trimmed);
      if (!Number.isNaN(numeric)) {
        queryBuilder.eq("receipt_number", numeric);
      } else {
        queryBuilder.ilike("donor_name", `%${trimmed}%`);
      }
    }

    const { data } = await queryBuilder;
    setReceipts(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  return (
    <div className="min-h-screen bg-[#fdfbf7]">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Receipt View</h1>
            <p className="text-sm text-gray-500">Search receipts by number or donor name.</p>
          </div>
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
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
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-700">Search</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Receipt # or donor name"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-saffron-500 focus:outline-none focus:ring-1 focus:ring-saffron-500"
                />
                <button
                  type="button"
                  onClick={loadReceipts}
                  className="rounded-lg bg-saffron-600 px-4 py-2 text-sm font-semibold text-white hover:bg-saffron-700"
                >
                  <Search size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading receipts...</p>
        ) : receipts.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            No receipts found for the selected range.
          </div>
        ) : (
          <div className="space-y-4">
            {receipts.map((receipt) => (
              <Link
                key={receipt.id}
                href={`/receipt/${receipt.id}`}
                className="block overflow-hidden rounded-xl border border-gray-200 bg-white p-4 transition hover:shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      #{padNumber(receipt.receipt_number)} · {receipt.donor_name}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Collected by {receipt.collected_by_name} · {formatDate(receipt.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-saffron-700">
                    <span>{formatCurrency(Number(receipt.amount))}</span>
                    <ArrowRightCircle size={18} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
