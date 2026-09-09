"use client";

import { useCallback, useEffect, useState } from "react";
import { CategoryKind } from "@/lib/types";

interface CategoryRow {
  id: number;
  name: string;
  kind: CategoryKind;
  sort_order: number;
  usage_count: number;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<CategoryKind>("expense");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/categories");
    const data = await res.json();
    setCategories(data.categories);
    setLoading(false);
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => load());
  }, [load]);

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError("");
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, kind: newKind }),
    });
    setCreating(false);
    if (res.ok) {
      setNewName("");
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not create category");
    }
  }

  async function renameCategory(id: number, name: string) {
    const res = await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const data = await res.json();
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...data.category } : c)));
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Could not rename category");
      load();
    }
  }

  async function changeKind(id: number, kind: CategoryKind) {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, kind } : c)));
    await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
  }

  async function deleteCategory(c: CategoryRow) {
    const message =
      c.usage_count > 0
        ? `"${c.name}" is used by ${c.usage_count} transaction${c.usage_count === 1 ? "" : "s"}. Deleting it will leave ${c.usage_count === 1 ? "that transaction" : "those transactions"} uncategorized. Delete anyway?`
        : `Delete "${c.name}"?`;
    if (!confirm(message)) return;

    const res = await fetch(`/api/categories/${c.id}`, { method: "DELETE" });
    if (res.ok) {
      setCategories((prev) => prev.filter((x) => x.id !== c.id));
    } else {
      alert("Could not delete category");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="text-2xl font-semibold text-violet-950 dark:text-white">
          Manage categories
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-violet-200/60">
          Rename, retype, or delete categories. Deleting a category that&apos;s in use leaves
          those transactions uncategorized rather than deleting them.
        </p>
      </div>

      <form
        onSubmit={createCategory}
        className="flex flex-col gap-2 rounded-2xl border border-violet-100 bg-white p-3 shadow-[0_2px_20px_-6px_rgba(139,92,246,0.15)] sm:flex-row sm:flex-wrap sm:items-center dark:border-white/10 dark:bg-white/5 dark:shadow-none"
      >
        <input
          type="text"
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="rounded-xl border border-violet-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-white/10 dark:bg-zinc-900 dark:focus:ring-violet-500/30"
        />
        <div className="flex items-center gap-2">
          <select
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as CategoryKind)}
            className="rounded-xl border border-violet-200 px-2 py-1.5 text-sm dark:border-white/10 dark:bg-zinc-900"
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="loan">Loan</option>
          </select>
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="flex-1 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm shadow-violet-300/50 hover:from-violet-500 hover:to-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none dark:shadow-none"
          >
            {creating ? "Adding…" : "+ Add category"}
          </button>
        </div>
        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
      </form>

      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {categories.map((c) => (
          <CategoryCard
            key={`${c.id}:${c.name}`}
            category={c}
            onRename={(name) => renameCategory(c.id, name)}
            onChangeKind={(kind) => changeKind(c.id, kind)}
            onDelete={() => deleteCategory(c)}
          />
        ))}
        {!loading && categories.length === 0 && (
          <div className="rounded-2xl border border-violet-100 px-4 py-10 text-center text-sm text-zinc-500 dark:border-white/10 dark:text-violet-200/50">
            No categories yet.
          </div>
        )}
        {loading && (
          <div className="rounded-2xl border border-violet-100 px-4 py-10 text-center text-sm text-zinc-500 dark:border-white/10 dark:text-violet-200/50">
            Loading…
          </div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-[0_2px_20px_-6px_rgba(139,92,246,0.12)] md:block dark:border-white/10 dark:bg-white/5 dark:shadow-none">
        <table className="w-full text-sm">
          <thead className="bg-violet-50/70 text-left text-zinc-600 dark:bg-white/5 dark:text-violet-200/60">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Used in</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <CategoryRowItem
                key={`${c.id}:${c.name}`}
                category={c}
                onRename={(name) => renameCategory(c.id, name)}
                onChangeKind={(kind) => changeKind(c.id, kind)}
                onDelete={() => deleteCategory(c)}
              />
            ))}
          </tbody>
        </table>
        {!loading && categories.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-violet-200/50">No categories yet.</div>
        )}
        {loading && <div className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-violet-200/50">Loading…</div>}
      </div>

      <ClearDataSection />
    </main>
  );
}

