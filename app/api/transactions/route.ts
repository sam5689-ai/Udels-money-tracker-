import { NextRequest, NextResponse } from "next/server";
import { getDb, rowsOf } from "@/lib/db";
import { PartyRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ROLES: PartyRole[] = ["owner", "borrowed_from", "lent_to", "repaid_to", "repaid_by"];

export async function GET(req: NextRequest) {
  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const confirmed = searchParams.get("confirmed");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const search = searchParams.get("search");

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
      confirmed?: boolean;
    };
  };

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }
  if (patch.party_role && !VALID_ROLES.includes(patch.party_role)) {
    return NextResponse.json({ error: "Invalid party_role" }, { status: 400 });
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
