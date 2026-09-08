export type CategoryKind = "income" | "expense" | "loan";

export type PartyRole = "owner" | "borrowed_from" | "lent_to" | "repaid_to" | "repaid_by";

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
  confirmed: number;
  confirmed_at: string | null;
  dedupe_hash: string;
  raw_row: string | null;
  created_at: string;
}

export interface Upload {
  id: number;
  filename: string;
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
