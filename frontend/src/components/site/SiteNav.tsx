"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import BackendStatus from "@/components/BackendStatus";
import { BrandLogo } from "@/components/brand/BrandMark";
import { NAV_ITEMS, isActive } from "./navItems";

export default function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    // Close the mobile menu after navigation (state adjusted during render, no effect needed).
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const linkCls = (active: boolean) =>
    `transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline underline-offset-8 ${
      active ? "text-white underline decoration-aurora decoration-2" : "text-ice hover:text-white"
    }`;

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-navy/95 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6">
        <Link href="/" aria-label="RadarSync home" aria-current={isActive(pathname, "/") ? "page" : undefined}
          className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora">
          <BrandLogo />
        </Link>
        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex gap-8 text-xs font-medium uppercase tracking-[0.22em]">
            {NAV_ITEMS.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <li key={n.href}>
                  <Link href={n.href} aria-current={active ? "page" : undefined} className={linkCls(active)}>{n.label}</Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="hidden lg:block"><BackendStatus /></div>
        <button type="button" className="rounded-md border border-white/20 px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-white md:hidden"
          aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-white/10 bg-navy md:hidden">
          <ul className="mx-auto flex max-w-7xl flex-col px-6 py-4 text-sm font-medium uppercase tracking-[0.22em]">
            {NAV_ITEMS.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <li key={n.href}>
                  <Link href={n.href} aria-current={active ? "page" : undefined} className={`block py-3 ${linkCls(active)}`}>{n.label}</Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
