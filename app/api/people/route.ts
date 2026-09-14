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
  const kind: PartyKind | "savings" = kindParam === "account" ? "account" : kindParam === "savings" ? "savings" : "person";

  // For "account", the same real-world entity (e.g. "Halifax") can show up
  // two ways: as a transfer counterparty (party, with party_kind=account)
  // or as the source account tagged on an upload (the `account` column).
  // Union both so either context suggests names learned from the other.
  // "savings" is narrower: only real transfer counterparties (e.g. "Purely
  // Investments"), not the physical bank accounts tagged at upload — used
  // to decide whether there's exactly one savings pot worth auto-filling.
  // "Me" is excluded everywhere: it's an internal placeholder for owner
  // rows (see WhoseMoneyPicker), never a real counterparty, but bad data
  // from before that was enforced can still have it saved on a non-owner
  // row.
  const sql =
    kind === "account"
      ? `SELECT party AS name FROM transactions
           WHERE party_role != 'owner' AND party_kind = 'account' AND trim(party) != '' AND party != 'Me' COLLATE NOCASE
         UNION
         SELECT account AS name FROM transactions WHERE trim(account) != '' AND account != 'Me' COLLATE NOCASE
         ORDER BY name COLLATE NOCASE`
      : kind === "savings"
        ? `SELECT DISTINCT party AS name
             FROM transactions
             WHERE party_role != 'owner' AND party_kind = 'account' AND trim(party) != '' AND party != 'Me' COLLATE NOCASE
             ORDER BY party COLLATE NOCASE`
        : `SELECT DISTINCT party AS name
             FROM transactions
             WHERE party_role != 'owner' AND party_kind = 'person' AND trim(party) != '' AND party != 'Me' COLLATE NOCASE
             ORDER BY party COLLATE NOCASE`;

  const rs = await db.execute({ sql, args: [] });
  const people = rowsOf<Row>(rs).map((r) => r.name);
  return NextResponse.json({ people });
}
