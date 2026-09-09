"use client";

import { useEffect, useMemo, useState } from "react";

// Typeahead for a person/account name field: suggests existing entries of
// the same kind as the user types, and requires an explicit confirm
// before a name that doesn't match any of them is treated as brand-new.
// Also guards against naming collisions across kinds — e.g. typing
// "Jordan" while picking "Savings" when "Jordan" already exists as
// a person would otherwise silently mix a personal IOU and an account
// transfer under the same ledger. Shared between the Review page's whose-
// money picker and the Upload page's "which account is this from" field.
export default function PersonPicker({
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
