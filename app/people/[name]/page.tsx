"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PartyKind, PartyRole } from "@/lib/types";

interface LedgerEntry {
  id: number;
  date: string;
  description: string;
  amount: number;
  party_role: PartyRole;
  delta: number;
  balance: number;
}

interface TaggedTx {
  id: number;
  date: string;
  description: string;
  amount: number;
}

interface AccountData {
  party: string;
  party_kind: PartyKind;
  balance: number;
  movedOut: number;
  movedBack: number;
  taggedTotal: number;
  taggedSpending: TaggedTx[];
  ledger: LedgerEntry[];
}

const ENTRY_LABEL: Record<PartyRole, string> = {
  owner: "",
  lent_to: "You lent",
  repaid_by: "They repaid you",
  borrowed_from: "You borrowed",
  repaid_to: "You repaid",
};

const ACCOUNT_ENTRY_LABEL: Partial<Record<PartyRole, string>> = {
  lent_to: "Moved out",
  repaid_by: "Moved back in",
};

function entryLabel(role: PartyRole, kind: PartyKind): string {
  if (kind === "account") return ACCOUNT_ENTRY_LABEL[role] ?? ENTRY_LABEL[role];
  return ENTRY_LABEL[role];
}

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

  const isAccount = data.party_kind === "account";

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
          {isAccount ? data.party : `${data.party}'s account`}
        </h1>
      </div>

      {isAccount ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-[0_2px_24px_-6px_rgba(139,92,246,0.18)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <div className="text-xs font-semibold uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">
              Moved out
            </div>
            <div className="mt-1 text-2xl font-semibold text-violet-950 dark:text-white">
              {currency(data.movedOut)}
            </div>
          </div>
          <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-[0_2px_24px_-6px_rgba(139,92,246,0.18)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <div className="text-xs font-semibold uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">
              Moved back
            </div>
            <div className="mt-1 text-2xl font-semibold text-violet-950 dark:text-white">
              {currency(data.movedBack)}
            </div>
          </div>
          <div className="col-span-2 rounded-3xl border border-violet-100 bg-white p-5 shadow-[0_2px_24px_-6px_rgba(139,92,246,0.18)] dark:border-white/10 dark:bg-white/5 dark:shadow-none sm:col-span-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">
              Tagged as spent
            </div>
            <div className="mt-1 text-2xl font-semibold text-violet-950 dark:text-white">
              {currency(data.taggedTotal)}
            </div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-violet-200/50">
              of {currency(data.movedBack)} moved back
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-[0_2px_24px_-6px_rgba(139,92,246,0.18)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <div className="text-xs font-semibold uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">
            Current balance
          </div>
          <div className={`mt-1 text-2xl font-semibold ${balanceColor}`}>{balanceLabel}</div>
        </div>
      )}

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
                  {e.date} · {entryLabel(e.party_role, data.party_kind)}
                </div>
              </div>
              <div className="shrink-0 text-right">
                {(() => {
                  // For an account, show real cash flow (money back in your
                  // reach = positive) rather than `delta`, which tracks the
                  // opposite thing — the "debt" framing used for people
                  // (lending money out is a "+" to what's owed to you).
                  const value = isAccount ? e.amount : e.delta;
                  return (
                    <div
                      className={`font-medium ${
                        value >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {value >= 0 ? "+" : "-"}£{Math.abs(value).toFixed(2)}
                    </div>
                  );
                })()}
                {!isAccount && (
                  <div className="text-xs text-zinc-500 dark:text-violet-200/50">balance {currency(e.balance)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {isAccount && data.taggedSpending.length > 0 && (
        <div className="rounded-3xl border border-violet-100 bg-white p-4 shadow-[0_2px_24px_-6px_rgba(139,92,246,0.12)] sm:p-5 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">
            Spending tagged as funded by {data.party}
          </h2>
          <p className="mb-3 text-xs text-zinc-500 dark:text-violet-200/50">
            Purchases you&apos;ve marked as coming out of money withdrawn from here, wherever they
            actually happened.
          </p>
          <div className="flex flex-col divide-y divide-violet-100 dark:divide-white/10">
            {data.taggedSpending.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-violet-950 dark:text-white">{t.description}</div>
                  <div className="text-xs text-zinc-500 dark:text-violet-200/50">{t.date}</div>
                </div>
                <div className="shrink-0 font-medium text-red-600 dark:text-red-400">
                  -£{Math.abs(t.amount).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
