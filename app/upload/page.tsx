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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Upload bank statements
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
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
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors ${
          dragging
            ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-900"
            : "border-zinc-300 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
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
        <p className="font-medium text-zinc-900 dark:text-zinc-50">
          {busy ? "Uploading…" : "Drag & drop files here, or click to choose"}
        </p>
        <p className="text-sm text-zinc-500">CSV or XLSX, up to 15MB each</p>
      </div>

      {outcomes.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Import results
          </h2>
          {outcomes.map((o, i) => (
            <div
              key={i}
              className={`rounded-lg border px-4 py-3 text-sm ${
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
            className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Go review transactions →
          </Link>
        </div>
      )}

      {uploads.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Upload history
          </h2>
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-100 text-left text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium">File</th>
                  <th className="px-4 py-2 font-medium">Uploaded</th>
                  <th className="px-4 py-2 font-medium text-right">Imported</th>
                  <th className="px-4 py-2 font-medium text-right">Duplicates</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((u) => (
                  <tr key={u.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="px-4 py-2">{u.filename}</td>
                    <td className="px-4 py-2 text-zinc-500">
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
