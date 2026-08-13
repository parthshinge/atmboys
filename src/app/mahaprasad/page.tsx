"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import type { AppUser, MahaprasadDonation } from "@/types/database";
import { formatDate } from "@/lib/utils";
import { UtensilsCrossed, CheckCircle2, FileText } from "lucide-react";

const fixedCollectors = ["Nikhil", "Vishal", "Vishwajeet", "Sunny"];

const mahaprasadSchema = z.object({
  donor_name: z.string().min(1, "Donor name is required"),
  mobile_number: z.string().optional(),
  items_donated: z.string().min(1, "Material / items donated is required"),
  collected_by: z.string().min(1, "Select who collected this"),
  created_at: z.string().optional(),
});

type MahaprasadFormValues = z.infer<typeof mahaprasadSchema>;

export default function MahaprasadPage() {
  const [collectors, setCollectors] = useState<AppUser[]>([]);
  const [donations, setDonations] = useState<MahaprasadDonation[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);

  const uniqueCollectors = collectors.filter(
    (collector, index, self) =>
      index === self.findIndex((c) => c.full_name === collector.full_name)
  );

  function getCurrentLocalISO() {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
    return localISOTime;
  }

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<MahaprasadFormValues>({
    resolver: zodResolver(mahaprasadSchema),
    defaultValues: {
      donor_name: "",
      mobile_number: "",
      items_donated: "",
      collected_by: "",
      created_at: getCurrentLocalISO(),
    },
  });

  const loadDonations = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("mahaprasad_donations")
      .select("*")
      .order("created_at", { ascending: false });
    setDonations(data ?? []);
    setLoading(false);
  }, []);

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
    loadDonations();

    const supabase = createClient();
    const channel = supabase
      .channel("mahaprasad-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mahaprasad_donations" },
        () => loadDonations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [setValue, loadDonations]);

  async function onSubmit(values: MahaprasadFormValues) {
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    setLastSavedId(null);
    const supabase = createClient();

    const collector = collectors.find((c) => c.id === values.collected_by);
    const isFixedCollector = fixedCollectors.includes(values.collected_by);
    const collectedByName = collector?.full_name ?? (isFixedCollector ? values.collected_by : "");
    const collectedById = collector?.id ?? null;

    const recordDate = values.created_at
      ? new Date(values.created_at).toISOString()
      : new Date().toISOString();

    const { data, error: insertError } = await supabase
      .from("mahaprasad_donations")
      .insert({
        donor_name: values.donor_name.trim(),
        mobile_number: values.mobile_number?.trim() || null,
        items_donated: values.items_donated.trim(),
        collected_by: collectedById,
        collected_by_name: collectedByName,
        created_at: recordDate,
      })
      .select()
      .single();

    setSubmitting(false);

    if (insertError || !data) {
      setError(insertError?.message ?? "Failed to save Mahaprasad donation.");
      return;
    }

    setSuccessMessage("Mahaprasad donation saved successfully!");
    setLastSavedId(data.id);
    reset({
      donor_name: "",
      mobile_number: "",
      items_donated: "",
      collected_by: values.collected_by,
      created_at: getCurrentLocalISO(),
    });
    loadDonations();
  }

  return (
    <div className="min-h-screen bg-[#fdfbf7]">
      <Navbar />
      <main className="mx-auto max-w-lg px-4 py-6 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <UtensilsCrossed className="text-saffron-600" size={24} />
            <h1 className="text-xl font-bold text-gray-900">Mahaprasad Material Donation</h1>
          </div>
          <p className="text-xs text-gray-500">
            Record physical material items donated for Mahaprasad (no financial receipts).
          </p>
        </div>

        {successMessage && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-green-800 font-semibold text-sm">
              <CheckCircle2 size={18} />
              <span>{successMessage}</span>
            </div>
            {lastSavedId && (
              <div className="pt-1">
                <Link
                  href={`/mahaprasad/acknowledgement/${lastSavedId}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800"
                >
                  <FileText size={14} />
                  View / Generate Acknowledgement
                </Link>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
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
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Material / Items Donated <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              {...register("items_donated")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-saffron-500 focus:outline-none focus:ring-1 focus:ring-saffron-500"
              placeholder="e.g. Rice – 25 kg, Sugar – 5 kg, Oil – 2 litres"
            />
            {errors.items_donated && (
              <p className="mt-1 text-xs text-red-600">{errors.items_donated.message}</p>
            )}
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

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Date & Time</label>
            <input
              type="datetime-local"
              {...register("created_at")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-saffron-500 focus:outline-none focus:ring-1 focus:ring-saffron-500"
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-saffron-600 py-2.5 text-base font-semibold text-white hover:bg-saffron-700 disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Save Donation"}
          </button>
        </form>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-800">Recent Mahaprasad Donations</h2>
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : donations.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
              No Mahaprasad material donations recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {donations.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 space-y-2 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-gray-900">{item.donor_name}</h3>
                      {item.mobile_number && (
                        <p className="text-xs text-gray-500">📱 {item.mobile_number}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {formatDate(item.created_at)}
                    </span>
                  </div>

                  <div className="rounded-lg bg-saffron-50/70 p-2.5 text-xs text-saffron-900 border border-saffron-100">
                    <p className="font-medium whitespace-pre-wrap">{item.items_donated}</p>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-gray-500">
                      Collected By: <span className="font-medium text-gray-700">{item.collected_by_name}</span>
                    </p>
                    <Link
                      href={`/mahaprasad/acknowledgement/${item.id}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 rounded-lg border border-saffron-300 bg-white px-2.5 py-1 text-xs font-semibold text-saffron-700 hover:bg-saffron-50 transition"
                    >
                      <FileText size={13} />
                      Acknowledgement
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
