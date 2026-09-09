import { NextResponse } from "next/server";
import { getDb, rowsOf } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  party: string;
}

export async function GET() {
  const db = await getDb();
  const rs = await db.execute({
    sql: `SELECT DISTINCT party
          FROM transactions
          WHERE party_role != 'owner' AND party IS NOT NULL AND trim(party) != ''
          ORDER BY party COLLATE NOCASE`,
    args: [],
  });
  const people = rowsOf<Row>(rs).map((r) => r.party);
  return NextResponse.json({ people });
}
