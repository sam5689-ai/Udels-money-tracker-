import { createClient, type Client, type ResultSet } from "@libsql/client";
import fs from "fs";
import path from "path";

declare global {
  var __moneyTrackerDbPromise: Promise<Client> | undefined;
}

function createDb(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url) {
    return createClient({ url, authToken });
  }

  // Local dev fallback: a plain SQLite file, no Turso account needed.
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return createClient({ url: `file:${path.join(dataDir, "app.db")}` });
}

async function migrate(db: Client) {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL CHECK (kind IN ('income','expense','loan')),
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      row_count INTEGER NOT NULL DEFAULT 0,
      imported_count INTEGER NOT NULL DEFAULT 0,
      duplicate_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upload_id INTEGER REFERENCES uploads(id) ON DELETE SET NULL,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      party TEXT NOT NULL DEFAULT 'Me',
      party_role TEXT NOT NULL DEFAULT 'owner'
        CHECK (party_role IN ('owner','borrowed_from','lent_to','repaid_to','repaid_by')),
      confirmed INTEGER NOT NULL DEFAULT 0,
      confirmed_at TEXT,
      dedupe_hash TEXT NOT NULL UNIQUE,
      raw_row TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_confirmed ON transactions(confirmed);
    CREATE INDEX IF NOT EXISTS idx_transactions_party ON transactions(party);
  `);
}

const DEFAULT_CATEGORIES: { name: string; kind: "income" | "expense" | "loan"; sort: number }[] = [
  { name: "Salary", kind: "income", sort: 1 },
  { name: "Gift Received", kind: "income", sort: 2 },
  { name: "Refund", kind: "income", sort: 3 },
  { name: "Other Income", kind: "income", sort: 4 },
  { name: "Groceries", kind: "expense", sort: 10 },
  { name: "Rent / Mortgage", kind: "expense", sort: 11 },
  { name: "Bills & Utilities", kind: "expense", sort: 12 },
  { name: "Transport", kind: "expense", sort: 13 },
  { name: "Eating Out", kind: "expense", sort: 14 },
  { name: "Entertainment", kind: "expense", sort: 15 },
  { name: "Health", kind: "expense", sort: 16 },
  { name: "Shopping", kind: "expense", sort: 17 },
  { name: "Subscriptions", kind: "expense", sort: 18 },
  { name: "Travel", kind: "expense", sort: 19 },
  { name: "Other Expense", kind: "expense", sort: 20 },
  { name: "Loan / Borrowing", kind: "loan", sort: 30 },
];

async function seedCategories(db: Client) {
  const count = await db.execute("SELECT COUNT(*) as c FROM categories");
  if ((count.rows[0].c as number) > 0) return;

  await db.batch(
    DEFAULT_CATEGORIES.map((row) => ({
      sql: "INSERT INTO categories (name, kind, sort_order) VALUES (:name, :kind, :sort)",
      args: { name: row.name, kind: row.kind, sort: row.sort },
    })),
    "write"
  );
}

async function initDb(): Promise<Client> {
  const db = createDb();
  await migrate(db);
  await seedCategories(db);
  return db;
}

export function getDb(): Promise<Client> {
  if (!global.__moneyTrackerDbPromise) {
    global.__moneyTrackerDbPromise = initDb();
  }
  return global.__moneyTrackerDbPromise;
}

/** Turns a libSQL ResultSet's rows into plain objects keyed by column name. */
export function rowsOf<T = Record<string, unknown>>(rs: ResultSet): T[] {
  return rs.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const col of rs.columns) obj[col] = row[col];
    return obj as T;
  });
}
