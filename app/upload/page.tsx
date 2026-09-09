"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Upload } from "@/lib/types";

interface UploadOutcome {
  filename: string;
  imported: number;
  duplicates: number;
  totalRows: number;
  warnings: string[];
  error?: string;
}

export default function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcomes, setOutcomes] = useState<UploadOutcome[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadUploads = useCallback(async () => {
    const res = await fetch("/api/uploads");
    if (res.ok) {
      const data = await res.json();
      setUploads(data.uploads);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch("/api/uploads").then(async (res) => {
      if (ignore || !res.ok) return;
      const data = await res.json();
      setUploads(data.uploads);
    });
    return () => {
      ignore = true;
    };
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setBusy(true);
      const newOutcomes: UploadOutcome[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        try {
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          const data = await res.json();
          if (!res.ok) {
            newOutcomes.push({
              filename: file.name,
              imported: 0,
              duplicates: 0,
              totalRows: 0,
              warnings: data.warnings || [],
              error: data.error || "Upload failed",
            });
          } else {
            newOutcomes.push({
              filename: file.name,
              imported: data.imported,
              duplicates: data.duplicates,
              totalRows: data.totalRows,
              warnings: data.warnings || [],
            });
          }
        } catch {
          newOutcomes.push({
            filename: file.name,
            imported: 0,
            duplicates: 0,
            totalRows: 0,
            warnings: [],
            error: "Network error while uploading",
          });
        }
      }
      setOutcomes((prev) => [...newOutcomes, ...prev]);
      setBusy(false);
      loadUploads();
    },
    [loadUploads]
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <div>
        <h1 className="text-2xl font-semibold text-violet-950 dark:text-white">
          Upload bank statements
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-violet-200/60">
          Upload CSV or Excel (.xlsx) exports from your bank. We&apos;ll automatically detect
          the date, description and amount columns, and skip any transactions you&apos;ve
          already imported.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-16 text-center transition-colors ${
          dragging
            ? "border-violet-400 bg-violet-50 dark:border-violet-500 dark:bg-white/10"
            : "border-violet-200 bg-white hover:bg-violet-50/50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".csv,.txt,.xlsx,.xlsm"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14" />
          </svg>
        </span>
        <p className="font-medium text-violet-950 dark:text-white">
          {busy ? "Uploading…" : "Drag & drop files here, or click to choose"}
        </p>
        <p className="text-sm text-zinc-500 dark:text-violet-200/50">CSV or XLSX, up to 15MB each</p>
      </div>

      {outcomes.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">
            Import results
          </h2>
          {outcomes.map((o, i) => (
            <div
              key={i}
              className={`rounded-2xl border px-4 py-3 text-sm ${
                o.error
                  ? "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                  : "border-green-300 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-300"
              }`}
            >
              <div className="font-medium">{o.filename}</div>
              {o.error ? (
                <div>{o.error}</div>
              ) : (
                <div>
                  Imported {o.imported} new transaction{o.imported === 1 ? "" : "s"}
                  {o.duplicates > 0 ? `, skipped ${o.duplicates} already-imported duplicate${o.duplicates === 1 ? "" : "s"}` : ""}.
                </div>
              )}
              {o.warnings.map((w, wi) => (
                <div key={wi} className="mt-1 text-xs opacity-80">
                  {w}
                </div>
              ))}
            </div>
          ))}
          <Link
            href="/review"
            className="self-start rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-violet-300/50 hover:from-violet-500 hover:to-fuchsia-400 dark:shadow-none"
          >
            Go review transactions →
          </Link>
        </div>
      )}

      {uploads.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-violet-500/70 dark:text-violet-300/50">
            Upload history
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-violet-100 dark:border-white/10">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-violet-50/70 text-left text-zinc-600 dark:bg-white/5 dark:text-violet-200/60">
                <tr>
                  <th className="px-4 py-2 font-medium">File</th>
                  <th className="px-4 py-2 font-medium">Uploaded</th>
                  <th className="px-4 py-2 font-medium text-right">Imported</th>
                  <th className="px-4 py-2 font-medium text-right">Duplicates</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((u) => (
                  <tr key={u.id} className="border-t border-violet-100 dark:border-white/10">
                    <td className="max-w-[160px] truncate px-4 py-2">{u.filename}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-zinc-500 dark:text-violet-200/50">
                      {new Date(u.uploaded_at + "Z").toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right">{u.imported_count}</td>
                    <td className="px-4 py-2 text-right">{u.duplicate_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
