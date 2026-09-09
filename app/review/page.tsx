"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Category, CategoryKind, PartyKind, PartyRole } from "@/lib/types";

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
  party_kind: PartyKind;
  confirmed: number;
}

type Filter = "unconfirmed" | "confirmed" | "all";

// The 5 underlying party_role values collapse into 4 relationships in the
// UI: whether a given transaction is a loan/transfer or a repayment is
// already implied by its amount's sign (money out vs. money in), so
// there's no need to ask for that separately. "Money lent" and "My own
// account" share the exact same lent_to/repaid_by pair and sign logic —
// the only difference is party_kind, i.e. whether `party` names another
// person or one of your own accounts (so uploading both sides of a
// transfer between two of your accounts never inflates income/expenses).
type MoneyRelationship = "owner" | "owed_to_me" | "owed_by_me" | "own_account";

function relationshipOf(role: PartyRole, kind: PartyKind): MoneyRelationship {
  if (role === "owner") return "owner";
  if (kind === "account") return "own_account";
  if (role === "lent_to" || role === "repaid_by") return "owed_to_me";
  return "owed_by_me"; // borrowed_from or repaid_to
}

function roleForRelationship(relationship: MoneyRelationship, amount: number): PartyRole {
  if (relationship === "owner") return "owner";
  if (relationship === "owed_to_me" || relationship === "own_account") return amount < 0 ? "lent_to" : "repaid_by";
  return amount > 0 ? "borrowed_from" : "repaid_to";
}

function kindForRelationship(relationship: MoneyRelationship): PartyKind {
  return relationship === "own_account" ? "account" : "person";
}

