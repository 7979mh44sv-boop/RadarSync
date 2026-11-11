import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandMark";
import { NAV_ITEMS } from "./navItems";

export default function SiteFooter() {
  return (
    <footer className="bg-navy px-6 py-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 text-xs text-ice/80 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl space-y-4">
        <BrandLogo />
        <p className="leading-relaxed">
          The RadarSync Timing Box is in development; the hardware has not yet been built. Results shown are simulated from stated assumptions
          and sourced datasheet values. Graphics are original concept illustrations.
        </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-5 uppercase tracking-[0.2em]">
            {NAV_ITEMS.map((n) => <li key={n.href}><Link href={n.href} className="hover:text-white">{n.label}</Link></li>)}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
