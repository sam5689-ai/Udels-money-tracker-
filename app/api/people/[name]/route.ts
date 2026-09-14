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

export interface LedgerEntry {
  id: number;
  date: string;
  description: string;
  amount: number;
  party_role: PartyRole;
  delta: number;
  balance: number;
  // True for a spending transaction tagged "Funded by <this person>" —
  // not an actual transaction with them, but still settles part of what
  // you owe them (or they owe you), same effect as a "repaid_to" entry.
  // See the matching comment in lib/summary.ts for why.
  fundedBySpend?: boolean;
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

interface FundedRow {
  id: number;
  date: string;
  description: string;
  amount: number;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name).trim();
  const db = await getDb();

  const loanRs = await db.execute({
    sql: `SELECT id, date, description, amount, party, party_role, party_kind
          FROM transactions
          WHERE confirmed = 1 AND party_role != 'owner' AND party = ? COLLATE NOCASE`,
    args: [decodedName],
  });
  const loanRows = rowsOf<Row>(loanRs);

  const fundedRs = await db.execute({
    sql: `SELECT id, date, description, amount
          FROM transactions
          WHERE confirmed = 1 AND party_role = 'owner' AND funded_by = ? COLLATE NOCASE`,
    args: [decodedName],
  });
  const fundedRows = rowsOf<FundedRow>(fundedRs);

  if (loanRows.length === 0 && fundedRows.length === 0) {
    return NextResponse.json({ error: "No transactions found for this person" }, { status: 404 });
  }

  const merged = [
    ...loanRows.map((r) => ({ ...r, fundedBySpend: false as const })),
    ...fundedRows.map((r) => ({ ...r, party_role: "owner" as PartyRole, fundedBySpend: true as const })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

  let balance = 0;
  let movedOut = 0;
  let movedBack = 0;
  const ledger: LedgerEntry[] = merged.map((r) => {
    const delta = r.fundedBySpend ? Math.abs(r.amount) : deltaFor(r.party_role, r.amount);
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
      fundedBySpend: r.fundedBySpend || undefined,
    };
  });

  return NextResponse.json({
    party: loanRows[0]?.party ?? decodedName,
    party_kind: loanRows[0]?.party_kind ?? "person",
    balance: Math.round(balance * 100) / 100,
    // Only meaningful for accounts, whose ledger can be fed from two
    // different uploaded statements (see summary.ts) — a netted "balance"
    // would be self-consistent but confusing there, so the ledger page
    // shows these two plain totals instead for party_kind "account".
    movedOut: Math.round(movedOut * 100) / 100,
    movedBack: Math.round(movedBack * 100) / 100,
    ledger: [...ledger].reverse(), // most recent first
  });
}
