"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function safeNext(value: string | null): string {
  // Only ever follow a same-site relative path, never an absolute/external
  // URL — `next` comes from a query param an attacker could craft.
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const searchParams = useSearchParams();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        // A full navigation (not router.push) so the browser is guaranteed
        // to send the just-set cookie on the very next request.
        window.location.href = safeNext(searchParams.get("next"));
        return;
      }

      const data = await res.json().catch(() => ({}));
      setError(data.error || "Incorrect password.");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <div className="rounded-3xl border border-violet-100 bg-white p-7 shadow-[0_4px_32px_-8px_rgba(139,92,246,0.2)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-lg font-bold text-white shadow-sm shadow-violet-300/60 dark:shadow-none">
            U
          </span>
          <h1 className="text-xl font-semibold text-violet-950 dark:text-white">Sign in</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-violet-200/60">
            Enter the password to access Udel&apos;s Money Tracker.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError("");
            }}
            placeholder="Password"
            className={`rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 dark:bg-zinc-900 dark:focus:ring-violet-500/30 ${
              error
                ? "border-red-400 dark:border-red-700"
                : "border-violet-200 dark:border-white/10"
            }`}
          />
          <button
            type="submit"
            disabled={busy || !password}
            className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-2.5 text-sm font-medium text-white shadow-sm shadow-violet-300/50 hover:from-violet-500 hover:to-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-none"
          >
            {busy ? "Checking…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
