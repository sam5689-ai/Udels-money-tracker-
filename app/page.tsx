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
        <h1 className="text-3xl font-semibold tracking-tight text-violet-950 dark:text-white">
          Track your{" "}
          <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
            income and expenses
          </span>
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-violet-200/60">
          Upload spreadsheets of your bank statements, confirm the category and whose money
          each transaction is (spent, received, lent, borrowed, or moved to savings), then see
          a clear picture of your income and expenses over the past year.
        </p>
      </div>

      {unconfirmed > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
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
          icon={
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14" />
          }
        />
        <Card
          href="/review"
          title="2. Review & confirm"
          description="Set a category, and mark whose money it was — spent, received, lent, borrowed, or moved to savings."
          icon={<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />}
        />
        <Card
          href="/dashboard"
          title="3. Dashboard"
          description="See income vs. expenses for the past year, by month and by category."
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 17V9m4 8V5m4 12v-6M4 20h16"
            />
          }
        />
      </div>

      <p className="text-sm text-violet-900/40 dark:text-violet-200/40">
        {total} transaction{total === 1 ? "" : "s"} imported so far.
      </p>
    </main>
  );
}

function Card({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-3 rounded-3xl border border-violet-100 bg-white p-5 shadow-[0_2px_20px_-6px_rgba(139,92,246,0.15)] transition-shadow hover:shadow-[0_4px_28px_-6px_rgba(139,92,246,0.25)] dark:border-white/10 dark:bg-white/5 dark:shadow-none"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
          {icon}
        </svg>
      </span>
      <div>
        <h2 className="font-semibold text-violet-950 dark:text-white">{title}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-violet-200/60">{description}</p>
      </div>
    </Link>
  );
}
