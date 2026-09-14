"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Category, CategoryKind, PartyKind, PartyRole } from "@/lib/types";
import PersonPicker from "@/app/components/PersonPicker";

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
  account: string;
  funded_by: string;
  confirmed: number;
}

type Filter = "unconfirmed" | "confirmed" | "all";

// The 5 underlying party_role values collapse into 3 relationships in the
// UI. "owner" covers both directions — its label just switches between
// "Money spent" and "Money received" by amount sign. "loan" also covers
// both directions with a single person: money you send them counts as
// lent, money they send you counts as borrowed, purely from which way it
// moved — no need to separately judge whether a given transaction is a
// fresh loan or a repayment of an earlier one, since the running balance
// (loanTotals in lib/summary.ts) nets out correctly either way: every
// outflow adds to what they owe you and every inflow subtracts from it,
// regardless of which "leg" it actually was. "own_account" (Savings) is
// the same idea applied to one of your own accounts instead of another
// person, so uploading both sides of a transfer never inflates
// income/expenses.
type MoneyRelationship = "owner" | "loan" | "own_account";

function relationshipOf(role: PartyRole, kind: PartyKind): MoneyRelationship {
  if (role === "owner") return "owner";
  if (kind === "account") return "own_account";
  return "loan"; // lent_to, borrowed_from, repaid_to, or repaid_by
}

function roleForRelationship(relationship: MoneyRelationship, amount: number): PartyRole {
  if (relationship === "owner") return "owner";
  if (relationship === "own_account") return amount < 0 ? "lent_to" : "repaid_by";
  return amount < 0 ? "lent_to" : "borrowed_from";
}

function kindForRelationship(relationship: MoneyRelationship): PartyKind {
  return relationship === "own_account" ? "account" : "person";
}

