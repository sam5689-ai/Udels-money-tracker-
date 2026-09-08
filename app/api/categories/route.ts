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
      return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    }
    throw err;
  }
}
