import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { CategoryKind } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_KINDS: CategoryKind[] = ["income", "expense", "loan"];

export async function GET() {
  const db = getDb();
  const categories = db
    .prepare(`SELECT * FROM categories ORDER BY kind, sort_order, name`)
    .all();
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const db = getDb();
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
    const info = db
      .prepare(`INSERT INTO categories (name, kind, sort_order) VALUES (?, ?, 100)`)
      .run(name, kind);
    const category = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(info.lastInsertRowid);
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    }
    throw err;
  }
}
