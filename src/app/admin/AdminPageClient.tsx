"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import type { AppUser, ExpenseHead, UserRole } from "@/types/database";
import {
  Trash2,
  UserPlus,
  Tag,
  RotateCcw,
  FileBarChart,
  KeyRound,
  Pencil,
  Check,
  X,
} from "lucide-react";

export default function AdminPageClient() {
  const [members, setMembers] = useState<AppUser[]>([]);
  const [heads, setHeads] = useState<ExpenseHead[]>([]);
  const [newCollector, setNewCollector] = useState({ full_name: "", email: "", password: "" });
  const [newHead, setNewHead] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  async function loadData() {
    const supabase = createClient();
    const [{ data: usersData }, { data: headsData }] = await Promise.all([
      supabase.from("users").select("*").order("full_name"),
      supabase.from("expense_heads").select("*").order("name"),
    ]);
    setMembers(usersData ?? []);
    setHeads(headsData ?? []);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateCollector(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/collectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCollector),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(body.error ?? "Failed to create member");
      return;
    }
    setNewCollector({ full_name: "", email: "", password: "" });
    setMessage("Member created — they can log in immediately with User access.");
    loadData();
  }

  async function handleDeleteMember(id: string) {
    if (!confirm("Remove this member? This cannot be undone.")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/collectors?id=${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) loadData();
  }

  async function handleSaveName(id: string) {
    if (!editingName.trim()) return;
    const supabase = createClient();
    await supabase.from("users").update({ full_name: editingName.trim() }).eq("id", id);
    setEditingId(null);
    loadData();
  }

  async function handleToggleActive(member: AppUser) {
    const supabase = createClient();
    await supabase.from("users").update({ is_active: !member.is_active }).eq("id", member.id);
    loadData();
  }

  async function handleChangeRole(member: AppUser, role: UserRole) {
    if (!confirm(`Change ${member.full_name}'s role to ${role}?`)) return;
    const supabase = createClient();
    await supabase.from("users").update({ role }).eq("id", member.id);
    loadData();
  }

  async function handleToggleReportAccess(member: AppUser) {
    const supabase = createClient();
    await supabase
      .from("users")
      .update({ full_report_access: !member.full_report_access })
      .eq("id", member.id);
    loadData();
  }

  async function handleResetPassword(id: string) {
    if (newPassword.length < 6) {
      setMessage("New password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, newPassword }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(body.error ?? "Failed to reset password");
      return;
    }
    setMessage("Password reset successfully.");
    setResettingId(null);
    setNewPassword("");
  }

  async function handleAddHead(e: React.FormEvent) {
    e.preventDefault();
    if (!newHead.trim()) return;
    const supabase = createClient();
    const { error } = await supabase.from("expense_heads").insert({ name: newHead.trim() });
    if (!error) {
      setNewHead("");
      loadData();
    }
  }

  async function handleDeleteHead(id: string) {
    const supabase = createClient();
    await supabase.from("expense_heads").delete().eq("id", id);
    loadData();
  }

  async function handleResetReceiptCounter() {
    if (
      !confirm(
        "Start a fresh receipt cycle? Numbering restarts at 01 and all members' record views reset. Existing receipts remain archived."
      )
    )
      return;
    const supabase = createClient();
    const { error } = await supabase.rpc("reset_receipt_counter");
    setMessage(error ? error.message : "Receipt counter reset — new cycle started.");
  }

  async function handleResetVoucherCounter() {
    if (
      !confirm(
        "Start a fresh voucher cycle? Numbering restarts at 01 and all members' record views reset. Existing vouchers remain archived."
      )
    )
      return;
    const supabase = createClient();
    const { error } = await supabase.rpc("reset_voucher_counter");
    setMessage(error ? error.message : "Voucher counter reset — new cycle started.");
  }

  return (
    <div className="min-h-screen bg-[#fdfbf7]">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-6 space-y-8">
        <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>

        {message && (
          <p className="rounded-lg bg-saffron-50 px-3 py-2 text-sm text-saffron-700">{message}</p>
        )}

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-800">
            <UserPlus size={18} /> User Management
          </h2>

          <form
            onSubmit={handleCreateCollector}
            className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4"
          >
            <input
              type="text"
              placeholder="Full name"
              required
              value={newCollector.full_name}
              onChange={(e) => setNewCollector({ ...newCollector, full_name: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type="email"
              placeholder="Email"
              required
              value={newCollector.email}
              onChange={(e) => setNewCollector({ ...newCollector, email: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type="password"
              placeholder="Password"
              required
              minLength={6}
              value={newCollector.password}
              onChange={(e) => setNewCollector({ ...newCollector, password: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-saffron-600 px-4 py-2 text-sm font-semibold text-white hover:bg-saffron-700 disabled:opacity-60"
            >
              Add Member
            </button>
          </form>
          <p className="mb-4 text-xs text-gray-400">
            New members get login access immediately with User-only permissions (Login, Add
            Income, Print Receipts, Share Receipts, View Their Own Records). Admins can also
            grant full report access using the toggle below.
          </p>

          <div className="divide-y divide-gray-100">
            {members.length === 0 && (
              <p className="py-3 text-sm text-gray-400">No members yet.</p>
            )}
            {members.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="flex items-center gap-2">
                  {editingId === m.id ? (
                    <>
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveName(m.id)}
                        className="rounded p-1 text-green-600 hover:bg-green-50"
                        aria-label="Save name"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100"
                        aria-label="Cancel"
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span
                        className={`text-sm ${
                          !m.is_active ? "text-gray-400 line-through" : "text-gray-800"
                        }`}
                      >
                        {m.full_name}
                      </span>
                      <button
                        onClick={() => {
                          setEditingId(m.id);
                          setEditingName(m.full_name);
                        }}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100"
                        aria-label="Edit name"
                      >
                        <Pencil size={13} />
                      </button>
                    </>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      m.role === "admin"
                        ? "bg-purple-50 text-purple-700"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {m.role}
                  </span>
                  {m.full_report_access && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Full Reports
                    </span>
                  )}
                  {!m.is_active && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      Deactivated
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <select
                    value={m.role}
                    onChange={(e) => handleChangeRole(m, e.target.value as UserRole)}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                  >
                    <option value="collector">User</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={() => handleToggleReportAccess(m)}
                    className={`rounded-lg px-2 py-1 text-xs font-medium ${
                      m.full_report_access
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {m.full_report_access ? "Full Reports" : "Own Reports"}
                  </button>
                  <button
                    onClick={() => handleToggleActive(m)}
                    className={`rounded-lg px-2 py-1 text-xs font-medium ${
                      m.is_active
                        ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        : "bg-green-50 text-green-700 hover:bg-green-100"
                    }`}
                  >
                    {m.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => setResettingId(resettingId === m.id ? null : m.id)}
                    className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50"
                    aria-label="Reset password"
                  >
                    <KeyRound size={15} />
                  </button>
                  <button
                    onClick={() => handleDeleteMember(m.id)}
                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                    aria-label="Remove member"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {resettingId === m.id && (
                  <div className="flex w-full items-center gap-2 pt-1">
                    <input
                      type="password"
                      placeholder="New password (min 6 chars)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    />
                    <button
                      onClick={() => handleResetPassword(m.id)}
                      disabled={busy}
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                    >
                      Set Password
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-800">
            <Tag size={18} /> Manage Expense Heads
          </h2>

          <form onSubmit={handleAddHead} className="mb-4 flex gap-3">
            <input
              type="text"
              placeholder="New expense head"
              value={newHead}
              onChange={(e) => setNewHead(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-saffron-600 px-4 py-2 text-sm font-semibold text-white hover:bg-saffron-700"
            >
              Add
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {heads.map((h) => (
              <span
                key={h.id}
                className="flex items-center gap-2 rounded-full bg-saffron-50 px-3 py-1.5 text-sm text-saffron-700"
              >
                {h.name}
                <button onClick={() => handleDeleteHead(h.id)} aria-label={`Remove ${h.name}`}>
                  <Trash2 size={13} />
                </button>
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-base font-bold text-gray-800">Reports & Maintenance</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/reports"
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileBarChart size={16} /> View Reports / Download Excel
            </Link>
            <button
              onClick={handleResetReceiptCounter}
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              <RotateCcw size={16} /> Reset Receipt Counter (New Cycle)
            </button>
            <button
              onClick={handleResetVoucherCounter}
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              <RotateCcw size={16} /> Reset Voucher Counter (New Cycle)
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Resetting starts a brand-new numbering cycle from 01. Members will only see records
            created after the reset; all previous records stay safely archived and remain visible
            to Admin in Reports.
          </p>
        </section>
      </main>
    </div>
  );
}
