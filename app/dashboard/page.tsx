"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { useIsDark } from "@/app/hooks/useIsDark";
import { CATEGORICAL, DIVERGING, INK, DELTA, stableIndex } from "@/lib/palette";

interface BucketTransaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string | null;
}

interface Bucket {
  total: number;
  transactions: BucketTransaction[];
}

interface Summary {
  range: { from: string; to: string };
  totals: { income: number; expenses: number; net: number };
  buckets: {
    spending: Bucket;
    lentOut: Bucket;
    ownAccounts: Bucket;
    everythingElse: Bucket;
  };
  monthly: { month: string; income: number; expenses: number; net: number }[];
  byCategory: { category: string; kind: string; total: number }[];
  loans: { party: string; youOweThem: number; theyOweYou: number; net: number }[];
  accounts: { party: string; movedOut: number; movedBack: number }[];
  unconfirmedCount: number;
}

type BucketKey = "spending" | "lentOut" | "ownAccounts" | "everythingElse";

function currency(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}£${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

const BUCKET_ICONS: Record<BucketKey, React.ReactNode> = {
  spending: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path strokeLinecap="round" d="M3 10h18" />
      <circle cx="16" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  lentOut: <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M7 7h10v10" />,
  ownAccounts: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="12" cy="12" r="3" />
      <path strokeLinecap="round" d="M12 9v1M12 14v1M9 12h1M14 12h1" />
    </>
  ),
  everythingElse: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categoryTab, setCategoryTab] = useState<"expense" | "income">("expense");
  const [expandedBucket, setExpandedBucket] = useState<BucketKey | null>(null);
  const isDark = useIsDark();

  useEffect(() => {
    fetch("/api/summary")
      .then((r) => r.json())
      .then(setSummary);
  }, []);

  if (!summary) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center px-4 py-12 text-sm text-zinc-500 dark:text-violet-200/50 sm:px-6">
        Loading…
      </main>
    );
  }

  const ink = isDark ? INK.primary.dark : INK.primary.light;
  const secondaryInk = isDark ? INK.secondary.dark : INK.secondary.light;
  const grid = isDark ? INK.gridline.dark : INK.gridline.light;
  const incomeColor = isDark ? DIVERGING.income.dark : DIVERGING.income.light;
  const expenseColor = isDark ? DIVERGING.expense.dark : DIVERGING.expense.light;

  const categories = summary.byCategory
    .filter((c) => c.kind === categoryTab)
    .sort((a, b) => b.total - a.total);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-violet-950 dark:text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-violet-200/60">
            {summary.range.from} to {summary.range.to} · confirmed transactions only
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {summary.unconfirmedCount > 0 && (
            <Link
              href="/review"
              className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-center text-sm text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
            >
              {summary.unconfirmedCount} transaction{summary.unconfirmedCount === 1 ? "" : "s"} still
              need review
            </Link>
          )}
          <a
            href={`/api/export?from=${summary.range.from}&to=${summary.range.to}`}
            className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-1.5 text-center text-sm font-medium text-white shadow-sm shadow-violet-300/50 hover:from-violet-500 hover:to-fuchsia-400 dark:shadow-none"
          >
            Download report (.xlsx)
          </a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BucketTile
          bucketKey="spending"
          label="My spending"
          hint="Your own expenses — no one else involved"
          value={summary.buckets.spending.total}
          color={expenseColor}
          active={expandedBucket === "spending"}
          onClick={() => setExpandedBucket((k) => (k === "spending" ? null : "spending"))}
        />
        <BucketTile
          bucketKey="lentOut"
          label="Lent out"
          hint="Owed back to you"
          value={summary.buckets.lentOut.total}
          color={incomeColor}
          active={expandedBucket === "lentOut"}
          onClick={() => setExpandedBucket((k) => (k === "lentOut" ? null : "lentOut"))}
        />
        <BucketTile
          bucketKey="ownAccounts"
          label="My other accounts"
          hint="Moved to another account you own"
          value={summary.buckets.ownAccounts.total}
          color={isDark ? "#a78bfa" : "#7c3aed"}
          active={expandedBucket === "ownAccounts"}
          onClick={() => setExpandedBucket((k) => (k === "ownAccounts" ? null : "ownAccounts"))}
        />
        <BucketTile
          bucketKey="everythingElse"
          label="Everything else"
          hint="Income, borrowed money, repayments"
          value={summary.buckets.everythingElse.total}
          color={secondaryInk}
          active={expandedBucket === "everythingElse"}
          onClick={() => setExpandedBucket((k) => (k === "everythingElse" ? null : "everythingElse"))}
        />
      </div>

      {expandedBucket && (
        <BucketDetail
          label={
            expandedBucket === "spending"
              ? "My spending"
              : expandedBucket === "lentOut"
                ? "Lent out"
                : expandedBucket === "ownAccounts"
                  ? "My other accounts"
                  : "Everything else"
          }
          bucket={summary.buckets[expandedBucket]}
          onClose={() => setExpandedBucket(null)}
        />
      )}

      <section className="rounded-3xl border border-violet-100 bg-white p-4 shadow-[0_2px_24px_-6px_rgba(139,92,246,0.12)] sm:p-5 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">
          Income vs. expenses by month
        </h2>
        {summary.monthly.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={summary.monthly.map((m) => ({ ...m, label: monthLabel(m.month) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="label" stroke={secondaryInk} fontSize={12} tickLine={false} />
              <YAxis
                stroke={secondaryInk}
                fontSize={12}
                tickLine={false}
                tickFormatter={(v) => `£${v}`}
              />
              <Tooltip
                formatter={(value) => currency(Number(value))}
                contentStyle={{
                  background: isDark ? "#1a1229" : "#ffffff",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#ede9fe"}`,
                  borderRadius: 12,
                  color: ink,
                  fontSize: 13,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 13, color: secondaryInk }} />
              <Bar dataKey="income" name="Income" fill={incomeColor} radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill={expenseColor} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="rounded-3xl border border-violet-100 bg-white p-4 shadow-[0_2px_24px_-6px_rgba(139,92,246,0.12)] sm:p-5 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">
            By category
          </h2>
          <div className="flex gap-1">
            {(["expense", "income"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setCategoryTab(tab)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  categoryTab === tab
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white"
                    : "bg-violet-50 text-violet-700 dark:bg-white/10 dark:text-violet-200"
                }`}
              >
                {tab === "expense" ? "Expenses" : "Income"}
              </button>
            ))}
          </div>
        </div>
        {categories.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(120, categories.length * 40)}>
            <BarChart data={categories} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
              <XAxis type="number" stroke={secondaryInk} fontSize={12} tickFormatter={(v) => `£${v}`} />
              <YAxis
                type="category"
                dataKey="category"
                stroke={secondaryInk}
                fontSize={12}
                width={140}
                tickLine={false}
              />
              <Tooltip
                formatter={(value) => currency(Number(value))}
                contentStyle={{
                  background: isDark ? "#1a1229" : "#ffffff",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#ede9fe"}`,
                  borderRadius: 12,
                  color: ink,
                  fontSize: 13,
                }}
              />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {categories.map((c) => (
                  <Cell
                    key={c.category}
                    fill={CATEGORICAL[isDark ? "dark" : "light"][stableIndex(c.category, 8)]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {summary.loans.length > 0 && (
        <section className="rounded-3xl border border-violet-100 bg-white p-4 shadow-[0_2px_24px_-6px_rgba(139,92,246,0.12)] sm:p-5 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">
            Loans &amp; IOUs
          </h2>
          {/* Mobile: cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {summary.loans.map((l) => (
              <div
                key={l.party}
                className="rounded-2xl border border-violet-100 p-3 dark:border-white/10"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/people/${encodeURIComponent(l.party)}`}
                    className="font-medium text-violet-700 hover:text-violet-900 dark:text-violet-200 dark:hover:text-white"
                  >
                    {l.party}
                  </Link>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{
                      color: l.net >= 0 ? (isDark ? DELTA.good.dark : DELTA.good.light) : (isDark ? DELTA.bad.dark : DELTA.bad.light),
                      background: l.net >= 0 ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                    }}
                  >
                    {l.net >= 0 ? `Owes you ${currency(l.net)}` : `You owe ${currency(-l.net)}`}
                  </span>
                </div>
                <div className="mt-1 flex gap-4 text-xs text-zinc-500 dark:text-violet-200/50">
                  <span>You owe them: {currency(l.youOweThem)}</span>
                  <span>They owe you: {currency(l.theyOweYou)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <table className="hidden w-full text-sm md:table">
            <thead className="text-left text-zinc-500 dark:text-violet-200/50">
              <tr>
                <th className="pb-2 font-medium">Person</th>
                <th className="pb-2 font-medium text-right">You owe them</th>
                <th className="pb-2 font-medium text-right">They owe you</th>
                <th className="pb-2 font-medium text-right">Net</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {summary.loans.map((l) => (
                <tr key={l.party} className="border-t border-violet-100 dark:border-white/10">
                  <td className="py-2 font-medium text-violet-950 dark:text-white">
                    {l.party}
                  </td>
                  <td className="py-2 text-right text-zinc-600 dark:text-violet-200/60">
                    {currency(l.youOweThem)}
                  </td>
                  <td className="py-2 text-right text-zinc-600 dark:text-violet-200/60">
                    {currency(l.theyOweYou)}
                  </td>
                  <td
                    className="py-2 text-right font-medium"
                    style={{ color: l.net >= 0 ? (isDark ? DELTA.good.dark : DELTA.good.light) : (isDark ? DELTA.bad.dark : DELTA.bad.light) }}
                  >
                    {l.net >= 0 ? `${l.party} owes you ${currency(l.net)}` : `You owe ${l.party} ${currency(-l.net)}`}
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <Link
                      href={`/people/${encodeURIComponent(l.party)}`}
                      className="inline-block rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 dark:bg-white/10 dark:text-violet-200 dark:hover:bg-white/20"
                    >
                      View ledger →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {summary.accounts.length > 0 && (
        <section className="rounded-3xl border border-violet-100 bg-white p-4 shadow-[0_2px_24px_-6px_rgba(139,92,246,0.12)] sm:p-5 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">
            My accounts
          </h2>
          {/* Mobile: cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {summary.accounts.map((a) => (
              <div
                key={a.party}
                className="rounded-2xl border border-violet-100 p-3 dark:border-white/10"
              >
                <Link
                  href={`/people/${encodeURIComponent(a.party)}`}
                  className="font-medium text-violet-700 hover:text-violet-900 dark:text-violet-200 dark:hover:text-white"
                >
                  {a.party}
                </Link>
                <div className="mt-1 flex gap-4 text-xs text-zinc-500 dark:text-violet-200/50">
                  <span>Moved out: {currency(a.movedOut)}</span>
                  <span>Moved back: {currency(a.movedBack)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <table className="hidden w-full text-sm md:table">
            <thead className="text-left text-zinc-500 dark:text-violet-200/50">
              <tr>
                <th className="pb-2 font-medium">Account</th>
                <th className="pb-2 font-medium text-right">Moved out</th>
                <th className="pb-2 font-medium text-right">Moved back</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {summary.accounts.map((a) => (
                <tr key={a.party} className="border-t border-violet-100 dark:border-white/10">
                  <td className="py-2 font-medium text-violet-950 dark:text-white">{a.party}</td>
                  <td className="py-2 text-right text-zinc-600 dark:text-violet-200/60">
                    {currency(a.movedOut)}
                  </td>
                  <td className="py-2 text-right text-zinc-600 dark:text-violet-200/60">
                    {currency(a.movedBack)}
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <Link
                      href={`/people/${encodeURIComponent(a.party)}`}
                      className="inline-block rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 dark:bg-white/10 dark:text-violet-200 dark:hover:bg-white/20"
                    >
                      View ledger →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

function BucketTile({
  bucketKey,
  label,
  hint,
  value,
  color,
  active,
  onClick,
}: {
  bucketKey: BucketKey;
  label: string;
  hint: string;
  value: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-3xl border bg-white p-4 text-left transition-all sm:p-5 dark:bg-white/5 ${
        active
          ? "border-transparent shadow-[0_0_0_2px_#8b5cf6,0_8px_28px_-8px_rgba(139,92,246,0.4)]"
          : "border-violet-100 shadow-[0_2px_20px_-6px_rgba(139,92,246,0.12)] hover:border-violet-200 dark:border-white/10 dark:shadow-none dark:hover:border-white/20"
      }`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
          {BUCKET_ICONS[bucketKey]}
        </svg>
      </span>
      <div className="mt-3 text-sm font-medium text-zinc-500 dark:text-violet-200/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold" style={{ color }}>
        {currency(value)}
      </div>
      <div className="mt-1 text-xs text-zinc-500 dark:text-violet-200/50">{hint} · tap to see transactions</div>
    </button>
  );
}

function BucketDetail({
  label,
  bucket,
  onClose,
}: {
  label: string;
  bucket: Bucket;
  onClose: () => void;
}) {
  return (
    <section className="rounded-3xl border border-violet-100 bg-white p-4 shadow-[0_2px_24px_-6px_rgba(139,92,246,0.12)] sm:p-5 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">
          {label} — {bucket.transactions.length} transaction{bucket.transactions.length === 1 ? "" : "s"}
        </h2>
        <button
          onClick={onClose}
          className="text-xs font-medium text-violet-500 hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-100"
        >
          Close
        </button>
      </div>
      {bucket.transactions.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col divide-y divide-violet-100 dark:divide-white/10">
          {bucket.transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium text-violet-950 dark:text-white">
                  {t.description}
                </div>
                <div className="text-xs text-zinc-500 dark:text-violet-200/50">
                  {t.date}
                  {t.category ? ` · ${t.category}` : ""}
                </div>
              </div>
              <div
                className={`whitespace-nowrap font-medium ${
                  t.amount < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                }`}
              >
                {t.amount < 0 ? "-" : "+"}£{Math.abs(t.amount).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <p className="py-10 text-center text-sm text-zinc-500 dark:text-violet-200/50">
      No confirmed transactions in this period yet.
    </p>
  );
}
