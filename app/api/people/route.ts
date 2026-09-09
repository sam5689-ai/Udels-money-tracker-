import { NextRequest, NextResponse } from "next/server";
import { getDb, rowsOf } from "@/lib/db";
import { PartyKind } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  party: string;
}

export async function GET(req: NextRequest) {
  const db = await getDb();
  const kindParam = new URL(req.url).searchParams.get("kind");
  const kind: PartyKind = kindParam === "account" ? "account" : "person";

  const rs = await db.execute({
    sql: `SELECT DISTINCT party
          FROM transactions
          WHERE party_role != 'owner' AND party_kind = ? AND party IS NOT NULL AND trim(party) != ''
          ORDER BY party COLLATE NOCASE`,
    args: [kind],
  });
  const people = rowsOf<Row>(rs).map((r) => r.party);
  return NextResponse.json({ people });
}
