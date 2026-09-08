import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { parseSpreadsheet } from "@/lib/parse";
import { dedupeHash } from "@/lib/hash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 15 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File is too large (max 15MB)." }, { status: 400 });
  }

  const lower = file.name.toLowerCase();
  if (!/\.(csv|txt|xlsx|xlsm)$/.test(lower)) {
    return NextResponse.json(
      { error: "Unsupported file type. Please upload a .csv or .xlsx file." },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let result;
  try {
    result = await parseSpreadsheet(buffer, file.name);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to parse file: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 }
    );
  }

  if (result.rows.length === 0) {
    return NextResponse.json(
      { error: "No transactions could be found in this file.", warnings: result.warnings },
      { status: 422 }
    );
  }

  const db = getDb();

  const insertUpload = db.prepare(
    `INSERT INTO uploads (filename, row_count) VALUES (?, ?)`
  );
  const insertTx = db.prepare(`
    INSERT INTO transactions (upload_id, date, description, amount, dedupe_hash, raw_row)
    VALUES (@upload_id, @date, @description, @amount, @dedupe_hash, @raw_row)
    ON CONFLICT(dedupe_hash) DO NOTHING
  `);

  const uploadInfo = insertUpload.run(file.name, result.rows.length);
  const uploadId = uploadInfo.lastInsertRowid as number;

  let imported = 0;
  let duplicates = 0;

  const insertAll = db.transaction(() => {
    for (const row of result.rows) {
      const hash = dedupeHash(row.date, row.description, row.amount);
      const info = insertTx.run({
        upload_id: uploadId,
        date: row.date,
        description: row.description,
        amount: row.amount,
        dedupe_hash: hash,
        raw_row: JSON.stringify(row.raw),
      });
      if (info.changes > 0) imported++;
      else duplicates++;
    }
  });
  insertAll();

  db.prepare(`UPDATE uploads SET imported_count = ?, duplicate_count = ? WHERE id = ?`).run(
    imported,
    duplicates,
    uploadId
  );

  return NextResponse.json({
    uploadId,
    totalRows: result.rows.length,
    imported,
    duplicates,
    warnings: result.warnings,
  });
}
