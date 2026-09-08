import Link from "next/link";
import { getDb, rowsOf } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getStats() {
  const db = await getDb();
  const unconfirmedRs = await db.execute(
    `SELECT COUNT(*) as c FROM transactions WHERE confirmed = 0`
  );
  const totalRs = await db.execute(`SELECT COUNT(*) as c FROM transactions`);
  return {
    unconfirmed: Number(rowsOf<{ c: number }>(unconfirmedRs)[0].c),
    total: Number(rowsOf<{ c: number }>(totalRs)[0].c),
  };
}

export default async function Home() {
  const { unconfirmed, total } = await getStats();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Track your income and expenses
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Upload spreadsheets of your bank statements, confirm the category and whose money
          each transaction is (yours, borrowed, or lent), then see a clear picture of your
          income and expenses over the past year.
        </p>
      </div>

      {unconfirmed > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          You have <strong>{unconfirmed}</strong> transaction{unconfirmed === 1 ? "" : "s"} waiting
          to be reviewed.{" "}
          <Link href="/review" className="font-medium underline underline-offset-2">
            Review now
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card
          href="/upload"
          title="1. Upload"
          description="Import CSV or Excel exports of your bank statements."
        />
        <Card
          href="/review"
          title="2. Review & confirm"
          description="Set a category for each transaction, and mark whose money it was — yours, borrowed, or lent."
        />
        <Card
          href="/dashboard"
          title="3. Dashboard"
          description="See income vs. expenses for the past year, by month and by category."
        />
      </div>

      <p className="text-sm text-zinc-500 dark:text-zinc-500">
        {total} transaction{total === 1 ? "" : "s"} imported so far.
      </p>
    </main>
  );
}

function Card({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
    </Link>
  );
}
