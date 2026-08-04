"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";
import { cn } from "@/lib/utils";
import { LogOut, LayoutDashboard, IndianRupee, Receipt, FileBarChart, Shield } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [fullName, setFullName] = useState<string>("");

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("users")
        .select("role, full_name")
        .eq("id", user.id)
        .single();
      if (active && data) {
        setRole(data.role);
        setFullName(data.full_name);
      }
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const navItems =
    role === "admin"
      ? [
          { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
          { href: "/income", label: "Income", icon: IndianRupee },
          { href: "/expense", label: "Expense", icon: Receipt },
          { href: "/reports", label: "Reports", icon: FileBarChart },
          { href: "/admin", label: "Admin", icon: Shield },
        ]
      : [
          { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
          { href: "/income", label: "Income", icon: IndianRupee },
          { href: "/expense", label: "Expense", icon: Receipt },
          { href: "/reports", label: "Reports", icon: FileBarChart },
          { href: "/my-records", label: "My Records", icon: LayoutDashboard },
        ];

  return (
    <header className="no-print sticky top-0 z-20 border-b border-saffron-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div>
          <p className="text-lg font-bold text-saffron-700">🪔 ATM Boy&apos;s</p>
          {fullName && (
            <p className="text-xs text-gray-500">
              {fullName} · {role === "admin" ? "Admin" : "Collector"}
            </p>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
      <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 pb-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-saffron-600 text-white"
                  : "text-gray-600 hover:bg-saffron-50"
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
