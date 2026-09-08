import { NextResponse } from "next/server";
import { getDb, rowsOf } from "@/lib/db";
import { Upload } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const rs = await db.execute(`SELECT * FROM uploads ORDER BY uploaded_at DESC`);
  return NextResponse.json({ uploads: rowsOf<Upload>(rs) });
}
