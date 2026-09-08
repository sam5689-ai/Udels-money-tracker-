import crypto from "crypto";

export function dedupeHash(date: string, description: string, amount: number): string {
  const normalizedDesc = description.trim().toLowerCase().replace(/\s+/g, " ");
  const normalizedAmount = amount.toFixed(2);
  return crypto
    .createHash("sha256")
    .update(`${date}|${normalizedDesc}|${normalizedAmount}`)
    .digest("hex");
}
