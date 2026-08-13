"use client";

import { useEffect, useRef, useState, use } from "react";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import type { MahaprasadDonation } from "@/types/database";
import { formatDate } from "@/lib/utils";
import { Download, Share2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function MahaprasadAcknowledgementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [entry, setEntry] = useState<MahaprasadDonation | null>(null);
  const [loading, setLoading] = useState(true);
  const slipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadEntry() {
      const supabase = createClient();
      const { data } = await supabase
        .from("mahaprasad_donations")
        .select("*")
        .eq("id", id)
        .single();
      setEntry(data);
      setLoading(false);
    }
    loadEntry();
  }, [id]);

  async function handleDownloadPng() {
    if (!slipRef.current) return;
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(slipRef.current, { pixelRatio: 2 });
    const link = document.createElement("a");
    link.download = `mahaprasad-acknowledgement-${id.slice(0, 8)}.png`;
    link.href = dataUrl;
    link.click();
  }

  async function handleDownloadPdf() {
    if (!slipRef.current || !entry) return;
    const { toPng } = await import("html-to-image");
    const { jsPDF } = await import("jspdf");
    const dataUrl = await toPng(slipRef.current, { pixelRatio: 2 });

    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: [img.width, img.height],
    });
    pdf.addImage(dataUrl, "PNG", 0, 0, img.width, img.height);
    pdf.save(`mahaprasad-acknowledgement-${id.slice(0, 8)}.pdf`);
  }

  async function handleWhatsAppShare() {
    if (!entry) return;
    const rawMessage = `अष्टविनायक तरुण मंडळ, हिंगणगाव.\n\nमहाप्रसाद साहित्य देणगी\n\nदेणगीदार:\n${entry.donor_name}\n\nसाहित्य:\n${entry.items_donated}\n\nस्वीकारकर्ता:\n${entry.collected_by_name}\n\nदिनांक:\n${formatDate(entry.created_at)}\n\n🌸 गणपती बाप्पा मोरया 🙏`;

    const encodedText = encodeURIComponent(rawMessage);

    if (slipRef.current && navigator.canShare) {
      try {
        const { toBlob } = await import("html-to-image");
        const blob = await toBlob(slipRef.current, { pixelRatio: 2 });
        if (blob) {
          const file = new File(
            [blob],
            `mahaprasad-acknowledgement-${id.slice(0, 8)}.png`,
            { type: "image/png" }
          );
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], text: rawMessage });
            return;
          }
        }
      } catch {
        // Fall back to direct WhatsApp link below
      }
    }

    window.open(`https://wa.me/?text=${encodedText}`, "_blank");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fdfbf7]">
        <Navbar />
        <p className="p-6 text-center text-sm text-gray-500">Loading acknowledgement...</p>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-screen bg-[#fdfbf7]">
        <Navbar />
        <p className="p-6 text-center text-sm text-gray-500">Record not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdfbf7]">
      <Navbar />
      <main className="mx-auto max-w-lg px-4 py-6">
        <Link
          href="/mahaprasad"
          className="no-print mb-4 flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} /> Back to Mahaprasad
        </Link>

        <div
          ref={slipRef}
          className="relative overflow-hidden rounded-2xl border-2 border-amber-600 bg-white p-6 sm:p-8 shadow-lg font-sans"
        >
          {/* Mandal Logo anchored at top-left outer corner */}
          <div className="pointer-events-none absolute top-3 left-3 sm:top-4 sm:left-4 z-20 w-16 h-16 sm:w-20 sm:h-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Mandal Logo"
              className="h-full w-full object-contain"
            />
          </div>

          {/* Background Watermark Image */}
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center p-6 opacity-15">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/watermark.jpg"
              alt="Watermark"
              className="max-h-full max-w-full object-contain"
            />
          </div>

          {/* Acknowledgement Content */}
          <div className="relative z-10">
            {/* Centered Header */}
            <div className="mb-6 border-b-2 border-dashed border-amber-300 pb-4 text-center">
              <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold text-amber-800 leading-tight">
                अष्टविनायक तरुण मंडळ, हिंगणगाव.
              </h2>
              <div className="mt-2 inline-block rounded-full bg-amber-100 px-4 py-1 text-sm sm:text-base font-bold text-amber-900 border border-amber-300">
                महाप्रसाद साहित्य देणगी
              </div>
            </div>

            <div className="space-y-4 text-base">
              <div className="border-b border-gray-100 pb-2">
                <span className="font-semibold text-gray-600 block text-xs uppercase tracking-wider">
                  देणगीदार
                </span>
                <span className="font-bold text-gray-900 text-lg">{entry.donor_name}</span>
                {entry.mobile_number && (
                  <span className="text-xs text-gray-500 block">📱 {entry.mobile_number}</span>
                )}
              </div>

              <div className="border-b border-gray-100 pb-2">
                <span className="font-semibold text-gray-600 block text-xs uppercase tracking-wider mb-1">
                  साहित्य (Items Donated)
                </span>
                <div className="rounded-xl bg-amber-50/80 p-3 text-amber-950 font-medium whitespace-pre-wrap border border-amber-200/60 leading-relaxed text-sm">
                  {entry.items_donated}
                </div>
              </div>

              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <span className="font-semibold text-gray-700">स्वीकारकर्ता :</span>
                <span className="font-medium text-gray-900">{entry.collected_by_name}</span>
              </div>

              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <span className="font-semibold text-gray-700">दिनांक :</span>
                <span className="font-medium text-gray-900">{formatDate(entry.created_at)}</span>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-amber-200 text-center">
              <p className="text-lg font-bold text-amber-800">🌸 गणपती बाप्पा मोरया 🙏</p>
            </div>
          </div>
        </div>

        <div className="no-print mt-4 grid grid-cols-3 gap-2">
          <button
            onClick={handleDownloadPng}
            className="flex flex-col items-center gap-1 rounded-lg border border-gray-300 bg-white py-3 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download size={18} />
            PNG
          </button>
          <button
            onClick={handleDownloadPdf}
            className="flex flex-col items-center gap-1 rounded-lg border border-gray-300 bg-white py-3 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download size={18} />
            PDF
          </button>
          <button
            onClick={handleWhatsAppShare}
            className="flex flex-col items-center gap-1 rounded-lg border border-green-300 bg-green-50 py-3 text-xs font-medium text-green-700 hover:bg-green-100"
          >
            <Share2 size={18} />
            WhatsApp
          </button>
        </div>
      </main>
    </div>
  );
}
