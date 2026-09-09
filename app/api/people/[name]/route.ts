import { NextRequest, NextResponse } from "next/server";
import { getDb, rowsOf } from "@/lib/db";
import { PartyKind, PartyRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  id: number;
  date: string;
  description: string;
  amount: number;
  party: string;
  party_role: PartyRole;
  party_kind: PartyKind;
}

interface TaggedRow {
  id: number;
  date: string;
  description: string;
  amount: number;
}

export interface LedgerEntry {
  id: number;
  date: string;
  description: string;
  amount: number;
  party_role: PartyRole;
  delta: number;
  balance: number;
}

// A person's running balance, from the perspective of "how much they owe
// you" — positive means they owe you, negative means you owe them. Full
// history, not scoped to any date range: a running balance only means
// something if it starts from the very first transaction.
function deltaFor(role: PartyRole, amount: number): number {
  if (role === "lent_to") return Math.abs(amount);
  if (role === "repaid_by") return -Math.abs(amount);
  if (role === "borrowed_from") return -Math.abs(amount);
  if (role === "repaid_to") return Math.abs(amount);
  return 0;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name).trim();
  const db = await getDb();

  const rs = await db.execute({
    sql: `SELECT id, date, description, amount, party, party_role, party_kind
          FROM transactions
          WHERE confirmed = 1 AND party_role != 'owner' AND party = ? COLLATE NOCASE
          ORDER BY date ASC, id ASC`,
    args: [decodedName],
  });
  const rows = rowsOf<Row>(rs);

  if (rows.length === 0) {
    return NextResponse.json({ error: "No transactions found for this person" }, { status: 404 });
  }

  let balance = 0;
  let movedOut = 0;
  let movedBack = 0;
  const ledger: LedgerEntry[] = rows.map((r) => {
    const delta = deltaFor(r.party_role, r.amount);
    balance += delta;
    if (r.party_role === "lent_to") movedOut += Math.abs(r.amount);
    else if (r.party_role === "repaid_by") movedBack += Math.abs(r.amount);
    return {
      id: r.id,
      date: r.date,
      description: r.description,
      amount: r.amount,
      party_role: r.party_role,
      delta: Math.round(delta * 100) / 100,
      balance: Math.round(balance * 100) / 100,
    };
  });

  // Spending elsewhere self-tagged as "funded by" this account — see
  // funded_by on Transaction. Only meaningful when this party is an
  // account (a savings/investment pot), but harmless to compute either
  // way; the ledger page only renders it for party_kind "account".
  const taggedRs = await db.execute({
    sql: `SELECT id, date, description, amount
          FROM transactions
          WHERE confirmed = 1 AND party_role = 'owner' AND funded_by = ? COLLATE NOCASE
          ORDER BY date DESC, id DESC`,
    args: [decodedName],
  });
  const taggedSpending = rowsOf<TaggedRow>(taggedRs);
  const taggedTotal = taggedSpending.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return NextResponse.json({
    party: rows[0].party,
    party_kind: rows[0].party_kind,
    balance: Math.round(balance * 100) / 100,
    // Only meaningful for accounts, whose ledger can be fed from two
    // different uploaded statements (see summary.ts) — a netted "balance"
    // would be self-consistent but confusing there, so the ledger page
    // shows these two plain totals instead for party_kind "account".
    movedOut: Math.round(movedOut * 100) / 100,
    movedBack: Math.round(movedBack * 100) / 100,
    taggedTotal: Math.round(taggedTotal * 100) / 100,
    taggedSpending,
    ledger: [...ledger].reverse(), // most recent first
  });
}