export default function ReviewPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [filter, setFilter] = useState<Filter>("unconfirmed");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("");
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [knownPeople, setKnownPeople] = useState<string[]>([]);
  const [knownAccounts, setKnownAccounts] = useState<string[]>([]);

  const loadCategories = useCallback(async () => {
    const res = await fetch("/api/categories");
    const data = await res.json();
    setCategories(data.categories);
  }, []);

  const loadPeople = useCallback(async () => {
    const res = await fetch("/api/people");
    const data = await res.json();
    setKnownPeople(data.people);
  }, []);

  const loadAccounts = useCallback(async () => {
    const res = await fetch("/api/people?kind=account");
    const data = await res.json();
    setKnownAccounts(data.people);
  }, []);

  const addKnownPerson = useCallback((name: string) => {
    setKnownPeople((prev) =>
      prev.some((p) => p.toLowerCase() === name.toLowerCase()) ? prev : [...prev, name].sort((a, b) => a.localeCompare(b))
    );
  }, []);

  const addKnownAccount = useCallback((name: string) => {
    setKnownAccounts((prev) =>
      prev.some((p) => p.toLowerCase() === name.toLowerCase()) ? prev : [...prev, name].sort((a, b) => a.localeCompare(b))
    );
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
    Promise.resolve().then(() => loadPeople());
  }, [loadPeople]);

  useEffect(() => {
    Promise.resolve().then(() => loadAccounts());
  }, [loadAccounts]);

  useEffect(() => {
    Promise.resolve().then(() => loadTransactions());
  }, [loadTransactions]);

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
          <h1 className="text-2xl font-semibold text-violet-950 dark:text-white">
            Review transactions
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-violet-200/60">
            Set a category and confirm whose money it was for each transaction.
          </p>
        </div>
        <input
          type="text"
          placeholder="Search description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-violet-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-white/10 dark:bg-zinc-950 dark:focus:ring-violet-500/30 sm:w-64"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["unconfirmed", "confirmed", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              filter === f
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-sm shadow-violet-300/50 dark:shadow-none"
                : "bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-white/10 dark:text-violet-200 dark:hover:bg-white/20"
            }`}
          >
            {f === "unconfirmed" ? "Needs review" : f === "confirmed" ? "Confirmed" : "All"}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-4">
          <button
            onClick={() => setAddFormOpen((v) => !v)}
            className="text-sm font-medium text-violet-600 hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-100"
          >
            {addFormOpen ? "Cancel" : "+ Add transaction"}
          </button>
          <Link
            href="/categories"
            className="text-sm font-medium text-violet-600 hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-100"
          >
            Manage categories
          </Link>
        </div>
      </div>

      {addFormOpen && (
        <AddTransactionForm
          categories={categories}
          onAddCategory={addCategory}
          knownPeople={knownPeople}
          onNewPerson={addKnownPerson}
          knownAccounts={knownAccounts}
          onNewAccount={addKnownAccount}
          onCreated={() => {
            loadTransactions();
          }}
        />
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 p-3 text-sm dark:border-white/10 dark:bg-white/5">
          <span className="font-medium text-violet-950 dark:text-white">{selected.size} selected</span>
          <select
            value={bulkCategoryId}
            onChange={(e) => {
              setBulkCategoryId(e.target.value);
              if (e.target.value) bulkAction({ category_id: Number(e.target.value) });
            }}
            className="rounded-lg border border-violet-200 px-2 py-1 dark:border-white/10 dark:bg-zinc-950"
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
            className="rounded-full bg-green-600 px-3 py-1 font-medium text-white hover:bg-green-700"
          >
            Confirm selected
          </button>
        </div>
      )}

      {!loading && transactions.length > 1 && (
        <label className="flex items-center gap-2 text-sm text-zinc-600 md:hidden dark:text-violet-200/60">
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
            knownPeople={knownPeople}
            onNewPerson={addKnownPerson}
            knownAccounts={knownAccounts}
            onNewAccount={addKnownAccount}
            canConfirm={canConfirm(t)}
          />
        ))}
        {!loading && transactions.length === 0 && (
          <div className="rounded-2xl border border-violet-100 px-4 py-10 text-center text-sm text-zinc-500 dark:border-white/10 dark:text-violet-200/50">
            {filter === "unconfirmed"
              ? "Nothing left to review. Nice work!"
              : "No transactions found."}
          </div>
        )}
        {loading && (
          <div className="rounded-2xl border border-violet-100 px-4 py-10 text-center text-sm text-zinc-500 dark:border-white/10 dark:text-violet-200/50">
            Loading…
          </div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-violet-100 bg-white shadow-[0_2px_24px_-6px_rgba(139,92,246,0.12)] md:block dark:border-white/10 dark:bg-white/5 dark:shadow-none">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-violet-50/70 text-left text-zinc-600 dark:bg-white/5 dark:text-violet-200/60">
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
                knownPeople={knownPeople}
                onNewPerson={addKnownPerson}
                knownAccounts={knownAccounts}
                onNewAccount={addKnownAccount}
                canConfirm={canConfirm(t)}
              />
            ))}
          </tbody>
        </table>
        {!loading && transactions.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-violet-200/50">
            {filter === "unconfirmed"
              ? "Nothing left to review. Nice work!"
              : "No transactions found."}
          </div>
        )}
        {loading && <div className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-violet-200/50">Loading…</div>}
      </div>
    </main>
  );
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function AddTransactionForm({
  categories,
  onAddCategory,
  knownPeople,
  onNewPerson,
  knownAccounts,
  onNewAccount,
  onCreated,
}: {
  categories: Category[];
  onAddCategory: (name: string, kind: CategoryKind) => Promise<Category | null>;
  knownPeople: string[];
  onNewPerson: (name: string) => void;
  knownAccounts: string[];
  onNewAccount: (name: string) => void;
  onCreated: () => void;
}) {
  const [draft, setDraft] = useState<TxRow>({
    id: 0,
    date: todayIso(),
    description: "",
    amount: -1, // sign only, used by CategoryPicker's default-kind guess
    category_id: null,
    category_name: null,
    category_kind: null,
    party: "Me",
    party_role: "owner",
    party_kind: "person",
    confirmed: 0,
  });
  const [amountText, setAmountText] = useState("");
  const [confirmNow, setConfirmNow] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function patchDraft(patch: Partial<TxRow>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function setDirection(amount: number) {
    setDraft((d) => ({
      ...d,
      amount,
      // Keep the stored role consistent if a relationship is already picked
      // — flipping Out/In after choosing "Money lent" should still mean
      // "Money lent", just now expressed as a repayment instead of a loan.
      party_role: roleForRelationship(relationshipOf(d.party_role, d.party_kind), amount),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const magnitude = parseFloat(amountText);
    if (!draft.date) {
      setError("Date is required");
      return;
    }
    if (!draft.description.trim()) {
      setError("Description is required");
      return;
    }
    if (!Number.isFinite(magnitude) || magnitude <= 0) {
      setError("Enter an amount greater than 0");
      return;
    }
    if (draft.party_role !== "owner" && !draft.party.trim()) {
      setError(
        draft.party_kind === "account"
          ? "An account name is required for this whose-money option"
          : "Person's name is required for this whose-money option"
      );
      return;
    }

    const amount = draft.amount < 0 ? -Math.abs(magnitude) : Math.abs(magnitude);

    setSaving(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: draft.date,
        description: draft.description.trim(),
        amount,
        category_id: draft.category_id,
        party: draft.party,
        party_role: draft.party_role,
        party_kind: draft.party_kind,
        confirmed: confirmNow,
      }),
    });
    setSaving(false);

    if (res.ok) {
      onCreated();
      // Reset for adding another, but keep the date/direction — the common
      // case is entering several transactions from the same day in a row.
      setDraft((d) => ({
        ...d,
        description: "",
        category_id: null,
        party_role: "owner",
        party_kind: "person",
        party: "Me",
      }));
      setAmountText("");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not add transaction");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-3xl border border-violet-100 bg-white p-4 shadow-[0_2px_24px_-6px_rgba(139,92,246,0.15)] dark:border-white/10 dark:bg-white/5 dark:shadow-none"
    >
      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">Date</label>
          <input
            type="date"
            value={draft.date}
            onChange={(e) => patchDraft({ date: e.target.value })}
            className="rounded-xl border border-violet-200 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">
            Description
          </label>
          <input
            type="text"
            placeholder="e.g. Tesco, Rent, Dinner with Sam"
            value={draft.description}
            onChange={(e) => patchDraft({ description: e.target.value })}
            className="rounded-xl border border-violet-200 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">Amount</label>
          <div className="flex gap-2">
            <div className="flex overflow-hidden rounded-xl border border-violet-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setDirection(-1)}
                className={`px-3 py-1.5 text-sm font-medium ${
                  draft.amount < 0
                    ? "bg-red-600 text-white"
                    : "bg-white text-zinc-600 dark:bg-zinc-900 dark:text-violet-200/60"
                }`}
              >
                − Out
              </button>
              <button
                type="button"
                onClick={() => setDirection(1)}
                className={`px-3 py-1.5 text-sm font-medium ${
                  draft.amount > 0
                    ? "bg-green-600 text-white"
                    : "bg-white text-zinc-600 dark:bg-zinc-900 dark:text-violet-200/60"
                }`}
              >
                + In
              </button>
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              className="w-full rounded-xl border border-violet-200 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-zinc-900"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">
            Category
          </label>
          <CategoryPicker t={draft} categories={categories} onPatch={patchDraft} onAddCategory={onAddCategory} />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-xs font-medium uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">
            Whose money
          </label>
          <WhoseMoneyPicker
            t={draft}
            categories={categories}
            onPatch={patchDraft}
            onAddCategory={onAddCategory}
            knownPeople={knownPeople}
            onNewPerson={onNewPerson}
            knownAccounts={knownAccounts}
            onNewAccount={onNewAccount}
          />
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-violet-200/60">
          <input
            type="checkbox"
            checked={confirmNow}
            onChange={(e) => setConfirmNow(e.target.checked)}
          />
          Confirm immediately (counts toward totals right away)
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-violet-300/50 hover:from-violet-500 hover:to-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-none"
        >
          {saving ? "Adding…" : "Add transaction"}
        </button>
      </div>
    </form>
  );
}

interface PickerProps {
  t: TxRow;
  categories: Category[];
  onPatch: (patch: Partial<TxRow>) => void;
  onAddCategory: (name: string, kind: CategoryKind) => Promise<Category | null>;
  knownPeople: string[];
  onNewPerson: (name: string) => void;
  knownAccounts: string[];
  onNewAccount: (name: string) => void;
}

function CategoryPicker({
  t,
  categories,
  onPatch,
  onAddCategory,
}: Pick<PickerProps, "t" | "categories" | "onPatch" | "onAddCategory">) {
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
          className="rounded-lg border border-violet-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-zinc-950"
        />
        <div className="flex items-center gap-1">
          <select
            value={newCatKind}
            onChange={(e) => setNewCatKind(e.target.value as CategoryKind)}
            className="rounded-lg border border-violet-200 bg-white px-1 py-0.5 text-xs dark:border-white/10 dark:bg-zinc-950"
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="loan">Loan</option>
          </select>
          <button
            onClick={confirmNewCategory}
            disabled={!newCatName.trim() || savingCategory}
            className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-2 py-0.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {savingCategory ? "Adding…" : "Add"}
          </button>
          <button
            onClick={cancelNewCategory}
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:text-violet-200/50 dark:hover:text-violet-100"
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
      className="w-full rounded-lg border border-violet-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-zinc-950 md:w-40"
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

function WhoseMoneyPicker({ t, onPatch, knownPeople, onNewPerson, knownAccounts, onNewAccount }: PickerProps) {
  const relationship = relationshipOf(t.party_role, t.party_kind);
  const isAccount = relationship === "own_account";

  return (
    <div className="flex flex-col gap-1">
      <select
        value={relationship}
        onChange={(e) => {
          const rel = e.target.value as MoneyRelationship;
          const role = roleForRelationship(rel, t.amount);
          const kind = kindForRelationship(rel);
          const kindChanged = kind !== t.party_kind;
          onPatch({
            party_role: role,
            party_kind: kind,
            party: rel === "owner" ? "Me" : kindChanged || t.party === "Me" ? "" : t.party,
          });
        }}
        className="w-full rounded-lg border border-violet-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-zinc-950 md:w-48"
      >
        <option value="owner">My own money</option>
        <option value="owed_to_me">Money lent</option>
        <option value="owed_by_me">Money borrowed</option>
        <option value="own_account">My own account</option>
      </select>
      {relationship !== "owner" && (
        <PersonPicker
          value={t.party === "Me" ? "" : t.party}
          onCommit={(name) => onPatch({ party: name })}
          knownNames={isAccount ? knownAccounts : knownPeople}
          onNewName={isAccount ? onNewAccount : onNewPerson}
          otherKindNames={isAccount ? knownPeople : knownAccounts}
          entityNoun={isAccount ? "account" : "person"}
          placeholder={isAccount ? "Account name (e.g. Savings)" : "Person's name"}
        />
      )}
    </div>
  );
}

// Typeahead for the person/account name field: suggests existing entries
// of the same kind as the user types, and requires an explicit confirm
// before a name that doesn't match any of them is treated as brand-new.
// Also guards against naming collisions across kinds — e.g. typing
// "Jordan" while picking "My own account" when "Jordan" already exists as
// a person would otherwise silently mix a personal IOU and an account
// transfer under the same ledger.
function PersonPicker({
  value,
  onCommit,
  knownNames,
  onNewName,
  otherKindNames,
  entityNoun,
  placeholder,
}: {
  value: string;
  onCommit: (name: string) => void;
  knownNames: string[];
  onNewName: (name: string) => void;
  otherKindNames: string[];
  entityNoun: "person" | "account";
  placeholder: string;
}) {
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [pendingNew, setPendingNew] = useState(false);
  const [collision, setCollision] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => setText(value));
  }, [value]);

  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return knownNames;
    return knownNames.filter((p) => p.toLowerCase().includes(q));
  }, [text, knownNames]);

  function selectExisting(name: string) {
    setText(name);
    setOpen(false);
    setPendingNew(false);
    setCollision(null);
    onCommit(name);
  }

  function handleBlur() {
    setOpen(false);
    const trimmed = text.trim();
    if (!trimmed) {
      onCommit("");
      setPendingNew(false);
      setCollision(null);
      return;
    }
    const exact = knownNames.find((p) => p.toLowerCase() === trimmed.toLowerCase());
    if (exact) {
      setText(exact);
      onCommit(exact);
      setPendingNew(false);
      setCollision(null);
      return;
    }
    const otherExact = otherKindNames.find((p) => p.toLowerCase() === trimmed.toLowerCase());
    if (otherExact) {
      setCollision(otherExact);
      setPendingNew(false);
      return;
    }
    setCollision(null);
    if (trimmed !== value) setPendingNew(true);
  }

  function confirmNew() {
    const trimmed = text.trim();
    onNewName(trimmed);
    onCommit(trimmed);
    setPendingNew(false);
  }

  function cancelNew() {
    setText(value);
    setPendingNew(false);
  }

  function dismissCollision() {
    setText(value);
    setCollision(null);
  }

  return (
    <div className="relative w-full md:w-48">
      <input
        type="text"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setPendingNew(false);
          setCollision(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        className="w-full rounded-lg border border-violet-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-zinc-950"
      />
      {open && matches.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-xl border border-violet-100 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-900">
          {matches.map((p) => (
            <button
              key={p}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectExisting(p)}
              className="block w-full px-2 py-1 text-left text-sm hover:bg-violet-50 dark:hover:bg-white/10"
            >
              {p}
            </button>
          ))}
        </div>
      )}
      {pendingNew && (
        <div className="mt-1 flex flex-col gap-1 rounded-xl border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <span>
            No existing {entityNoun} called &quot;{text.trim()}&quot;.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={confirmNew}
              className="rounded-full bg-amber-600 px-2 py-0.5 font-medium text-white hover:bg-amber-700"
            >
              {entityNoun === "account" ? "Create new account" : "Add this person"}
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={cancelNew}
              className="text-amber-800 underline underline-offset-2 hover:text-amber-950 dark:text-amber-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {collision && (
        <div className="mt-1 flex flex-col gap-1 rounded-xl border border-red-300 bg-red-50 p-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <span>
            &quot;{collision}&quot; is already used as {entityNoun === "account" ? "a person" : "an account"}. Pick a
            different name.
          </span>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={dismissCollision}
            className="self-start text-red-800 underline underline-offset-2 hover:text-red-950 dark:text-red-300"
          >
            OK
          </button>
        </div>
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

function RowDesktop({
  t,
  categories,
  selected,
  onToggleSelect,
  onPatch,
  onConfirm,
  onAddCategory,
  knownPeople,
  onNewPerson,
  knownAccounts,
  onNewAccount,
  canConfirm,
}: RowProps) {
  const isExpense = t.amount < 0;

  return (
    <tr className="border-t border-violet-100 align-top dark:border-white/10">
      <td className="px-3 py-2">
        <input type="checkbox" checked={selected} onChange={onToggleSelect} />
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-zinc-500 dark:text-violet-200/50">{t.date}</td>
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
        <WhoseMoneyPicker
          t={t}
          categories={categories}
          onPatch={onPatch}
          onAddCategory={onAddCategory}
          knownPeople={knownPeople}
          onNewPerson={onNewPerson}
          knownAccounts={knownAccounts}
          onNewAccount={onNewAccount}
        />
      </td>
      <td className="px-3 py-2">
        {t.confirmed ? (
          <span className="text-xs font-medium text-green-600 dark:text-green-400">Confirmed</span>
        ) : (
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            Confirm
          </button>
        )}
      </td>
    </tr>
  );
}

function RowCard({
  t,
  categories,
  selected,
  onToggleSelect,
  onPatch,
  onConfirm,
  onAddCategory,
  knownPeople,
  onNewPerson,
  knownAccounts,
  onNewAccount,
  canConfirm,
}: RowProps) {
  const isExpense = t.amount < 0;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-violet-100 bg-white p-3 shadow-[0_2px_16px_-6px_rgba(139,92,246,0.12)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
      <div className="flex items-start gap-2">
        <input type="checkbox" checked={selected} onChange={onToggleSelect} className="mt-1" />
        <div className="flex flex-1 items-start justify-between gap-2">
          <div>
            <div className="font-medium text-violet-950 dark:text-white">{t.description}</div>
            <div className="text-xs text-zinc-500 dark:text-violet-200/50">{t.date}</div>
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
        <span className="text-xs font-medium uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">Category</span>
        <CategoryPicker t={t} categories={categories} onPatch={onPatch} onAddCategory={onAddCategory} />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">Whose money</span>
        <WhoseMoneyPicker
          t={t}
          categories={categories}
          onPatch={onPatch}
          onAddCategory={onAddCategory}
          knownPeople={knownPeople}
          onNewPerson={onNewPerson}
          knownAccounts={knownAccounts}
          onNewAccount={onNewAccount}
        />
      </div>

      <div>
        {t.confirmed ? (
          <span className="text-xs font-medium text-green-600 dark:text-green-400">Confirmed</span>
        ) : (
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className="w-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            Confirm
          </button>
        )}
      </div>
    </div>
  );
}
