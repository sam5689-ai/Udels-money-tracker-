"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PartyRole } from "@/lib/types";

interface LedgerEntry {
  id: number;
  date: string;
  description: string;
  amount: number;
  party_role: PartyRole;
  delta: number;
  balance: number;
}

interface AccountData {
  party: string;
  balance: number;
  ledger: LedgerEntry[];
}

const ENTRY_LABEL: Record<PartyRole, string> = {
  owner: "",
  lent_to: "You lent",
  repaid_by: "They repaid you",
  borrowed_from: "You borrowed",
  repaid_to: "You repaid",
};

function currency(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}£${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PersonAccountPage() {
  const params = useParams<{ name: string }>();
  const [data, setData] = useState<AccountData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/people/${params.name}`).then(async (res) => {
      if (ignore) return;
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      setData(await res.json());
    });
    return () => {
      ignore = true;
    };
  }, [params.name]);

  if (notFound) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6 sm:py-10">
        <Link href="/dashboard" className="text-sm font-medium text-violet-600 hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-100">
          ← Back to Dashboard
        </Link>
        <p className="text-sm text-zinc-500 dark:text-violet-200/50">
          No transactions found for {decodeURIComponent(String(params.name))}.
        </p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-12 text-sm text-zinc-500 dark:text-violet-200/50 sm:px-6">
        Loading…
      </main>
    );
  }

  const balanceColor =
    data.balance > 0
      ? "text-green-600 dark:text-green-400"
      : data.balance < 0
        ? "text-red-600 dark:text-red-400"
        : "text-zinc-500 dark:text-violet-200/50";
  const balanceLabel =
    data.balance > 0
      ? `Owes you ${currency(data.balance)}`
      : data.balance < 0
        ? `You owe ${currency(-data.balance)}`
        : "All settled up";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <Link href="/dashboard" className="text-sm font-medium text-violet-600 hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-100">
          ← Back to Dashboard
        </Link>
        <h1 className="mt-2 flex items-center gap-3 text-2xl font-semibold text-violet-950 dark:text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-sm font-bold text-white">
            {data.party.charAt(0).toUpperCase()}
          </span>
          {data.party}&apos;s account
        </h1>
      </div>

      <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-[0_2px_24px_-6px_rgba(139,92,246,0.18)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
        <div className="text-xs font-semibold uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">
          Current balance
        </div>
        <div className={`mt-1 text-2xl font-semibold ${balanceColor}`}>{balanceLabel}</div>
      </div>

      <div className="rounded-3xl border border-violet-100 bg-white p-4 shadow-[0_2px_24px_-6px_rgba(139,92,246,0.12)] sm:p-5 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">
          Transaction history
        </h2>
        <div className="flex flex-col divide-y divide-violet-100 dark:divide-white/10">
          {data.ledger.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium text-violet-950 dark:text-white">
                  {e.description}
                </div>
                <div className="text-xs text-zinc-500 dark:text-violet-200/50">
                  {e.date} · {ENTRY_LABEL[e.party_role]}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div
                  className={`font-medium ${
                    e.delta >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {e.delta >= 0 ? "+" : "-"}£{Math.abs(e.delta).toFixed(2)}
                </div>
                <div className="text-xs text-zinc-500 dark:text-violet-200/50">balance {currency(e.balance)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
