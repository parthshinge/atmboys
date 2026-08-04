# 🪔 ATM Boy's — Ganesh Mandal Ledger

A minimal, mobile-first donation & expense ledger for a local Ganesh Mandal.
Two roles only: **Admin** and **Collector**. Nothing else.

## Tech Stack
Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, Realtime) · React Hook Form + Zod · xlsx · html-to-image · jsPDF

## What this app does (and only this)
- **Login** — Admin & Collector roles.
- **Income** — auto-numbered receipts (01, 02, 03…), donor name, mobile (optional), payment mode, collected-by dropdown. Generates a printable receipt (PNG + PDF + WhatsApp share) on save.
- **Expense** — auto-numbered vouchers, paid-to, expense head, payment mode.
- **Dashboard** — today's income, today's expense, current balance, recent transactions — updates live via Supabase Realtime, no refresh needed.
- **Reports** — date-filtered income & expense lists, exports to a single `.xlsx` with two sheets (Income, Expense).
- **Admin** — manage collectors, manage expense heads, view reports/export, optionally reset the receipt/voucher counters.

No settings pages, no bank account management, no logo management, no user profile pages, no org settings — intentionally.

## Concurrency safety
Receipt and voucher numbers are allocated inside Postgres `SECURITY DEFINER` RPC functions (`create_income_entry`, `create_expense_entry`) using `pg_advisory_xact_lock`. Two collectors saving at the exact same instant can never receive the same number — the second call simply waits microseconds for the lock and gets the next one.

## Database
Exactly 5 core tables per spec: `users`, `income`, `expense`, `receipt_counter`, `voucher_counter`.
One additional small table, `expense_heads`, was added because the spec's own Admin Panel section requires "Manage Expense Heads" — this needs somewhere to persist the editable list.

## Roles & permissions

- **Admin** — full access: Dashboard analytics, Reports/Excel export, User Management (add/edit/delete/activate/deactivate/reset password/assign role), Manage Expense Heads, Reset Receipt/Voucher Counter.
- **User** (collector) — Login, Create Income/Expense receipts, "My Records" (their own entries only), print/share receipts. No access to `/dashboard`, `/reports`, or `/admin` — those routes redirect Users to `/my-records`.

New members created from the Admin panel get login access immediately with User-only permissions.

## Reset = fresh accounting cycle

Clicking **Reset Receipt Counter** or **Reset Voucher Counter** in the Admin panel:
- Restarts numbering at 01.
- Starts a new "cycle" — Users (collectors) will only see records created *after* the reset in their own My Records / entry history.
- Nothing is deleted. Older records remain in the database as archived history, and Admin can always see everything (active + archived) via Reports.



1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create a Supabase project**, then in the SQL Editor run, in order:
   1. [`supabase/migrations/001_init.sql`](./supabase/migrations/001_init.sql) — creates all tables, RPC functions, RLS policies, realtime.
   2. [`supabase/migrations/002_rbac_updates.sql`](./supabase/migrations/002_rbac_updates.sql) — adds member activate/deactivate, per-member record visibility, and fresh-cycle counter resets.

   (If you're setting up a brand-new project, run both files in order — 002 depends on 001.)

3. **Environment variables** — copy `.env.example` to `.env.local` and fill in your real Supabase project URL, anon key, and service role key:
   ```bash
   cp .env.example .env.local
   ```

4. **Create your first Admin user**
   - In Supabase Dashboard → Authentication → Users, create a user with email/password.
   - In the SQL Editor, insert their profile row:
     ```sql
     insert into public.users (id, full_name, role)
     values ('paste-the-auth-user-uuid-here', 'Your Name', 'admin');
     ```
   - Log in at `/login`. From the Admin panel you can now create Collector accounts directly from the UI — no more manual SQL needed after this.

5. **Run locally**
   ```bash
   npm run dev
   ```

6. **Deploy to Vercel** — import the repo, set the same three env vars in the Vercel project settings, deploy.

## Known limitation
`xlsx` (SheetJS) hasn't published a patched release to the public npm registry since `0.18.5`; their newer, vulnerability-fixed builds are only distributed from SheetJS's own CDN. `npm audit` will flag this — it's a known upstream distribution issue, not a bug in this app.
