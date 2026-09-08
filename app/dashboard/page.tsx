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

interface Summary {
  range: { from: string; to: string };
  totals: { income: number; expenses: number; net: number };
  monthly: { month: string; income: number; expenses: number; net: number }[];
  byCategory: { category: string; kind: string; total: number }[];
  loans: { party: string; youOweThem: number; theyOweYou: number; net: number }[];
  unconfirmedCount: number;
}

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

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categoryTab, setCategoryTab] = useState<"expense" | "income">("expense");
  const isDark = useIsDark();

  useEffect(() => {
    fetch("/api/summary")
      .then((r) => r.json())
      .then(setSummary);
  }, []);

  if (!summary) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center px-6 py-12 text-sm text-zinc-500">
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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {summary.range.from} to {summary.range.to} · confirmed transactions only
          </p>
        </div>
        <div className="flex items-center gap-3">
          {summary.unconfirmedCount > 0 && (
            <Link
              href="/review"
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
            >
              {summary.unconfirmedCount} transaction{summary.unconfirmedCount === 1 ? "" : "s"} still
              need review
            </Link>
          )}
          <a
            href={`/api/export?from=${summary.range.from}&to=${summary.range.to}`}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Download report (.xlsx)
          </a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Income" value={summary.totals.income} color={incomeColor} />
        <StatTile label="Expenses" value={summary.totals.expenses} color={expenseColor} />
        <StatTile
          label="Net"
          value={summary.totals.net}
          color={summary.totals.net >= 0 ? (isDark ? DELTA.good.dark : DELTA.good.light) : (isDark ? DELTA.bad.dark : DELTA.bad.light)}
        />
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
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
                  background: isDark ? "#1a1a19" : "#fcfcfb",
                  border: `1px solid ${grid}`,
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

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            By category
          </h2>
          <div className="flex gap-1">
            {(["expense", "income"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setCategoryTab(tab)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  categoryTab === tab
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                    : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
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
                  background: isDark ? "#1a1a19" : "#fcfcfb",
                  border: `1px solid ${grid}`,
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
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Loans &amp; IOUs
          </h2>
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="pb-2 font-medium">Person</th>
                <th className="pb-2 font-medium text-right">You owe them</th>
                <th className="pb-2 font-medium text-right">They owe you</th>
                <th className="pb-2 font-medium text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {summary.loans.map((l) => (
                <tr key={l.party} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="py-2 font-medium text-zinc-900 dark:text-zinc-50">{l.party}</td>
                  <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">
                    {currency(l.youOweThem)}
                  </td>
                  <td className="py-2 text-right text-zinc-600 dark:text-zinc-400">
                    {currency(l.theyOweYou)}
                  </td>
                  <td
                    className="py-2 text-right font-medium"
                    style={{ color: l.net >= 0 ? (isDark ? DELTA.good.dark : DELTA.good.light) : (isDark ? DELTA.bad.dark : DELTA.bad.light) }}
                  >
                    {l.net >= 0 ? `${l.party} owes you ${currency(l.net)}` : `You owe ${l.party} ${currency(-l.net)}`}
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

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-sm font-medium text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold" style={{ color }}>
        {currency(value)}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <p className="py-10 text-center text-sm text-zinc-500">
      No confirmed transactions in this period yet.
    </p>
  );
}
