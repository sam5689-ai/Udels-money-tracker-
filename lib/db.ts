import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app.db");

declare global {
  var __moneyTrackerDb: Database.Database | undefined;
}

function createDb(): Database.Database {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seedCategories(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
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

function seedCategories(db: Database.Database) {
  const count = db.prepare("SELECT COUNT(*) as c FROM categories").get() as { c: number };
  if (count.c > 0) return;
  const insert = db.prepare(
    "INSERT INTO categories (name, kind, sort_order) VALUES (@name, @kind, @sort)"
  );
  const insertMany = db.transaction((rows: typeof DEFAULT_CATEGORIES) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(DEFAULT_CATEGORIES);
}

export function getDb(): Database.Database {
  if (!global.__moneyTrackerDb) {
    global.__moneyTrackerDb = createDb();
  }
  return global.__moneyTrackerDb;
}
