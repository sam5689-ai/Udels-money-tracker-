import type { Client } from "@libsql/client";
import { rowsOf } from "@/lib/db";
import { PartyKind, PartyRole } from "@/lib/types";

interface Row {
  id: number;
  date: string;
  description: string;
  amount: number;
  party: string;
  party_role: PartyRole;
  party_kind: PartyKind;
  category_kind: "income" | "expense" | "loan" | null;
  category_name: string | null;
}

export interface BucketTransaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string | null;
}

export interface Bucket {
  total: number;
  transactions: BucketTransaction[];
}

export interface Summary {
  range: { from: string; to: string };
  totals: { income: number; expenses: number; net: number };
  buckets: {
    spending: Bucket;
    lentOut: Bucket;
    ownAccounts: Bucket;
    everythingElse: Bucket;
  };
  monthly: { month: string; income: number; expenses: number; net: number }[];
  byCategory: { category: string; kind: string; total: number }[];
  loans: { party: string; youOweThem: number; theyOweYou: number; net: number }[];
  // Deliberately not netted into one "current balance" per account: when
  // both sides of a transfer get uploaded from two different bank
  // statements (each tagging the OTHER as the counterparty), a single
  // netted figure per name is mathematically consistent but reads
  // confusingly (e.g. a negative number for the account that sent money
  // out). Two plain additive totals are unambiguous regardless of which
  // side(s) got tagged.
  accounts: { party: string; movedOut: number; movedBack: number }[];
  unconfirmedCount: number;
}

function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function defaultRange(searchParams: URLSearchParams): { from: string; to: string } {
  const to = searchParams.get("to") || new Date().toISOString().slice(0, 10);
  const from =
    searchParams.get("from") ||
    (() => {
      const d = new Date(to);
      d.setFullYear(d.getFullYear() - 1);
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    })();
  return { from, to };
}

