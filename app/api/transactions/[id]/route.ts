import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { PartyRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ROLES: PartyRole[] = ["owner", "borrowed_from", "lent_to", "repaid_to", "repaid_by"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();

  const sets: string[] = [];
  const values: Record<string, unknown> = { id };

  if ("category_id" in body) {
    sets.push("category_id = @category_id");
    values.category_id = body.category_id;
  }
  if ("party" in body && typeof body.party === "string") {
    sets.push("party = @party");
    values.party = body.party.trim() || "Me";
  }
  if ("party_role" in body) {
    if (!VALID_ROLES.includes(body.party_role)) {
      return NextResponse.json({ error: "Invalid party_role" }, { status: 400 });
    }
    sets.push("party_role = @party_role");
    values.party_role = body.party_role;
  }
  if ("date" in body && typeof body.date === "string") {
    sets.push("date = @date");
    values.date = body.date;
  }
  if ("description" in body && typeof body.description === "string") {
    sets.push("description = @description");
    values.description = body.description;
  }
  if ("amount" in body && typeof body.amount === "number") {
    sets.push("amount = @amount");
    values.amount = body.amount;
  }
  if ("confirmed" in body) {
    sets.push("confirmed = @confirmed");
    values.confirmed = body.confirmed ? 1 : 0;
    sets.push("confirmed_at = @confirmed_at");
    values.confirmed_at = body.confirmed ? new Date().toISOString() : null;
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  db.prepare(`UPDATE transactions SET ${sets.join(", ")} WHERE id = @id`).run(values);

  const updated = db
    .prepare(
      `SELECT t.*, c.name as category_name, c.kind as category_kind
       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.id = ?`
    )
    .get(id);

  return NextResponse.json({ transaction: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const info = db.prepare(`DELETE FROM transactions WHERE id = ?`).run(id);
  return NextResponse.json({ deleted: info.changes });
}
