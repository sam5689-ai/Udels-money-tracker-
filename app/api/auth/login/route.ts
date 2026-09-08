import { NextRequest, NextResponse } from "next/server";
import { authConfigError, checkPassword, createSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const configError = authConfigError();
  if (configError) {
    return NextResponse.json({ error: `Server misconfigured: ${configError}` }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!checkPassword(password)) {
    return NextResponse.json({ error: "Wrong password. Try again." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
