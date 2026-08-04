import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import AdminPageClient from "./AdminPageClient";

export default async function AdminPage() {
  const guard = await requireAdmin();
  if (!guard.ok) {
    if (guard.status === 401) {
      redirect("/login");
    }
    redirect("/my-records");
  }

  return <AdminPageClient />;
}
