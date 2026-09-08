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

  const db = await getDb();

  const uploadInfo = await db.execute({
    sql: `INSERT INTO uploads (filename, row_count) VALUES (?, ?)`,
    args: [file.name, result.rows.length],
  });
  const uploadId = Number(uploadInfo.lastInsertRowid);

  const insertResults = await db.batch(
    result.rows.map((row) => ({
      sql: `
        INSERT INTO transactions (upload_id, date, description, amount, dedupe_hash, raw_row)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(dedupe_hash) DO NOTHING
      `,
      args: [
        uploadId,
        row.date,
        row.description,
        row.amount,
        dedupeHash(row.date, row.description, row.amount),
        JSON.stringify(row.raw),
      ],
    })),
    "write"
  );

  let imported = 0;
  let duplicates = 0;
  for (const r of insertResults) {
    if (r.rowsAffected > 0) imported++;
    else duplicates++;
  }

  await db.execute({
    sql: `UPDATE uploads SET imported_count = ?, duplicate_count = ? WHERE id = ?`,
    args: [imported, duplicates, uploadId],
  });

  return NextResponse.json({
    uploadId,
    totalRows: result.rows.length,
    imported,
    duplicates,
    warnings: result.warnings,
  });
}
