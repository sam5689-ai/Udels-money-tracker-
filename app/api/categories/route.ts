import { NextRequest, NextResponse } from "next/server";
import { LibsqlError } from "@libsql/client";
import { getDb, rowsOf } from "@/lib/db";
import { CategoryKind } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_KINDS: CategoryKind[] = ["income", "expense", "loan"];

export async function GET() {
  const db = await getDb();
  const rs = await db.execute(`SELECT * FROM categories ORDER BY kind, sort_order, name`);
  return NextResponse.json({ categories: rowsOf(rs) });
}

export async function POST(req: NextRequest) {
  const db = await getDb();
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const kind = body.kind as CategoryKind;

  if (!name) {
    return NextResponse.json({ error: "Category name is required" }, { status: 400 });
  }
  if (!VALID_KINDS.includes(kind)) {
    return NextResponse.json({ error: "kind must be income, expense, or loan" }, { status: 400 });
  }

  // Typing a name that already exists (regardless of case — SQLite's UNIQUE
  // constraint is case-sensitive by default, so "Groceries" and "groceries"
  // would otherwise both insert fine) should resolve to the existing
  // category rather than create a near-duplicate.
  const existing = await db.execute({
    sql: `SELECT * FROM categories WHERE name = ? COLLATE NOCASE`,
    args: [name],
  });
  const existingCategory = rowsOf(existing)[0];
  if (existingCategory) {
    return NextResponse.json({ category: existingCategory });
  }

  try {
    const insert = await db.execute({
      sql: `INSERT INTO categories (name, kind, sort_order) VALUES (?, ?, 100)`,
      args: [name, kind],
    });
    const rs = await db.execute({
      sql: `SELECT * FROM categories WHERE id = ?`,
      args: [Number(insert.lastInsertRowid)],
    });
    return NextResponse.json({ category: rowsOf(rs)[0] ?? null }, { status: 201 });
  } catch (err) {
    if (err instanceof LibsqlError && err.code === "SQLITE_CONSTRAINT") {
      // Lost a race with a concurrent insert of the same name — look it up
      // again rather than erroring.
      const rs = await db.execute({
        sql: `SELECT * FROM categories WHERE name = ? COLLATE NOCASE`,
        args: [name],
      });
      const category = rowsOf(rs)[0];
      if (category) {
        return NextResponse.json({ category });
      }
      return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    }
    throw err;
  }
}
