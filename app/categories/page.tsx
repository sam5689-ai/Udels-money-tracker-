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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Manage categories
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Rename, retype, or delete categories. Deleting a category that&apos;s in use leaves
          those transactions uncategorized rather than deleting them.
        </p>
      </div>

      <form
        onSubmit={createCategory}
        className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <input
          type="text"
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          value={newKind}
          onChange={(e) => setNewKind(e.target.value as CategoryKind)}
          className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="loan">Loan</option>
        </select>
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black"
        >
          {creating ? "Adding…" : "+ Add category"}
        </button>
        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
      </form>

      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
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
          <div className="px-4 py-10 text-center text-sm text-zinc-500">No categories yet.</div>
        )}
        {loading && <div className="px-4 py-10 text-center text-sm text-zinc-500">Loading…</div>}
      </div>
    </main>
  );
}

function CategoryRowItem({
  category,
  onRename,
  onChangeKind,
  onDelete,
}: {
  category: CategoryRow;
  onRename: (name: string) => void;
  onChangeKind: (kind: CategoryKind) => void;
  onDelete: () => void;
}) {
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
    <tr className="border-t border-zinc-200 dark:border-zinc-800">
      <td className="px-4 py-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 hover:border-zinc-300 focus:border-zinc-400 focus:bg-white focus:outline-none dark:hover:border-zinc-700 dark:focus:border-zinc-600 dark:focus:bg-zinc-900"
        />
      </td>
      <td className="px-4 py-2">
        <select
          value={category.kind}
          onChange={(e) => onChangeKind(e.target.value as CategoryKind)}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="loan">Loan</option>
        </select>
      </td>
      <td className="px-4 py-2 text-zinc-500">
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
