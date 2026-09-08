import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { PartyRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ROLES: PartyRole[] = ["owner", "borrowed_from", "lent_to", "repaid_to", "repaid_by"];

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const confirmed = searchParams.get("confirmed");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const search = searchParams.get("search");

  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (confirmed === "0" || confirmed === "1") {
    clauses.push("t.confirmed = @confirmed");
    params.confirmed = Number(confirmed);
  }
  if (from) {
    clauses.push("t.date >= @from");
    params.from = from;
  }
  if (to) {
    clauses.push("t.date <= @to");
    params.to = to;
  }
  if (search) {
    clauses.push("t.description LIKE @search");
    params.search = `%${search}%`;
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const rows = db
    .prepare(
      `SELECT t.*, c.name as category_name, c.kind as category_kind
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       ${where}
       ORDER BY t.date DESC, t.id DESC`
    )
    .all(params);

  return NextResponse.json({ transactions: rows });
}

export async function PATCH(req: NextRequest) {
  const db = getDb();
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
  const params: Record<string, unknown> = {};

  if ("category_id" in patch) {
    sets.push("category_id = @category_id");
    params.category_id = patch.category_id;
  }
  if ("party" in patch && typeof patch.party === "string") {
    sets.push("party = @party");
    params.party = patch.party.trim() || "Me";
  }
  if ("party_role" in patch && patch.party_role) {
    sets.push("party_role = @party_role");
    params.party_role = patch.party_role;
  }
  if ("confirmed" in patch) {
    sets.push("confirmed = @confirmed");
    params.confirmed = patch.confirmed ? 1 : 0;
    sets.push("confirmed_at = @confirmed_at");
    params.confirmed_at = patch.confirmed ? new Date().toISOString() : null;
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const placeholders = ids.map((_, i) => `@id${i}`).join(",");
  ids.forEach((id, i) => (params[`id${i}`] = id));

  const stmt = db.prepare(
    `UPDATE transactions SET ${sets.join(", ")} WHERE id IN (${placeholders})`
  );
  const info = stmt.run(params);

  return NextResponse.json({ updated: info.changes });
}
