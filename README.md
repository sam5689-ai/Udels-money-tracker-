# Udel's Money Tracker

Upload spreadsheets of your bank statements, confirm the category and whose
money each transaction is (yours, borrowed, or lent), and see a clear picture
of your income and expenses.

## How it works

1. **Upload** — Drop in CSV or Excel (`.xlsx`) exports of your bank
   statements on the `/upload` page. Date, description and amount columns
   (or separate paid-in/paid-out columns) are detected automatically, and
   transactions you've already imported are skipped.
2. **Review** — On `/review`, confirm a category for each transaction and
   mark whose money it was: your own, borrowed from someone, lent to
   someone, or a repayment either way. Only confirmed transactions count
   towards totals.
3. **Dashboard** — `/dashboard` shows income vs. expenses by month, a
   breakdown by category, and a running "who owes who" balance for any
   loans.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Data is stored locally in a SQLite database at `data/app.db` (created
automatically, gitignored).

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) for storage
- [exceljs](https://github.com/exceljs/exceljs) for `.xlsx` parsing, a small
  built-in parser for CSV
- [Recharts](https://recharts.org) for the dashboard charts
