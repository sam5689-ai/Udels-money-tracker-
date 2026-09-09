import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getDb, rowsOf } from "@/lib/db";
import { computeSummary, defaultRange } from "@/lib/summary";
import { PARTY_ROLE_LABELS, PartyKind, PartyRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TxRow {
  date: string;
  description: string;
  amount: number;
  category_name: string | null;
  category_kind: string | null;
  party: string;
  party_role: PartyRole;
  party_kind: PartyKind;
  confirmed: number;
}

const CURRENCY_FORMAT = '£#,##0.00;[Red]-£#,##0.00';

function whoseMoneyLabel(role: PartyRole, kind: PartyKind): string {
  if (kind === "account") {
    if (role === "lent_to") return "Moved to savings";
    if (role === "repaid_by") return "Moved from savings";
  }
  return PARTY_ROLE_LABELS[role];
}

export async function GET(req: NextRequest) {
  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const { from, to } = defaultRange(searchParams);

  const summary = await computeSummary(db, from, to);

  const txRs = await db.execute({
    sql: `SELECT t.date, t.description, t.amount, c.name as category_name, c.kind as category_kind,
                 t.party, t.party_role, t.party_kind, t.confirmed
          FROM transactions t
          LEFT JOIN categories c ON c.id = t.category_id
          WHERE t.date >= ? AND t.date <= ?
          ORDER BY t.date ASC, t.id ASC`,
    args: [from, to],
  });
  const transactions = rowsOf<TxRow>(txRs);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Udel's Money Tracker";
  workbook.created = new Date();

  // --- Summary sheet ---
  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "", key: "label", width: 28 },
    { header: "", key: "value", width: 20 },
  ];
  summarySheet.addRows([
    { label: "Report period", value: `${summary.range.from} to ${summary.range.to}` },
    { label: "", value: "" },
    { label: "Total income", value: summary.totals.income },
    { label: "Total expenses", value: summary.totals.expenses },
    { label: "Net", value: summary.totals.net },
    { label: "", value: "" },
    { label: "Unconfirmed transactions", value: summary.unconfirmedCount },
  ]);
  ["B3", "B4", "B5"].forEach((cell) => (summarySheet.getCell(cell).numFmt = CURRENCY_FORMAT));
  summarySheet.getColumn("label").font = { bold: true };

  // --- Monthly sheet ---
  const monthlySheet = workbook.addWorksheet("Monthly");
  monthlySheet.columns = [
    { header: "Month", key: "month", width: 12 },
    { header: "Income", key: "income", width: 16 },
    { header: "Expenses", key: "expenses", width: 16 },
    { header: "Net", key: "net", width: 16 },
  ];
  monthlySheet.addRows(summary.monthly);
  ["income", "expenses", "net"].forEach((key) => {
    monthlySheet.getColumn(key).numFmt = CURRENCY_FORMAT;
  });
  monthlySheet.getRow(1).font = { bold: true };

  // --- By category sheet ---
  const categorySheet = workbook.addWorksheet("By Category");
  categorySheet.columns = [
    { header: "Category", key: "category", width: 24 },
    { header: "Type", key: "kind", width: 12 },
    { header: "Total", key: "total", width: 16 },
  ];
  categorySheet.addRows(summary.byCategory);
  categorySheet.getColumn("total").numFmt = CURRENCY_FORMAT;
  categorySheet.getRow(1).font = { bold: true };

  // --- Loans sheet ---
  const loansSheet = workbook.addWorksheet("Loans");
  loansSheet.columns = [
    { header: "Person", key: "party", width: 20 },
    { header: "You owe them", key: "youOweThem", width: 16 },
    { header: "They owe you", key: "theyOweYou", width: 16 },
    { header: "Net", key: "net", width: 16 },
  ];
  loansSheet.addRows(summary.loans);
  ["youOweThem", "theyOweYou", "net"].forEach((key) => {
    loansSheet.getColumn(key).numFmt = CURRENCY_FORMAT;
  });
  loansSheet.getRow(1).font = { bold: true };

  // --- Accounts sheet (transfers to/from other accounts you own) ---
  const accountsSheet = workbook.addWorksheet("Accounts");
  accountsSheet.columns = [
    { header: "Account", key: "party", width: 20 },
    { header: "Moved out", key: "movedOut", width: 16 },
    { header: "Moved back", key: "movedBack", width: 16 },
  ];
  accountsSheet.addRows(summary.accounts);
  ["movedOut", "movedBack"].forEach((key) => {
    accountsSheet.getColumn(key).numFmt = CURRENCY_FORMAT;
  });
  accountsSheet.getRow(1).font = { bold: true };

  // --- Transactions sheet ---
  const txSheet = workbook.addWorksheet("Transactions");
  txSheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Description", key: "description", width: 36 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Category", key: "category", width: 20 },
    { header: "Whose money", key: "whoseMoney", width: 24 },
    { header: "Person / Account", key: "person", width: 18 },
    { header: "Confirmed", key: "confirmed", width: 12 },
  ];
  txSheet.addRows(
    transactions.map((t) => ({
      date: t.date,
      description: t.description,
      amount: t.amount,
      category: t.category_name || "Uncategorized",
      whoseMoney: whoseMoneyLabel(t.party_role, t.party_kind),
      person: t.party_role === "owner" ? "" : t.party,
      confirmed: t.confirmed ? "Yes" : "No",
    }))
  );
  txSheet.getColumn("amount").numFmt = CURRENCY_FORMAT;
  txSheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="money-tracker-report-${from}-to-${to}.xlsx"`,
    },
  });
}
