import { createHmac, randomUUID, timingSafeEqual } from "crypto";

const SESSION_COOKIE = "session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

let devFallbackSecret: string | null = null;

// Vercel (and most serverless hosts) run multiple parallel instances of the
// app. A per-process random fallback secret is actively dangerous there:
// instance A signs a cookie, instance B can't verify it, and the visible
// symptom is a confusing "keeps bouncing back to /login" loop instead of a
// clear error. So the fallback is local-dev only — anywhere that looks like
// a real deployment must have a real AUTH_SECRET or auth simply refuses to
// work, loudly, rather than working sometimes.
const isDeployed = Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;

  if (isDeployed) {
    throw new Error(
      "AUTH_SECRET is not set. Set it as an environment variable (see README.md) — " +
        "without it, sessions can't be verified consistently across serverless instances."
    );
  }

  if (!devFallbackSecret) {
    devFallbackSecret = randomUUID() + randomUUID();
    console.warn(
      "[auth] AUTH_SECRET is not set — using a random secret for this local process only. " +
        "Sessions will not survive a restart. Set AUTH_SECRET before deploying."
    );
  }
  return devFallbackSecret;
}

export function authConfigError(): string | null {
  if (!process.env.APP_PASSWORD) return "APP_PASSWORD is not set.";
  if (isDeployed && !process.env.AUTH_SECRET) return "AUTH_SECRET is not set.";
  return null;
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
