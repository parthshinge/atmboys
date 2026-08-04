"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import type { AppUser, IncomeEntry } from "@/types/database";

const fixedCollectors = ["Nikhil", "Vishal", "Vishwajeet"];

const incomeSchema = z.object({
  amount: z.coerce.number().positive("Enter a valid amount"),
  donor_name: z.string().min(1, "Donor name is required"),
  mobile_number: z.string().optional(),
  payment_mode: z.enum(["cash", "online"]),
  collected_by: z.string().min(1, "Select who collected this"),
});

type IncomeFormValues = z.infer<typeof incomeSchema>;

export default function IncomePage() {
  const router = useRouter();
  const [collectors, setCollectors] = useState<AppUser[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uniqueCollectors = collectors.filter(
    (collector, index, self) =>
      index === self.findIndex((c) => c.full_name === collector.full_name)
  );

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeSchema),
    defaultValues: { payment_mode: "cash" },
  });

  useEffect(() => {
    async function loadCollectors() {
      const supabase = createClient();
      const { data: users } = await supabase
        .from("users")
        .select("*")
        .order("full_name");
      if (users) setCollectors(users);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setValue("collected_by", user.id);
    }
    loadCollectors();
  }, [setValue]);

  async function onSubmit(values: IncomeFormValues) {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    const collector = collectors.find((c) => c.id === values.collected_by);
    const isFixedCollector = fixedCollectors.includes(values.collected_by);
    const collectedByName = collector?.full_name ?? (isFixedCollector ? values.collected_by : "");
    const collectedById = collector?.id ?? null;

    const { data, error: rpcError } = (await supabase
      .rpc("create_income_entry", {
        p_amount: values.amount,
        p_donor_name: values.donor_name,
        p_mobile_number: values.mobile_number || null,
        p_payment_mode: values.payment_mode,
        p_collected_by: collectedById,
        p_collected_by_name: collectedByName,
      })
      .single()) as { data: IncomeEntry | null; error: { message: string } | null };

    setSubmitting(false);

    if (rpcError || !data) {
      setError(rpcError?.message ?? "Failed to save income entry.");
      return;
    }

    router.push(`/receipt/${data.id}`);
  }

  return (
    <div className="min-h-screen bg-[#fdfbf7]">
      <Navbar />
      <main className="mx-auto max-w-lg px-4 py-6">
        <h1 className="mb-4 text-xl font-bold text-gray-900">Add Income</h1>

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
            <label className="mb-1 block text-sm font-medium text-gray-700">Donor Name</label>
            <input
              type="text"
              {...register("donor_name")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-saffron-500 focus:outline-none focus:ring-1 focus:ring-saffron-500"
              placeholder="Donor's full name"
            />
            {errors.donor_name && (
              <p className="mt-1 text-xs text-red-600">{errors.donor_name.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Mobile Number <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="tel"
              {...register("mobile_number")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-saffron-500 focus:outline-none focus:ring-1 focus:ring-saffron-500"
              placeholder="10-digit mobile number"
            />
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

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Collected By</label>
            <select
              {...register("collected_by")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-saffron-500 focus:outline-none focus:ring-1 focus:ring-saffron-500"
            >
              <option value="" disabled>
                Select collector
              </option>
                  {fixedCollectors.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              {uniqueCollectors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
            {errors.collected_by && (
              <p className="mt-1 text-xs text-red-600">{errors.collected_by.message}</p>
            )}
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
