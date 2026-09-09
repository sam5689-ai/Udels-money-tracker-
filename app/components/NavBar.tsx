"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/upload", label: "Upload" },
  { href: "/review", label: "Review" },
  { href: "/categories", label: "Categories" },
  { href: "/dashboard", label: "Dashboard" },
];

export default function NavBar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  if (pathname === "/login") return null;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    // Full navigation, not router.push — guarantees the cleared cookie is
    // in effect for the very next request (see app/login/page.tsx for the
    // same reasoning on the way in).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate, see above
    window.location.href = "/login";
  }

  return (
    <header className="border-b border-violet-100 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-[#150f24]/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          onClick={() => setMenuOpen(false)}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-sm font-bold text-white shadow-sm shadow-violet-300/60 dark:shadow-none">
            U
          </span>
          <span className="text-base font-semibold tracking-tight text-violet-950 dark:text-white">
            Udel&apos;s Money Tracker
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-sm shadow-violet-300/50 dark:shadow-none"
                    : "text-violet-900/60 hover:bg-violet-50 dark:text-violet-200/70 dark:hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="ml-2 rounded-full px-3.5 py-1.5 text-sm font-medium text-violet-900/50 hover:bg-violet-50 dark:text-violet-200/50 dark:hover:bg-white/5"
          >
            Log out
          </button>
        </nav>

        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          className="flex h-10 w-10 items-center justify-center rounded-full text-violet-900/60 hover:bg-violet-50 md:hidden dark:text-violet-200/70 dark:hover:bg-white/5"
        >
          {menuOpen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-violet-100 px-4 py-3 md:hidden dark:border-white/10">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-xl px-3 py-2.5 text-base font-medium ${
                  active
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white"
                    : "text-violet-900/70 hover:bg-violet-50 dark:text-violet-200/70 dark:hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="rounded-xl px-3 py-2.5 text-left text-base font-medium text-violet-900/70 hover:bg-violet-50 dark:text-violet-200/70 dark:hover:bg-white/5"
          >
            Log out
          </button>
        </nav>
      )}
    </header>
  );
}