export async function computeSummary(db: Client, from: string, to: string): Promise<Summary> {
  const rs = await db.execute({
    sql: `SELECT t.id, t.date, t.description, t.amount, t.party, t.party_role, t.party_kind,
                 c.kind as category_kind, c.name as category_name
          FROM transactions t
          LEFT JOIN categories c ON c.id = t.category_id
          WHERE t.confirmed = 1 AND t.date >= ? AND t.date <= ?`,
    args: [from, to],
  });
  const rows = rowsOf<Row>(rs);

  const unconfirmedRs = await db.execute(`SELECT COUNT(*) as c FROM transactions WHERE confirmed = 0`);
  const unconfirmedCount = Number(rowsOf<{ c: number }>(unconfirmedRs)[0].c);

  let income = 0;
  let expenses = 0;
  const monthlyMap = new Map<string, { income: number; expenses: number }>();
  const categoryMap = new Map<string, { kind: string; total: number }>();
  const loanTotals = new Map<string, { youOweThem: number; theyOweYou: number }>();
  const accountTotals = new Map<string, { movedOut: number; movedBack: number }>();

  let spendingTotal = 0;
  let lentOutTotal = 0;
  let ownAccountsTotal = 0;
  let elseTotal = 0;
  const spendingTx: BucketTransaction[] = [];
  const lentOutTx: BucketTransaction[] = [];
  const ownAccountsTx: BucketTransaction[] = [];
  const elseTx: BucketTransaction[] = [];

  for (const r of rows) {
    const month = monthOf(r.date);
    if (!monthlyMap.has(month)) monthlyMap.set(month, { income: 0, expenses: 0 });
    const m = monthlyMap.get(month)!;

    const bucketTx: BucketTransaction = {
      id: r.id,
      date: r.date,
      description: r.description,
      amount: r.amount,
      category: r.category_name,
    };

    // Four buckets that answer "what is this money, in plain terms":
    // 1. My own spending — normal expenses, no one else involved.
    // 2. Lent out — money handed to another PERSON that's expected back.
    // 3. My other accounts — money moved to/from another account you own
    //    (e.g. a second bank), so uploading both sides of a transfer never
    //    inflates income/expenses — it's the same lent_to/repaid_by sign
    //    logic as bucket 2, just tagged party_kind "account" instead of
    //    "person".
    // 4. Everything else — income, money borrowed from others, and
    //    repayments either direction. A deliberate catch-all rather than
    //    guessing finer categories for it.
    if (r.party_role === "owner" && r.category_kind === "expense") {
      spendingTotal += Math.abs(r.amount);
      spendingTx.push(bucketTx);
    } else if ((r.party_role === "lent_to" || r.party_role === "repaid_by") && r.party_kind === "account") {
      ownAccountsTotal += r.party_role === "lent_to" ? Math.abs(r.amount) : -Math.abs(r.amount);
      ownAccountsTx.push(bucketTx);
    } else if (r.party_role === "lent_to" || r.party_role === "repaid_by") {
      lentOutTotal += r.party_role === "lent_to" ? Math.abs(r.amount) : -Math.abs(r.amount);
      lentOutTx.push(bucketTx);
    } else {
      elseTotal += r.amount;
      elseTx.push(bucketTx);
    }

    if (r.party_role === "owner") {
      if (r.category_kind === "income") {
        income += Math.abs(r.amount);
        m.income += Math.abs(r.amount);
      } else if (r.category_kind === "expense") {
        expenses += Math.abs(r.amount);
        m.expenses += Math.abs(r.amount);
      }

      const catKey = r.category_name || "Uncategorized";
      if (r.category_kind === "income" || r.category_kind === "expense") {
        if (!categoryMap.has(catKey)) categoryMap.set(catKey, { kind: r.category_kind, total: 0 });
        categoryMap.get(catKey)!.total += Math.abs(r.amount);
      }
    } else {
      const key = r.party.trim() || "Unknown";
      if (r.party_kind === "account") {
        if (!accountTotals.has(key)) accountTotals.set(key, { movedOut: 0, movedBack: 0 });
        const a = accountTotals.get(key)!;
        if (r.party_role === "lent_to") a.movedOut += Math.abs(r.amount);
        else if (r.party_role === "repaid_by") a.movedBack += Math.abs(r.amount);
      } else {
        if (!loanTotals.has(key)) loanTotals.set(key, { youOweThem: 0, theyOweYou: 0 });
        const l = loanTotals.get(key)!;
        if (r.party_role === "borrowed_from") l.youOweThem += Math.abs(r.amount);
        else if (r.party_role === "repaid_to") l.youOweThem -= Math.abs(r.amount);
        else if (r.party_role === "lent_to") l.theyOweYou += Math.abs(r.amount);
        else if (r.party_role === "repaid_by") l.theyOweYou -= Math.abs(r.amount);
      }
    }
  }

  const byDateDesc = (a: BucketTransaction, b: BucketTransaction) => b.date.localeCompare(a.date) || b.id - a.id;
  spendingTx.sort(byDateDesc);
  lentOutTx.sort(byDateDesc);
  ownAccountsTx.sort(byDateDesc);
  elseTx.sort(byDateDesc);

  const monthly = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, income: v.income, expenses: v.expenses, net: v.income - v.expenses }));

  const byCategory = Array.from(categoryMap.entries())
    .map(([category, v]) => ({ category, kind: v.kind, total: v.total }))
    .sort((a, b) => b.total - a.total);

  const loans = Array.from(loanTotals.entries())
    .map(([party, v]) => ({
      party,
      youOweThem: Math.round(v.youOweThem * 100) / 100,
      theyOweYou: Math.round(v.theyOweYou * 100) / 100,
      net: Math.round((v.theyOweYou - v.youOweThem) * 100) / 100,
    }))
    .sort((a, b) => a.party.localeCompare(b.party));

  const accounts = Array.from(accountTotals.entries())
    .map(([party, v]) => ({
      party,
      movedOut: Math.round(v.movedOut * 100) / 100,
      movedBack: Math.round(v.movedBack * 100) / 100,
    }))
    .sort((a, b) => a.party.localeCompare(b.party));

  return {
    range: { from, to },
    totals: {
      income: Math.round(income * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      net: Math.round((income - expenses) * 100) / 100,
    },
    buckets: {
      spending: { total: Math.round(spendingTotal * 100) / 100, transactions: spendingTx },
      lentOut: { total: Math.round(lentOutTotal * 100) / 100, transactions: lentOutTx },
      ownAccounts: { total: Math.round(ownAccountsTotal * 100) / 100, transactions: ownAccountsTx },
      everythingElse: { total: Math.round(elseTotal * 100) / 100, transactions: elseTx },
    },
    monthly,
    byCategory,
    loans,
    accounts,
    unconfirmedCount,
  };
}
