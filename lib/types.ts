export type CategoryKind = "income" | "expense" | "loan";

export type PartyRole = "owner" | "borrowed_from" | "lent_to" | "repaid_to" | "repaid_by";

// Whether `party` names another person (for loans/IOUs) or one of the
// user's own accounts (for transfers to/from savings, ISAs, etc.). Reuses
// the exact same lent_to/repaid_by sign-derived PartyRole pair either way —
// "money lent to Savings" and "money lent to Jordan" have identical
// running-balance math, they just mean different things and belong in
// different UI buckets.
export type PartyKind = "person" | "account";

export interface Category {
  id: number;
  name: string;
  kind: CategoryKind;
  sort_order: number;
}

export interface Transaction {
  id: number;
  upload_id: number | null;
  date: string;
  description: string;
  amount: number;
  category_id: number | null;
  party: string;
  party_role: PartyRole;
  party_kind: PartyKind;
  // Which of YOUR OWN accounts (Halifax, Revolut, Wise, ...) this
  // transaction happened in — set when uploading a statement, distinct
  // from `party`, which names the OTHER side of a loan/transfer. Blank
  // for transactions imported before this existed, or entered manually
  // without picking one.
  account: string;
  confirmed: number;
  confirmed_at: string | null;
  dedupe_hash: string;
  raw_row: string | null;
  created_at: string;
}

export interface Upload {
  id: number;
  filename: string;
  account: string;
  uploaded_at: string;
  row_count: number;
  imported_count: number;
  duplicate_count: number;
}

export const PARTY_ROLE_LABELS: Record<PartyRole, string> = {
  owner: "My own money",
  borrowed_from: "Borrowed from",
  lent_to: "Lent to",
  repaid_to: "Repayment I made to",
  repaid_by: "Repayment I received from",
};
