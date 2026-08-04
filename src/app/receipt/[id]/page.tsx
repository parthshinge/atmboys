"use client";

import { useEffect, useRef, useState, use } from "react";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import type { IncomeEntry } from "@/types/database";
import { formatCurrency, formatDate, padNumber } from "@/lib/utils";
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
      `------------------------------------\nअष्टविनायक तरुण मंडळ\n\nReceipt No. ${padNumber(entry.receipt_number)}\nDonor: ${entry.donor_name}\nAmount: ${formatCurrency(Number(entry.amount))}\nMode: ${entry.payment_mode}\nCollected By: ${entry.collected_by_name}\nDate: ${formatDate(entry.created_at)}\n\n🌸 गणपती बाप्पा मोरया 🙏\n------------------------------------`
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
          className="rounded-xl border-2 border-saffron-600 bg-white p-6 font-serif"
        >
          <div className="mb-4 border-b-2 border-dashed border-saffron-300 pb-3 text-center">
            <p className="text-base font-semibold text-saffron-600">|| नवसाचा गणपती ||</p>
            <h2 className="text-lg font-bold text-saffron-700">अष्टविनायक तरुण मंडळ</h2>
            <p className="text-xs text-gray-500">Donation Receipt</p>
          </div>

          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="font-semibold text-gray-700">
              Receipt No: <span className="text-saffron-700">{padNumber(entry.receipt_number)}</span>
            </span>
            <span className="text-gray-500">{formatDate(entry.created_at)}</span>
          </div>

          <dl className="space-y-2 text-sm">
            <Row label="Donor Name" value={entry.donor_name} />
            {entry.mobile_number && <Row label="Mobile" value={entry.mobile_number} />}
            <Row label="Amount" value={formatCurrency(Number(entry.amount))} bold />
            <Row label="Payment Mode" value={entry.payment_mode} capitalize />
            <Row label="Collected By" value={entry.collected_by_name} />
          </dl>

          <div className="mt-8 text-center">
            <p className="text-base font-semibold text-saffron-700">गणपती बाप्पा मोरया</p>
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

function Row({
  label,
  value,
  bold,
  capitalize,
}: {
  label: string;
  value: string;
  bold?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div className="flex justify-between border-b border-dotted border-gray-200 pb-1">
      <dt className="text-gray-500">{label}</dt>
      <dd
        className={`${bold ? "font-bold text-saffron-700" : "text-gray-800"} ${
          capitalize ? "capitalize" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