function ClearDataSection() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [clearing, setClearing] = useState(false);
  const [done, setDone] = useState(false);

  async function clearData() {
    setClearing(true);
    const res = await fetch("/api/data", { method: "DELETE" });
    setClearing(false);
    if (res.ok) {
      setOpen(false);
      setConfirmText("");
      setDone(true);
    } else {
      alert("Could not clear data");
    }
  }

  return (
    <div className="rounded-2xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
      <h2 className="text-sm font-semibold text-red-800 dark:text-red-300">Danger zone</h2>
      <p className="mt-1 text-sm text-red-700 dark:text-red-400">
        Permanently delete every transaction, upload record, and manually-added account
        (people). Your categories are kept. This cannot be undone.
      </p>

      {done && (
        <p className="mt-2 text-sm font-medium text-green-700 dark:text-green-400">
          All transactions and accounts have been cleared.
        </p>
      )}

      {!open ? (
        <button
          onClick={() => {
            setOpen(true);
            setDone(false);
          }}
          className="mt-3 rounded-full border border-red-400 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-900/40"
        >
          Clear all data…
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-sm text-red-700 dark:text-red-400">
            Type <span className="font-mono font-semibold">DELETE</span> to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full rounded-xl border border-red-300 bg-white px-2 py-1 text-sm dark:border-red-800 dark:bg-zinc-950 sm:w-32"
          />
          <div className="flex gap-2">
            <button
              onClick={clearData}
              disabled={confirmText !== "DELETE" || clearing}
              className="rounded-full bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 hover:bg-red-700"
            >
              {clearing ? "Clearing…" : "Clear all data"}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setConfirmText("");
              }}
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface CategoryItemProps {
  category: CategoryRow;
  onRename: (name: string) => void;
  onChangeKind: (kind: CategoryKind) => void;
  onDelete: () => void;
}

function CategoryRowItem({ category, onRename, onChangeKind, onDelete }: CategoryItemProps) {
  // No effect needed to resync after a rename resolves — the parent keys
  // this component on `${id}:${name}`, so a name change simply remounts it
  // with the new value as the initial state.
  const [name, setName] = useState(category.name);

  function commitName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== category.name) {
      onRename(trimmed);
    } else {
      setName(category.name);
    }
  }

  return (
    <tr className="border-t border-violet-100 dark:border-white/10">
      <td className="px-4 py-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 hover:border-violet-200 focus:border-violet-400 focus:bg-white focus:outline-none dark:hover:border-white/10 dark:focus:border-violet-500/40 dark:focus:bg-zinc-900"
        />
      </td>
      <td className="px-4 py-2">
        <select
          value={category.kind}
          onChange={(e) => onChangeKind(e.target.value as CategoryKind)}
          className="rounded-lg border border-violet-200 bg-white px-2 py-1 text-sm dark:border-white/10 dark:bg-zinc-950"
        >
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="loan">Loan</option>
        </select>
      </td>
      <td className="px-4 py-2 text-zinc-500 dark:text-violet-200/50">
        {category.usage_count > 0
          ? `${category.usage_count} transaction${category.usage_count === 1 ? "" : "s"}`
          : "—"}
      </td>
      <td className="px-4 py-2 text-right">
        <button
          onClick={onDelete}
          className="text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

function CategoryCard({ category, onRename, onChangeKind, onDelete }: CategoryItemProps) {
  const [name, setName] = useState(category.name);

  function commitName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== category.name) {
      onRename(trimmed);
    } else {
      setName(category.name);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-violet-100 bg-white p-3 shadow-[0_2px_16px_-6px_rgba(139,92,246,0.12)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="w-full rounded-xl border border-violet-200 px-2 py-1.5 font-medium dark:border-white/10 dark:bg-zinc-900"
      />
      <div className="flex items-center justify-between gap-2">
        <select
          value={category.kind}
          onChange={(e) => onChangeKind(e.target.value as CategoryKind)}
          className="rounded-lg border border-violet-200 bg-white px-2 py-1 text-sm dark:border-white/10 dark:bg-zinc-950"
        >
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="loan">Loan</option>
        </select>
        <span className="text-xs text-zinc-500 dark:text-violet-200/50">
          {category.usage_count > 0
            ? `${category.usage_count} transaction${category.usage_count === 1 ? "" : "s"}`
            : "Unused"}
        </span>
        <button
          onClick={onDelete}
          className="text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
