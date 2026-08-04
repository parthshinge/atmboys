"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import type { ExpenseHead, ExpenseEntry } from "@/types/database";

const expenseSchema = z.object({
  amount: z.coerce.number().positive("Enter a valid amount"),
  paid_to: z.string().min(1, "Paid to is required"),
  expense_head: z.string().min(1, "Select an expense head"),
  payment_mode: z.enum(["cash", "online"]),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

export default function ExpensePage() {
  const router = useRouter();
  const [heads, setHeads] = useState<ExpenseHead[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedVoucher, setSavedVoucher] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { payment_mode: "cash" },
  });

  useEffect(() => {
    async function loadHeads() {
      const supabase = createClient();
      const { data } = await supabase.from("expense_heads").select("*").order("name");
      if (data) setHeads(data);
    }
    loadHeads();
  }, []);

  async function onSubmit(values: ExpenseFormValues) {
    setSubmitting(true);
    setError(null);
    setSavedVoucher(null);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: profile } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", user?.id ?? "")
      .single();

    const { data, error: rpcError } = (await supabase
      .rpc("create_expense_entry", {
        p_amount: values.amount,
        p_paid_to: values.paid_to,
        p_expense_head: values.expense_head,
        p_payment_mode: values.payment_mode,
        p_paid_by: user?.id ?? null,
        p_paid_by_name: profile?.full_name ?? "",
      })
      .single()) as { data: ExpenseEntry | null; error: { message: string } | null };

    setSubmitting(false);

    if (rpcError || !data) {
      setError(rpcError?.message ?? "Failed to save expense entry.");
      return;
    }

    setSavedVoucher(data.voucher_number);
    reset({ payment_mode: "cash", amount: undefined, paid_to: "", expense_head: "" });
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#fdfbf7]">
      <Navbar />
      <main className="mx-auto max-w-lg px-4 py-6">
        <h1 className="mb-4 text-xl font-bold text-gray-900">Add Expense</h1>

        {savedVoucher !== null && (
          <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            Voucher #{savedVoucher.toString().padStart(2, "0")} saved successfully.
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              {...register("amount")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-saffron-500 focus:outline-none focus:ring-1 focus:ring-saffron-500"
              placeholder="0.00"
            />
            {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Paid To</label>
            <input
              type="text"
              {...register("paid_to")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-saffron-500 focus:outline-none focus:ring-1 focus:ring-saffron-500"
              placeholder="Vendor / person name"
            />
            {errors.paid_to && <p className="mt-1 text-xs text-red-600">{errors.paid_to.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Expense Head</label>
            <select
              {...register("expense_head")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-saffron-500 focus:outline-none focus:ring-1 focus:ring-saffron-500"
              defaultValue=""
            >
              <option value="" disabled>
                Select expense head
              </option>
              {heads.map((h) => (
                <option key={h.id} value={h.name}>
                  {h.name}
                </option>
              ))}
            </select>
            {errors.expense_head && (
              <p className="mt-1 text-xs text-red-600">{errors.expense_head.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Payment Mode</label>
            <div className="flex gap-3">
              {(["cash", "online"] as const).map((mode) => (
                <label
                  key={mode}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 py-2.5 text-sm font-medium capitalize has-[:checked]:border-saffron-600 has-[:checked]:bg-saffron-50 has-[:checked]:text-saffron-700"
                >
                  <input type="radio" value={mode} {...register("payment_mode")} className="accent-saffron-600" />
                  {mode}
                </label>
              ))}
            </div>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-saffron-600 py-2.5 text-base font-semibold text-white hover:bg-saffron-700 disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        </form>
      </main>
    </div>
  );
}
