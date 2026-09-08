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

By default (no environment variables set) data is stored locally in a
SQLite file at `data/app.db` (created automatically, gitignored) — nothing
else to set up for local development.

## Deploying (Vercel, or any serverless host)

Vercel's serverless functions don't have a persistent local disk, so the
app needs a hosted database in production. It uses
[Turso](https://turso.tech) (hosted libSQL, which speaks the SQLite dialect
this app already uses) via [`@libsql/client`](https://github.com/tursodatabase/libsql-client-ts).

1. Install the Turso CLI and sign up: `curl -sSfL https://get.tur.so/install.sh | bash`
2. Create a database and grab its URL + a token:
   ```bash
   turso db create udels-money-tracker
   turso db show udels-money-tracker --url
   turso db tokens create udels-money-tracker
   ```
3. In your Vercel project settings, add two environment variables:
   - `TURSO_DATABASE_URL` — the `libsql://...` URL from step 2
   - `TURSO_AUTH_TOKEN` — the token from step 2
4. Redeploy. Tables and default categories are created automatically on
   first request — no separate migration step.

Locally, leave those two variables unset and the app keeps using the
`data/app.db` file — the same `lib/db.ts` code path handles both.

## Access control

This holds real financial data, so the whole app sits behind a single
shared password (see `proxy.ts`) — there's no per-user accounts, just one
password gating everything. Set two more environment variables (locally in
`.env.local`, and in Vercel project settings for production):

- `APP_PASSWORD` — the password you'll type to sign in at `/login`
- `AUTH_SECRET` — a long random string used to sign the session cookie.
  Generate one with `openssl rand -base64 32`

Without `AUTH_SECRET` set, the app falls back to a random secret generated
per-process, which is fine for a one-off local `npm run dev` session but
means everyone gets logged out on every restart/redeploy — set a real one
before deploying. Without `APP_PASSWORD` set, sign-in is rejected outright
(there's nothing to check the password against), so the app is effectively
locked — that's intentional rather than falling back to "no password
required".

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- [Turso / libSQL](https://turso.tech) (`@libsql/client`) for storage —
  works both as a local SQLite file (dev) and a hosted serverless-friendly
  database (production)
- [exceljs](https://github.com/exceljs/exceljs) for `.xlsx` parsing, a small
  built-in parser for CSV
- [Recharts](https://recharts.org) for the dashboard charts
