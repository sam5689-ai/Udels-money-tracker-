import { createHmac, randomUUID, timingSafeEqual } from "crypto";

const SESSION_COOKIE = "session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

let devFallbackSecret: string | null = null;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;
  if (!devFallbackSecret) {
    devFallbackSecret = randomUUID() + randomUUID();
    console.warn(
      "[auth] AUTH_SECRET is not set — using a random secret for this process only. " +
        "Sessions will not survive a restart/redeploy. Set AUTH_SECRET in your environment."
    );
  }
  return devFallbackSecret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createSessionToken(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_DURATION_MS })).toString(
    "base64url"
  );
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

export function checkPassword(candidate: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;

  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Still run a comparison of matching length so failure timing doesn't
    // leak the real password's length.
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

export const AUTH_COOKIE_NAME = SESSION_COOKIE;
