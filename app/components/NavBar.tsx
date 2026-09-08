"use client";

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
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Udel&apos;s Money Tracker
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="ml-2 rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            Log out
          </button>
        </nav>
      </div>
    </header>
  );
}
