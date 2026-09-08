import { NextRequest, NextResponse } from "next/server";
import { LibsqlError } from "@libsql/client";
import { getDb, rowsOf } from "@/lib/db";
import { CategoryKind } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_KINDS: CategoryKind[] = ["income", "expense", "loan"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const body = await req.json();

  const sets: string[] = [];
  const args: (string | number)[] = [];

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }
    sets.push("name = ?");
    args.push(name);
  }
  if ("kind" in body) {
    if (!VALID_KINDS.includes(body.kind)) {
      return NextResponse.json({ error: "kind must be income, expense, or loan" }, { status: 400 });
    }
    sets.push("kind = ?");
    args.push(body.kind);
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    await db.execute({
      sql: `UPDATE categories SET ${sets.join(", ")} WHERE id = ?`,
      args: [...args, id],
    });
  } catch (err) {
    if (err instanceof LibsqlError && err.code === "SQLITE_CONSTRAINT") {
      return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    }
    throw err;
  }

  const rs = await db.execute({
    sql: `SELECT c.*, COUNT(t.id) as usage_count
          FROM categories c LEFT JOIN transactions t ON t.category_id = c.id
          WHERE c.id = ? GROUP BY c.id`,
    args: [id],
  });
  return NextResponse.json({ category: rowsOf(rs)[0] ?? null });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();

  // Transactions using this category become uncategorized rather than left
  // pointing at a row that no longer exists.
  await db.execute({
    sql: `UPDATE transactions SET category_id = NULL WHERE category_id = ?`,
    args: [id],
  });
  const rs = await db.execute({ sql: `DELETE FROM categories WHERE id = ?`, args: [id] });

  return NextResponse.json({ deleted: rs.rowsAffected });
}
