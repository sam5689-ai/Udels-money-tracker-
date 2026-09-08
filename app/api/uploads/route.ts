import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { Upload } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const uploads = db
    .prepare(`SELECT * FROM uploads ORDER BY uploaded_at DESC`)
    .all() as Upload[];
  return NextResponse.json({ uploads });
}
