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
        <Link href="/dashboard" className="text-sm font-medium text-zinc-600 underline underline-offset-2 dark:text-zinc-400">
          ← Back to Dashboard
        </Link>
        <p className="text-sm text-zinc-500">
          No transactions found for {decodeURIComponent(String(params.name))}.
        </p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-12 text-sm text-zinc-500 sm:px-6">
        Loading…
      </main>
    );
  }

  const balanceColor =
    data.balance > 0
      ? "text-green-600 dark:text-green-400"
      : data.balance < 0
        ? "text-red-600 dark:text-red-400"
        : "text-zinc-500";
  const balanceLabel =
    data.balance > 0
      ? `Owes you ${currency(data.balance)}`
      : data.balance < 0
        ? `You owe ${currency(-data.balance)}`
        : "All settled up";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <Link href="/dashboard" className="text-sm font-medium text-zinc-600 underline underline-offset-2 dark:text-zinc-400">
          ← Back to Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {data.party}&apos;s account
        </h1>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-sm font-medium text-zinc-500">Current balance</div>
        <div className={`mt-1 text-2xl font-semibold ${balanceColor}`}>{balanceLabel}</div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Transaction history
        </h2>
        <div className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
          {data.ledger.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                  {e.description}
                </div>
                <div className="text-xs text-zinc-500">
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
                <div className="text-xs text-zinc-500">balance {currency(e.balance)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
