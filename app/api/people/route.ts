import { NextRequest, NextResponse } from "next/server";
import { getDb, rowsOf } from "@/lib/db";
import { PartyKind } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  name: string;
}

export async function GET(req: NextRequest) {
  const db = await getDb();
  const kindParam = new URL(req.url).searchParams.get("kind");
  const kind: PartyKind = kindParam === "account" ? "account" : "person";

  // For "account", the same real-world entity (e.g. "Halifax") can show up
  // two ways: as a transfer counterparty (party, with party_kind=account)
  // or as the source account tagged on an upload (the `account` column).
  // Union both so either context suggests names learned from the other.
  const sql =
    kind === "account"
      ? `SELECT party AS name FROM transactions
           WHERE party_role != 'owner' AND party_kind = 'account' AND trim(party) != ''
         UNION
         SELECT account AS name FROM transactions WHERE trim(account) != ''
         ORDER BY name COLLATE NOCASE`
      : `SELECT DISTINCT party AS name
           FROM transactions
           WHERE party_role != 'owner' AND party_kind = 'person' AND trim(party) != ''
           ORDER BY party COLLATE NOCASE`;

  const rs = await db.execute({ sql, args: [] });
  const people = rowsOf<Row>(rs).map((r) => r.name);
  return NextResponse.json({ people });
}
