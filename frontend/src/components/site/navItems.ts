export const NAV_ITEMS = [
  { href: "/why-us", label: "Why" },
  { href: "/product", label: "Product" },
  { href: "/science", label: "Science" },
  { href: "/market", label: "Market" },
  { href: "/roadmap", label: "Roadmap" },
] as const;

/** True when `href` is the current route (exact match; "/" only matches the homepage). */
export function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  const clean = pathname.replace(/\/+$/, "") || "/";
  return href === "/" ? clean === "/" : clean === href || clean.startsWith(`${href}/`);
}
