import crypto from "crypto";

// `account` is included (when given) so the same date+description+amount
// on two different real accounts (plausible once you're importing from
// several banks) is never mistaken for a re-uploaded duplicate of the
// same statement. The account segment is only appended when non-empty —
// with it left blank this produces byte-identical output to before
// account tagging existed, so hashes already stored for transactions
// imported before this feature keep matching on re-upload.
export function dedupeHash(date: string, description: string, amount: number, account: string = ""): string {
  const normalizedDesc = description.trim().toLowerCase().replace(/\s+/g, " ");
  const normalizedAmount = amount.toFixed(2);
  const normalizedAccount = account.trim().toLowerCase();
  const base = `${date}|${normalizedDesc}|${normalizedAmount}`;
  return crypto
    .createHash("sha256")
    .update(normalizedAccount ? `${base}|${normalizedAccount}` : base)
    .digest("hex");
}
