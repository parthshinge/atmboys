"use client";

import { useEffect, useRef, useState, use } from "react";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import type { IncomeEntry } from "@/types/database";
import { formatDate, padNumber } from "@/lib/utils";
import { Download, Share2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [entry, setEntry] = useState<IncomeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadEntry() {
      const supabase = createClient();
      const { data } = await supabase.from("income").select("*").eq("id", id).single();
      setEntry(data);
      setLoading(false);
    }
    loadEntry();
  }, [id]);

  async function handleDownloadPng() {
    if (!receiptRef.current) return;
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(receiptRef.current, { pixelRatio: 2 });
    const link = document.createElement("a");
    link.download = `receipt-${padNumber(entry!.receipt_number)}.png`;
    link.href = dataUrl;
    link.click();
  }

  async function handleDownloadPdf() {
    if (!receiptRef.current || !entry) return;
    const { toPng } = await import("html-to-image");
    const { jsPDF } = await import("jspdf");
    const dataUrl = await toPng(receiptRef.current, { pixelRatio: 2 });

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
    pdf.save(`receipt-${padNumber(entry.receipt_number)}.pdf`);
  }

  async function handleWhatsAppShare() {
    if (!entry) return;
    const text = encodeURIComponent(
      `|| नवसाचा गणपती ||\nअष्टविनायक तरुण मंडळ, हिंगणगाव.\n\nReceipt No. ${padNumber(entry.receipt_number)}\nदेणगीदार : ${entry.donor_name}\nरक्कम : ₹ ${Number(entry.amount).toLocaleString('en-IN')}\nदेणगी स्वरूप : ${entry.payment_mode}\nस्वीकारकर्ता : ${entry.collected_by_name}\nतारीख : ${formatDate(entry.created_at)}\n\n🌸 गणपती बाप्पा मोरया 🙏`
    );

    if (receiptRef.current && navigator.canShare) {
      try {
        const { toBlob } = await import("html-to-image");
        const blob = await toBlob(receiptRef.current, { pixelRatio: 2 });
        if (blob) {
          const file = new File([blob], `receipt-${padNumber(entry.receipt_number)}.png`, {
            type: "image/png",
          });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], text: decodeURIComponent(text) });
            return;
          }
        }
      } catch {
        // fall through to wa.me link below
      }
    }

    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fdfbf7]">
        <Navbar />
        <p className="p-6 text-center text-sm text-gray-500">Loading receipt...</p>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-screen bg-[#fdfbf7]">
        <Navbar />
        <p className="p-6 text-center text-sm text-gray-500">Receipt not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdfbf7]">
      <Navbar />
      <main className="mx-auto max-w-md px-4 py-6">
        <Link
          href="/income"
          className="no-print mb-4 flex items-center gap-1 text-sm font-medium text-gray-600"
        >
          <ArrowLeft size={16} /> Back to Income
        </Link>

        <div
          ref={receiptRef}
          className="relative overflow-hidden rounded-xl border-2 border-saffron-600 bg-white p-6 shadow-md font-sans"
        >
          {/* Logo in Upper Right Corner */}
          <div className="absolute top-3 right-3 w-16 h-16 sm:w-20 sm:h-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Mandal Logo"
              className="h-full w-full object-contain"
            />
          </div>

          <div className="mb-4 pr-16 border-b-2 border-dashed border-saffron-300 pb-3 text-left">
            <p className="text-sm sm:text-base font-bold text-saffron-600">|| नवसाचा गणपती ||</p>
            <h2 className="mt-1 text-base sm:text-lg font-extrabold text-saffron-700 leading-tight">
              अष्टविनायक तरुण मंडळ, हिंगणगाव.
            </h2>
          </div>

          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between items-center border-b border-gray-100 pb-1.5">
              <span className="font-semibold text-gray-700">Receipt No.</span>
              <span className="font-bold text-saffron-700">{padNumber(entry.receipt_number)}</span>
            </div>

            <div className="flex justify-between items-center border-b border-gray-100 pb-1.5">
              <span className="font-semibold text-gray-700">देणगीदार :</span>
              <span className="font-medium text-gray-900">{entry.donor_name}</span>
            </div>

            <div className="flex justify-between items-center border-b border-gray-100 pb-1.5">
              <span className="font-semibold text-gray-700">रक्कम :</span>
              <span className="font-bold text-saffron-700">₹ {Number(entry.amount).toLocaleString("en-IN")}</span>
            </div>

            <div className="flex justify-between items-center border-b border-gray-100 pb-1.5">
              <span className="font-semibold text-gray-700">देणगी स्वरूप :</span>
              <span className="font-medium text-gray-900 capitalize">{entry.payment_mode}</span>
            </div>

            <div className="flex justify-between items-center border-b border-gray-100 pb-1.5">
              <span className="font-semibold text-gray-700">स्वीकारकर्ता :</span>
              <span className="font-medium text-gray-900">{entry.collected_by_name}</span>
            </div>

            <div className="flex justify-between items-center border-b border-gray-100 pb-1.5">
              <span className="font-semibold text-gray-700">तारीख :</span>
              <span className="font-medium text-gray-900">{formatDate(entry.created_at)}</span>
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-saffron-200 text-center">
            <p className="text-base font-bold text-saffron-700">🌸 गणपती बाप्पा मोरया 🙏</p>
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
