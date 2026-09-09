import { NextRequest, NextResponse } from "next/server";
import { getDb, rowsOf } from "@/lib/db";
import { PartyRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  id: number;
  date: string;
  description: string;
  amount: number;
  party: string;
  party_role: PartyRole;
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
    sql: `SELECT id, date, description, amount, party, party_role
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
  const ledger: LedgerEntry[] = rows.map((r) => {
    const delta = deltaFor(r.party_role, r.amount);
    balance += delta;
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

  return NextResponse.json({
    party: rows[0].party,
    balance: Math.round(balance * 100) / 100,
    ledger: [...ledger].reverse(), // most recent first
  });
}
