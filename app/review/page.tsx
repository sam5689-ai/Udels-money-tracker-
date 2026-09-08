"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Category, CategoryKind, PartyRole, PARTY_ROLE_LABELS } from "@/lib/types";

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

  const addCategory = useCallback(
    async (name: string, kind: CategoryKind): Promise<Category | null> => {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind }),
      });
      if (res.ok) {
        const data = await res.json();
        loadCategories();
        return data.category;
      }
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Could not create category");
      return null;
    },
    [loadCategories]
  );

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
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
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
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950 sm:w-64"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
          <Link
            href="/categories"
            className="text-sm font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Manage categories
          </Link>
        </div>
      </div>

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

      {!loading && transactions.length > 1 && (
        <label className="flex items-center gap-2 text-sm text-zinc-600 md:hidden dark:text-zinc-400">
          <input
            type="checkbox"
            checked={selected.size > 0 && selected.size === transactions.length}
            onChange={toggleSelectAll}
          />
          Select all
        </label>
      )}

      {/* Mobile: card list */}
      <div className="flex flex-col gap-3 md:hidden">
        {transactions.map((t) => (
          <RowCard
            key={t.id}
            t={t}
            categories={categories}
            selected={selected.has(t.id)}
            onToggleSelect={() => toggleSelect(t.id)}
            onPatch={(patch) => patchTransaction(t.id, patch)}
            onConfirm={() => confirmRow(t)}
            onAddCategory={addCategory}
            canConfirm={canConfirm(t)}
          />
        ))}
        {!loading && transactions.length === 0 && (
          <div className="rounded-lg border border-zinc-200 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800">
            {filter === "unconfirmed"
              ? "Nothing left to review. Nice work!"
              : "No transactions found."}
          </div>
        )}
        {loading && (
          <div className="rounded-lg border border-zinc-200 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800">
            Loading…
          </div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto rounded-lg border border-zinc-200 md:block dark:border-zinc-800">
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
              <RowDesktop
                key={t.id}
                t={t}
                categories={categories}
                selected={selected.has(t.id)}
                onToggleSelect={() => toggleSelect(t.id)}
                onPatch={(patch) => patchTransaction(t.id, patch)}
                onConfirm={() => confirmRow(t)}
                onAddCategory={addCategory}
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

interface PickerProps {
  t: TxRow;
  categories: Category[];
  onPatch: (patch: Partial<TxRow>) => void;
  onAddCategory: (name: string, kind: CategoryKind) => Promise<Category | null>;
}

function CategoryPicker({ t, categories, onPatch, onAddCategory }: PickerProps) {
  const isExpense = t.amount < 0;
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatKind, setNewCatKind] = useState<CategoryKind>(isExpense ? "expense" : "income");
  const [savingCategory, setSavingCategory] = useState(false);

  async function confirmNewCategory() {
    const name = newCatName.trim();
    if (!name) return;
    setSavingCategory(true);
    const category = await onAddCategory(name, newCatKind);
    setSavingCategory(false);
    if (category) {
      onPatch({ category_id: category.id });
      setAddingCategory(false);
      setNewCatName("");
    }
  }

  function cancelNewCategory() {
    setAddingCategory(false);
    setNewCatName("");
  }

  if (addingCategory) {
    return (
      <div className="flex w-full flex-col gap-1 sm:w-44">
        <input
          autoFocus
          type="text"
          placeholder="New category name"
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirmNewCategory();
            } else if (e.key === "Escape") {
              cancelNewCategory();
            }
          }}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <div className="flex items-center gap-1">
          <select
            value={newCatKind}
            onChange={(e) => setNewCatKind(e.target.value as CategoryKind)}
            className="rounded-md border border-zinc-300 bg-white px-1 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="loan">Loan</option>
          </select>
          <button
            onClick={confirmNewCategory}
            disabled={!newCatName.trim() || savingCategory}
            className="rounded-md bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black"
          >
            {savingCategory ? "Adding…" : "Add"}
          </button>
          <button
            onClick={cancelNewCategory}
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <select
      value={t.category_id ?? ""}
      onChange={(e) => {
        if (e.target.value === "__new__") {
          setAddingCategory(true);
          return;
        }
        onPatch({ category_id: e.target.value ? Number(e.target.value) : null });
      }}
      className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950 md:w-40"
    >
      <option value="">Select…</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
      <option value="__new__">+ Add new category…</option>
    </select>
  );
}

function WhoseMoneyPicker({ t, onPatch }: PickerProps) {
  return (
    <div className="flex flex-col gap-1">
      <select
        value={t.party_role}
        onChange={(e) => {
          const role = e.target.value as PartyRole;
          onPatch({ party_role: role, party: role === "owner" ? "Me" : t.party === "Me" ? "" : t.party });
        }}
        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950 md:w-48"
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
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950 md:w-48"
        />
      )}
    </div>
  );
}

interface RowProps extends PickerProps {
  selected: boolean;
  onToggleSelect: () => void;
  onConfirm: () => void;
  canConfirm: boolean;
}

function RowDesktop({ t, categories, selected, onToggleSelect, onPatch, onConfirm, onAddCategory, canConfirm }: RowProps) {
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
        <CategoryPicker t={t} categories={categories} onPatch={onPatch} onAddCategory={onAddCategory} />
      </td>
      <td className="px-3 py-2">
        <WhoseMoneyPicker t={t} categories={categories} onPatch={onPatch} onAddCategory={onAddCategory} />
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

function RowCard({ t, categories, selected, onToggleSelect, onPatch, onConfirm, onAddCategory, canConfirm }: RowProps) {
  const isExpense = t.amount < 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start gap-2">
        <input type="checkbox" checked={selected} onChange={onToggleSelect} className="mt-1" />
        <div className="flex flex-1 items-start justify-between gap-2">
          <div>
            <div className="font-medium text-zinc-900 dark:text-zinc-50">{t.description}</div>
            <div className="text-xs text-zinc-500">{t.date}</div>
          </div>
          <div
            className={`whitespace-nowrap font-semibold ${
              isExpense ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
            }`}
          >
            {isExpense ? "-" : "+"}£{Math.abs(t.amount).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Category</span>
        <CategoryPicker t={t} categories={categories} onPatch={onPatch} onAddCategory={onAddCategory} />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Whose money</span>
        <WhoseMoneyPicker t={t} categories={categories} onPatch={onPatch} onAddCategory={onAddCategory} />
      </div>

      <div>
        {t.confirmed ? (
          <span className="text-xs font-medium text-green-600 dark:text-green-400">Confirmed</span>
        ) : (
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-30 dark:bg-white dark:text-black"
          >
            Confirm
          </button>
        )}
      </div>
    </div>
  );
}
