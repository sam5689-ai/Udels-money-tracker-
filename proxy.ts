import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, authConfigError, verifySessionToken } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const configError = authConfigError();
  if (configError) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: `Server misconfigured: ${configError}` }, { status: 500 });
    }
    return new NextResponse(
      `<!doctype html><meta charset="utf-8"><title>Configuration error</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1.5rem;line-height:1.5">
<h1 style="font-size:1.25rem">Configuration error</h1>
<p>${configError}</p>
<p>See README.md for the environment variables this app needs.</p>
</body>`,
      { status: 500, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  let authenticated = false;
  try {
    authenticated = verifySessionToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  } catch (err) {
    console.error("[proxy] session verification failed:", err);
  }

  if (authenticated) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|login).*)"],
};
