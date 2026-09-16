"use client";

import { useState } from "react";
import Link from "next/link";

export function NavBar({ isLoggedIn, isAdmin }: { isLoggedIn: boolean; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const links = [
    ...(isLoggedIn ? [{ href: "/spela", label: "Spela" }] : []),
    { href: "/ligor", label: "Ligor" },
    { href: "/scoreboard", label: "Scoreboard" },
    { href: "/regler", label: "Regler" },
    ...(isLoggedIn && isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
    ...(isLoggedIn ? [{ href: "/installningar", label: "Inställningar" }] : []),
  ];

  return (
    <header className="relative border-b-4 border-ssk-yellow bg-ssk-navy text-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" onClick={close} className="flex items-center gap-2 font-bold text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ssk-logo.svg" alt="SSK" className="h-7 w-7" />
          SSK-femman
          <span
            className="rounded bg-ssk-yellow px-1.5 py-0.5 text-[10px] font-extrabold uppercase leading-none tracking-wide text-ssk-navy"
            title="Spelet är i beta — allt kanske inte fungerar 100 % än."
          >
            Beta
          </span>
        </Link>

        {/* Desktop-meny */}
        <div className="hidden items-center gap-4 text-sm sm:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-white/90 hover:text-ssk-yellow">
              {l.label}
            </Link>
          ))}
          {isLoggedIn ? (
            <form action="/auth/signout" method="post">
              <button className="text-white/60 hover:text-white">Logga ut</button>
            </form>
          ) : (
            <Link href="/login" className="btn-primary text-sm">Logga in</Link>
          )}
        </div>

        {/* Hamburgare (mobil) */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Meny"
          aria-expanded={open}
          className="inline-flex items-center justify-center rounded-md p-2 text-white hover:bg-white/10 sm:hidden"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? (
              <>
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="6" y1="18" x2="18" y2="6" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </nav>

      {/* Mobil dropdown */}
      {open && (
        <div className="border-t border-white/10 bg-ssk-navy sm:hidden">
          <div className="mx-auto flex max-w-5xl flex-col px-4 py-2 text-base">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={close}
                className="rounded px-2 py-2.5 text-white/90 hover:bg-white/10 hover:text-ssk-yellow"
              >
                {l.label}
              </Link>
            ))}
            {isLoggedIn ? (
              <form action="/auth/signout" method="post" className="px-2 py-2.5">
                <button className="text-white/70 hover:text-white">Logga ut</button>
              </form>
            ) : (
              <Link
                href="/login"
                onClick={close}
                className="mt-1 rounded px-2 py-2.5 font-semibold text-ssk-yellow hover:bg-white/10"
              >
                Logga in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
