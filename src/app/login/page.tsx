"use client";

import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("deactivated") === "1") {
      setError("Your account has been deactivated. Contact the admin.");
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginFormValues) {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword(values);
    setLoading(false);

    if (signInError) {
      setError("Invalid email or password.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("users")
        .select("is_active, role")
        .eq("id", user.id)
        .single();

      if (!profile) {
        await supabase.auth.signOut();
        setError(
          "Your account is missing an application profile. Contact the administrator to register your account."
        );
        return;
      }

      if (profile.is_active === false) {
        await supabase.auth.signOut();
        setError("Your account has been deactivated. Contact the admin.");
        return;
      }

      if (profile.role !== "admin" && profile.role !== "collector") {
        await supabase.auth.signOut();
        setError(
          "Your account role is invalid. Contact the administrator to fix your account."
        );
        return;
      }

      router.push(profile.role === "admin" ? "/dashboard" : "/my-records");
      router.refresh();
      return;
    }

    router.push("/my-records");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fdfbf7] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-saffron-100 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <p className="text-3xl">🪔</p>
          <h1 className="mt-2 text-xl font-bold text-saffron-700">ATM Boy&apos;s</h1>
          <p className="text-sm text-gray-500">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              autoComplete="email"
              {...register("email")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-saffron-500 focus:outline-none focus:ring-1 focus:ring-saffron-500"
              placeholder="you@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              {...register("password")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-saffron-500 focus:outline-none focus:ring-1 focus:ring-saffron-500"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-saffron-600 py-2.5 text-base font-semibold text-white transition-colors hover:bg-saffron-700 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
