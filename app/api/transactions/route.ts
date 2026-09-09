import { NextRequest, NextResponse } from "next/server";
import { LibsqlError } from "@libsql/client";
import { getDb, rowsOf } from "@/lib/db";
import { dedupeHash } from "@/lib/hash";
import { PartyKind, PartyRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ROLES: PartyRole[] = ["owner", "borrowed_from", "lent_to", "repaid_to", "repaid_by"];
const VALID_KINDS: PartyKind[] = ["person", "account"];

export async function GET(req: NextRequest) {
  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const confirmed = searchParams.get("confirmed");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const search = searchParams.get("search");
  const account = searchParams.get("account");

  const clauses: string[] = [];
  const args: (string | number)[] = [];

  if (confirmed === "0" || confirmed === "1") {
    clauses.push("t.confirmed = ?");
    args.push(Number(confirmed));
  }
  if (from) {
    clauses.push("t.date >= ?");
    args.push(from);
  }
  if (to) {
    clauses.push("t.date <= ?");
    args.push(to);
  }
  if (search) {
    clauses.push("t.description LIKE ?");
    args.push(`%${search}%`);
  }
  if (account) {
    clauses.push("t.account = ?");
    args.push(account);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const rs = await db.execute({
    sql: `SELECT t.*, c.name as category_name, c.kind as category_kind
          FROM transactions t
          LEFT JOIN categories c ON c.id = t.category_id
          ${where}
          ORDER BY t.date DESC, t.id DESC`,
    args,
  });

  return NextResponse.json({ transactions: rowsOf(rs) });
}

export async function PATCH(req: NextRequest) {
  const db = await getDb();
  const body = await req.json();
  const { ids, patch } = body as {
    ids: number[];
    patch: {
      category_id?: number | null;
      party?: string;
      party_role?: PartyRole;
      party_kind?: PartyKind;
      account?: string;
      confirmed?: boolean;
    };
  };

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }
  if (patch.party_role && !VALID_ROLES.includes(patch.party_role)) {
    return NextResponse.json({ error: "Invalid party_role" }, { status: 400 });
  }
  if (patch.party_kind && !VALID_KINDS.includes(patch.party_kind)) {
    return NextResponse.json({ error: "Invalid party_kind" }, { status: 400 });
  }

  const sets: string[] = [];
  const args: (string | number | null)[] = [];

  if ("category_id" in patch) {
    sets.push("category_id = ?");
    args.push(patch.category_id ?? null);
  }
  if ("party" in patch && typeof patch.party === "string") {
    sets.push("party = ?");
    args.push(patch.party.trim() || "Me");
  }
  if ("party_role" in patch && patch.party_role) {
    sets.push("party_role = ?");
    args.push(patch.party_role);
  }
  if ("party_kind" in patch && patch.party_kind) {
    sets.push("party_kind = ?");
    args.push(patch.party_kind);
  }
  if ("account" in patch && typeof patch.account === "string") {
    sets.push("account = ?");
    args.push(patch.account.trim());
  }
  if ("confirmed" in patch) {
    sets.push("confirmed = ?");
    args.push(patch.confirmed ? 1 : 0);
    sets.push("confirmed_at = ?");
    args.push(patch.confirmed ? new Date().toISOString() : null);
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const placeholders = ids.map(() => "?").join(",");
  const rs = await db.execute({
    sql: `UPDATE transactions SET ${sets.join(", ")} WHERE id IN (${placeholders})`,
    args: [...args, ...ids],
  });

  return NextResponse.json({ updated: rs.rowsAffected });
}

export async function POST(req: NextRequest) {
  const db = await getDb();
  const body = await req.json();

  const date = typeof body.date === "string" ? body.date : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const amount = typeof body.amount === "number" ? body.amount : NaN;
  const categoryId = body.category_id != null ? Number(body.category_id) : null;
  const partyRole: PartyRole = VALID_ROLES.includes(body.party_role) ? body.party_role : "owner";
  const partyKind: PartyKind = VALID_KINDS.includes(body.party_kind) ? body.party_kind : "person";
  const rawParty = typeof body.party === "string" ? body.party.trim() : "";
  const account = typeof body.account === "string" ? body.account.trim() : "";
  const confirmed = body.confirmed ? 1 : 0;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "A valid date is required" }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: "Description is required" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ error: "A non-zero amount is required" }, { status: 400 });
  }
  if (partyRole !== "owner" && !rawParty) {
    return NextResponse.json(
      { error: partyKind === "account" ? "An account name is required for this whose-money option" : "Person's name is required for this whose-money option" },
      { status: 400 }
    );
  }

  const party = rawParty || "Me";

  const hash = dedupeHash(date, description, amount, account);

  try {
    const insert = await db.execute({
      sql: `INSERT INTO transactions
              (upload_id, date, description, amount, category_id, party, party_role, party_kind, account, confirmed, confirmed_at, dedupe_hash)
            VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        date,
        description,
        amount,
        categoryId,
        party,
        partyRole,
        partyKind,
        account,
        confirmed,
        confirmed ? new Date().toISOString() : null,
        hash,
      ],
    });

    const rs = await db.execute({
      sql: `SELECT t.*, c.name as category_name, c.kind as category_kind
            FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
            WHERE t.id = ?`,
      args: [Number(insert.lastInsertRowid)],
    });
    return NextResponse.json({ transaction: rowsOf(rs)[0] ?? null }, { status: 201 });
  } catch (err) {
    if (err instanceof LibsqlError && err.code === "SQLITE_CONSTRAINT") {
      return NextResponse.json(
        { error: "A transaction with this exact date, description, and amount already exists." },
        { status: 409 }
      );
    }
    throw err;
  }
}
