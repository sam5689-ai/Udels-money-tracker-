import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { computeSummary, defaultRange } from "@/lib/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const { from, to } = defaultRange(searchParams);

  const summary = await computeSummary(db, from, to);
  return NextResponse.json(summary);
}
