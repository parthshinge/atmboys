export type UserRole = "admin" | "collector";
export type PaymentMode = "cash" | "online";

export interface AppUser {
  id: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  full_report_access?: boolean;
  created_at: string;
}

export interface IncomeEntry {
  id: string;
  receipt_number: number;
  amount: number;
  donor_name: string;
  mobile_number: string | null;
  payment_mode: PaymentMode;
  collected_by: string | null;
  collected_by_name: string;
  created_at: string;
}

export interface ExpenseEntry {
  id: string;
  voucher_number: number;
  amount: number;
  paid_to: string;
  expense_head: string;
  payment_mode: PaymentMode;
  paid_by: string | null;
  paid_by_name: string;
  created_at: string;
}

export interface ExpenseHead {
  id: string;
  name: string;
  created_at: string;
}
