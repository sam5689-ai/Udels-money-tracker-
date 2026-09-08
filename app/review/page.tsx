"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Category, PartyRole, PARTY_ROLE_LABELS } from "@/lib/types";

interface TxRow {
  id: number;
  date: string;
  description: string;
  amount: number;
  category_id: number | null;
  category_name: string | null;
  category_kind: "income" | "expense" | "loan" | null;
  party: string;
  party_role: PartyRole;
  confirmed: number;
}

type Filter = "unconfirmed" | "confirmed" | "all";

const ROLE_OPTIONS: PartyRole[] = ["owner", "borrowed_from", "lent_to", "repaid_to", "repaid_by"];

export default function ReviewPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [filter, setFilter] = useState<Filter>("unconfirmed");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryKind, setNewCategoryKind] = useState<"income" | "expense" | "loan">("expense");
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("");

  const loadCategories = useCallback(async () => {
    const res = await fetch("/api/categories");
    const data = await res.json();
    setCategories(data.categories);
  }, []);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter !== "all") params.set("confirmed", filter === "confirmed" ? "1" : "0");
    if (search) params.set("search", search);
    const res = await fetch(`/api/transactions?${params.toString()}`);
    const data = await res.json();
    setTransactions(data.transactions);
    setSelected(new Set());
    setLoading(false);
  }, [filter, search]);

  useEffect(() => {
    Promise.resolve().then(() => loadCategories());
  }, [loadCategories]);

  useEffect(() => {
    Promise.resolve().then(() => loadTransactions());
  }, [loadTransactions]);

  const knownParties = useMemo(() => {
    const s = new Set<string>();
    for (const t of transactions) {
      if (t.party && t.party !== "Me") s.add(t.party);
    }
    return Array.from(s);
  }, [transactions]);

  async function patchTransaction(id: number, patch: Partial<TxRow>) {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const res = await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...data.transaction } : t)));
    }
  }

  async function confirmRow(t: TxRow) {
    await patchTransaction(t.id, { confirmed: 1 } as Partial<TxRow>);
    if (filter === "unconfirmed") {
      setTransactions((prev) => prev.filter((x) => x.id !== t.id));
    }
  }

  async function createCategory() {
    if (!newCategoryName.trim()) return;
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName.trim(), kind: newCategoryKind }),
    });
    if (res.ok) {
      setNewCategoryName("");
      setNewCategoryOpen(false);
      loadCategories();
    } else {
      const data = await res.json();
      alert(data.error || "Could not create category");
    }
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === transactions.length ? new Set() : new Set(transactions.map((t) => t.id))));
  }

  async function bulkAction(patch: Record<string, unknown>) {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, patch }),
    });
    loadTransactions();
  }

  const canConfirm = (t: TxRow) =>
    t.category_id != null && (t.party_role === "owner" || t.party.trim().length > 0);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Review transactions
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Set a category and confirm whose money it was for each transaction.
          </p>
        </div>
        <input
          type="text"
          placeholder="Search description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>

      <div className="flex items-center gap-2">
        {(["unconfirmed", "confirmed", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              filter === f
                ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            {f === "unconfirmed" ? "Needs review" : f === "confirmed" ? "Confirmed" : "All"}
          </button>
        ))}
        <div className="ml-auto">
          <button
            onClick={() => setNewCategoryOpen((v) => !v)}
            className="text-sm font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            + New category
          </button>
        </div>
      </div>

      {newCategoryOpen && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
          <input
            type="text"
            placeholder="Category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <select
            value={newCategoryKind}
            onChange={(e) => setNewCategoryKind(e.target.value as typeof newCategoryKind)}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="loan">Loan</option>
          </select>
          <button
            onClick={createCategory}
            className="rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Add
          </button>
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-100 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          <span className="font-medium">{selected.size} selected</span>
          <select
            value={bulkCategoryId}
            onChange={(e) => {
              setBulkCategoryId(e.target.value);
              if (e.target.value) bulkAction({ category_id: Number(e.target.value) });
            }}
            className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">Set category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => bulkAction({ confirmed: true })}
            className="rounded-md bg-green-600 px-3 py-1 font-medium text-white hover:bg-green-700"
          >
            Confirm selected
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-zinc-100 text-left text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.size > 0 && selected.size === transactions.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium text-right">Amount</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Whose money</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <Row
                key={t.id}
                t={t}
                categories={categories}
                selected={selected.has(t.id)}
                onToggleSelect={() => toggleSelect(t.id)}
                onPatch={(patch) => patchTransaction(t.id, patch)}
                onConfirm={() => confirmRow(t)}
                canConfirm={canConfirm(t)}
              />
            ))}
          </tbody>
        </table>
        {!loading && transactions.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-zinc-500">
            {filter === "unconfirmed"
              ? "Nothing left to review. Nice work!"
              : "No transactions found."}
          </div>
        )}
        {loading && <div className="px-4 py-10 text-center text-sm text-zinc-500">Loading…</div>}
      </div>
      <datalist id="known-parties">
        {knownParties.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </main>
  );
}

function Row({
  t,
  categories,
  selected,
  onToggleSelect,
  onPatch,
  onConfirm,
  canConfirm,
}: {
  t: TxRow;
  categories: Category[];
  selected: boolean;
  onToggleSelect: () => void;
  onPatch: (patch: Partial<TxRow>) => void;
  onConfirm: () => void;
  canConfirm: boolean;
}) {
  const isExpense = t.amount < 0;

  return (
    <tr className="border-t border-zinc-200 align-top dark:border-zinc-800">
      <td className="px-3 py-2">
        <input type="checkbox" checked={selected} onChange={onToggleSelect} />
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-zinc-500">{t.date}</td>
      <td className="px-3 py-2">{t.description}</td>
      <td
        className={`whitespace-nowrap px-3 py-2 text-right font-medium ${
          isExpense ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
        }`}
      >
        {isExpense ? "-" : "+"}£{Math.abs(t.amount).toFixed(2)}
      </td>
      <td className="px-3 py-2">
        <select
          value={t.category_id ?? ""}
          onChange={(e) => onPatch({ category_id: e.target.value ? Number(e.target.value) : null })}
          className="w-40 rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="">Select…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          <select
            value={t.party_role}
            onChange={(e) => {
              const role = e.target.value as PartyRole;
              onPatch({ party_role: role, party: role === "owner" ? "Me" : t.party === "Me" ? "" : t.party });
            }}
            className="w-48 rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {PARTY_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          {t.party_role !== "owner" && (
            <input
              list="known-parties"
              type="text"
              placeholder="Person's name"
              value={t.party === "Me" ? "" : t.party}
              onChange={(e) => onPatch({ party: e.target.value })}
              className="w-48 rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
            />
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        {t.confirmed ? (
          <span className="text-xs font-medium text-green-600 dark:text-green-400">Confirmed</span>
        ) : (
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-30 dark:bg-white dark:text-black"
          >
            Confirm
          </button>
        )}
      </td>
    </tr>
  );
}