export default function ReviewPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [filter, setFilter] = useState<Filter>("unconfirmed");
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("");
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [knownPeople, setKnownPeople] = useState<string[]>([]);
  const [knownAccounts, setKnownAccounts] = useState<string[]>([]);
  const [knownSavingsAccounts, setKnownSavingsAccounts] = useState<string[]>([]);

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

  const loadSavingsAccounts = useCallback(async () => {
    const res = await fetch("/api/people?kind=savings");
    const data = await res.json();
    setKnownSavingsAccounts(data.people);
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

  const addKnownSavingsAccount = useCallback((name: string) => {
    setKnownSavingsAccounts((prev) =>
      prev.some((p) => p.toLowerCase() === name.toLowerCase()) ? prev : [...prev, name].sort((a, b) => a.localeCompare(b))
    );
  }, []);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter !== "all") params.set("confirmed", filter === "confirmed" ? "1" : "0");
    if (search) params.set("search", search);
    if (accountFilter) params.set("account", accountFilter);
    const res = await fetch(`/api/transactions?${params.toString()}`);
    const data = await res.json();
    setTransactions(data.transactions);
    setSelected(new Set());
    setLoading(false);
  }, [filter, search, accountFilter]);

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
    Promise.resolve().then(() => loadSavingsAccounts());
  }, [loadSavingsAccounts]);

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

  // A category is only meaningful for your own spending/income — a loan,
  // repayment, or savings transfer isn't really "a category" of expense,
  // so don't force a choice there. Those still need the person/account
  // name filled in, same as before.
  const canConfirm = (t: TxRow) =>
    t.party_role === "owner" ? t.category_id != null : t.party.trim().length > 0;

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
        <div className="flex flex-col gap-2 sm:flex-row">
          {knownAccounts.length > 0 && (
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="rounded-xl border border-violet-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-white/10 dark:bg-zinc-950 dark:focus:ring-violet-500/30"
            >
              <option value="">All accounts</option>
              {knownAccounts.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            placeholder="Search description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-violet-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-white/10 dark:bg-zinc-950 dark:focus:ring-violet-500/30 sm:w-64"
          />
        </div>
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
          knownSavingsAccounts={knownSavingsAccounts}
          onNewSavingsAccount={addKnownSavingsAccount}
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
            knownSavingsAccounts={knownSavingsAccounts}
            onNewSavingsAccount={addKnownSavingsAccount}
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
                knownSavingsAccounts={knownSavingsAccounts}
                onNewSavingsAccount={addKnownSavingsAccount}
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
  knownSavingsAccounts,
  onNewSavingsAccount,
  onCreated,
}: {
  categories: Category[];
  onAddCategory: (name: string, kind: CategoryKind) => Promise<Category | null>;
  knownPeople: string[];
  onNewPerson: (name: string) => void;
  knownAccounts: string[];
  onNewAccount: (name: string) => void;
  knownSavingsAccounts: string[];
  onNewSavingsAccount: (name: string) => void;
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
    account: "",
    funded_by: "",
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
      // — flipping Out/In after choosing "Loan" should still mean a loan,
      // just now flowing the other direction.
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
          ? "A savings account name is required for this whose-money option"
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
        account: draft.account,
        funded_by: draft.funded_by,
        confirmed: confirmNow,
      }),
    });
    setSaving(false);

    if (res.ok) {
      onCreated();
      // Reset for adding another, but keep the date/direction/account — the
      // common case is entering several transactions from the same day and
      // account in a row.
      setDraft((d) => ({
        ...d,
        description: "",
        category_id: null,
        party_role: "owner",
        party_kind: "person",
        party: "Me",
        funded_by: "",
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
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">
            Account (optional)
          </label>
          <PersonPicker
            value={draft.account}
            onCommit={(name) => patchDraft({ account: name })}
            knownNames={knownAccounts}
            onNewName={onNewAccount}
            otherKindNames={knownPeople}
            entityNoun="account"
            placeholder="e.g. Halifax, Revolut, Wise"
            wide
          />
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
            knownSavingsAccounts={knownSavingsAccounts}
            onNewSavingsAccount={onNewSavingsAccount}
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
  // Narrower than knownAccounts: only real savings-pot names (e.g. "Purely
  // Investments"), not the physical banks tagged at upload. Lets the
  // Savings picker auto-fill and hide itself when there's just one.
  knownSavingsAccounts: string[];
  onNewSavingsAccount: (name: string) => void;
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

  // Money coming in almost never needs picking a specific income category
  // to be worth confirming — default it to "Other Income" so there's
  // nothing to actively choose, while still leaving it free to change to
  // Salary/Gift/Refund etc. Spending is left alone: which expense category
  // something falls under is the one thing worth categorizing by hand.
  useEffect(() => {
    if (!isExpense && t.category_id == null) {
      const fallback = categories.find((c) => c.kind === "income" && c.name === "Other Income");
      if (fallback) onPatch({ category_id: fallback.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpense, t.category_id, categories]);

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

function WhoseMoneyPicker({
  t,
  onPatch,
  knownPeople,
  onNewPerson,
  knownAccounts,
  onNewAccount,
  knownSavingsAccounts,
  onNewSavingsAccount,
}: PickerProps) {
  const relationship = relationshipOf(t.party_role, t.party_kind);
  const isAccount = relationship === "own_account";
  const isSpending = relationship === "owner" && t.amount < 0;
  const [showFundedBy, setShowFundedBy] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  // With exactly one known savings pot, there's nothing to actually choose —
  // auto-fill it and skip asking, but stay editable in case a second one
  // ever shows up.
  const singleSavingsAccount = knownSavingsAccounts.length === 1 ? knownSavingsAccounts[0] : null;

  useEffect(() => {
    if (isAccount && singleSavingsAccount && !t.party.trim()) {
      onPatch({ party: singleSavingsAccount });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAccount, singleSavingsAccount, t.party]);

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
        <option value="owner">{t.amount < 0 ? "Money spent" : "Money received"}</option>
        <option value="loan">{t.amount < 0 ? "Money lent" : "Money borrowed"}</option>
        <option value="own_account">Savings</option>
      </select>
      {isAccount && singleSavingsAccount && !showAccountPicker ? (
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-violet-200/50">
          <span>{t.party || singleSavingsAccount}</span>
          <button
            type="button"
            onClick={() => setShowAccountPicker(true)}
            className="text-violet-400 underline underline-offset-2 hover:text-violet-600 dark:text-violet-300/50 dark:hover:text-violet-200"
          >
            change
          </button>
        </div>
      ) : (
        relationship !== "owner" && (
          <PersonPicker
            value={t.party === "Me" ? "" : t.party}
            onCommit={(name) => onPatch({ party: name })}
            knownNames={isAccount ? knownAccounts : knownPeople}
            onNewName={
              isAccount
                ? (name) => {
                    onNewAccount(name);
                    onNewSavingsAccount(name);
                  }
                : onNewPerson
            }
            otherKindNames={isAccount ? knownPeople : knownAccounts}
            entityNoun={isAccount ? "account" : "person"}
            placeholder={isAccount ? "e.g. Halifax, Purely Investments" : "Person's name"}
          />
        )
      )}
      {isSpending &&
        (t.funded_by || showFundedBy ? (
          <select
            value={t.funded_by}
            onChange={(e) => onPatch({ funded_by: e.target.value })}
            title="Where did the money for this purchase actually come from?"
            className="w-full rounded-lg border border-violet-200 bg-white px-2 py-1 text-xs text-zinc-500 dark:border-white/10 dark:bg-zinc-950 dark:text-violet-200/60"
          >
            <option value="">Funded by other income</option>
            <option value="Savings">Funded by savings</option>
            {knownPeople.map((name) => (
              <option key={name} value={name}>
                Funded by {name}
              </option>
            ))}
          </select>
        ) : (
          <button
            type="button"
            onClick={() => setShowFundedBy(true)}
            className="self-start text-xs text-violet-400 hover:text-violet-600 dark:text-violet-300/50 dark:hover:text-violet-200"
          >
            + Tag funding source?
          </button>
        ))}
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
  knownSavingsAccounts,
  onNewSavingsAccount,
  canConfirm,
}: RowProps) {
  const isExpense = t.amount < 0;
  const needsCategory = relationshipOf(t.party_role, t.party_kind) === "owner";

  return (
    <tr className="border-t border-violet-100 align-top dark:border-white/10">
      <td className="px-3 py-2">
        <input type="checkbox" checked={selected} onChange={onToggleSelect} />
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-zinc-500 dark:text-violet-200/50">{t.date}</td>
      <td className="px-3 py-2">
        {t.description}
        {t.account && (
          <div className="text-xs text-violet-400 dark:text-violet-300/50">{t.account}</div>
        )}
      </td>
      <td
        className={`whitespace-nowrap px-3 py-2 text-right font-medium ${
          isExpense ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
        }`}
      >
        {isExpense ? "-" : "+"}£{Math.abs(t.amount).toFixed(2)}
      </td>
      <td className="px-3 py-2">
        {needsCategory ? (
          <CategoryPicker t={t} categories={categories} onPatch={onPatch} onAddCategory={onAddCategory} />
        ) : (
          <span className="text-xs text-zinc-400 dark:text-violet-200/30">— not needed —</span>
        )}
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
          knownSavingsAccounts={knownSavingsAccounts}
          onNewSavingsAccount={onNewSavingsAccount}
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
  knownSavingsAccounts,
  onNewSavingsAccount,
  canConfirm,
}: RowProps) {
  const isExpense = t.amount < 0;
  const needsCategory = relationshipOf(t.party_role, t.party_kind) === "owner";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-violet-100 bg-white p-3 shadow-[0_2px_16px_-6px_rgba(139,92,246,0.12)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
      <div className="flex items-start gap-2">
        <input type="checkbox" checked={selected} onChange={onToggleSelect} className="mt-1" />
        <div className="flex flex-1 items-start justify-between gap-2">
          <div>
            <div className="font-medium text-violet-950 dark:text-white">{t.description}</div>
            <div className="text-xs text-zinc-500 dark:text-violet-200/50">
              {t.date}
              {t.account ? ` · ${t.account}` : ""}
            </div>
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

      {needsCategory && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">Category</span>
          <CategoryPicker t={t} categories={categories} onPatch={onPatch} onAddCategory={onAddCategory} />
        </div>
      )}

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
          knownSavingsAccounts={knownSavingsAccounts}
          onNewSavingsAccount={onNewSavingsAccount}
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
