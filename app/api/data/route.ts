import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Wipes all transactions, uploaded-statement records, and (since accounts
// are just derived from the `party` column on transactions, not a separate
// table) every manually-created account along with them. Categories are
// left alone — they're reusable setup, not per-import data.
export async function DELETE() {
  const db = await getDb();
  await db.batch(["DELETE FROM transactions", "DELETE FROM uploads"], "write");
  return NextResponse.json({ ok: true });
}
