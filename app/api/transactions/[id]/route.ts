import { NextRequest, NextResponse } from "next/server";
import { getDb, rowsOf } from "@/lib/db";
import { PartyKind, PartyRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ROLES: PartyRole[] = ["owner", "borrowed_from", "lent_to", "repaid_to", "repaid_by"];
const VALID_KINDS: PartyKind[] = ["person", "account"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const body = await req.json();

  const sets: string[] = [];
  const args: (string | number | null)[] = [];

  if ("category_id" in body) {
    sets.push("category_id = ?");
    args.push(body.category_id ?? null);
  }
  if ("party" in body && typeof body.party === "string") {
    sets.push("party = ?");
    args.push(body.party.trim() || "Me");
  }
  if ("party_role" in body) {
    if (!VALID_ROLES.includes(body.party_role)) {
      return NextResponse.json({ error: "Invalid party_role" }, { status: 400 });
    }
    sets.push("party_role = ?");
    args.push(body.party_role);
  }
  if ("party_kind" in body) {
    if (!VALID_KINDS.includes(body.party_kind)) {
      return NextResponse.json({ error: "Invalid party_kind" }, { status: 400 });
    }
    sets.push("party_kind = ?");
    args.push(body.party_kind);
  }
  if ("account" in body && typeof body.account === "string") {
    sets.push("account = ?");
    args.push(body.account.trim());
  }
  if ("funded_by" in body && typeof body.funded_by === "string") {
    sets.push("funded_by = ?");
    args.push(body.funded_by.trim());
  }
  if ("date" in body && typeof body.date === "string") {
    sets.push("date = ?");
    args.push(body.date);
  }
  if ("description" in body && typeof body.description === "string") {
    sets.push("description = ?");
    args.push(body.description);
  }
  if ("amount" in body && typeof body.amount === "number") {
    sets.push("amount = ?");
    args.push(body.amount);
  }
  if ("confirmed" in body) {
    sets.push("confirmed = ?");
    args.push(body.confirmed ? 1 : 0);
    sets.push("confirmed_at = ?");
    args.push(body.confirmed ? new Date().toISOString() : null);
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  await db.execute({
    sql: `UPDATE transactions SET ${sets.join(", ")} WHERE id = ?`,
    args: [...args, id],
  });

  const rs = await db.execute({
    sql: `SELECT t.*, c.name as category_name, c.kind as category_kind
          FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
          WHERE t.id = ?`,
    args: [id],
  });

  return NextResponse.json({ transaction: rowsOf(rs)[0] ?? null });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const rs = await db.execute({ sql: `DELETE FROM transactions WHERE id = ?`, args: [id] });
  return NextResponse.json({ deleted: rs.rowsAffected });
}
