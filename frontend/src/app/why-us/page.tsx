import type { Metadata } from "next";
import Link from "next/link";
import { Band, MissionSection, ProblemSection, WhyItMattersSection, WhyUsSection } from "@/components/product/ProductSections";

export const metadata: Metadata = { title: "Why — RadarSync" };

export default function WhyUsPage() {
  return (
    <div className="pt-16">
      <header className="mx-auto w-full max-w-7xl px-6 pt-12 sm:pt-16">
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.4em] text-signal">01 · Why us</p>
        <div aria-hidden className="mt-4 h-px w-full bg-gradient-to-r from-signal/60 via-ice to-transparent" />
      </header>
      <ProblemSection />
      <div className="border-t border-ice"><MissionSection /></div>
      <div className="border-t border-ice"><WhyItMattersSection /></div>
      <div className="border-t border-ice">
        <Band id="vision-short" kicker="Long-term vision" title="One timing backbone."
          lead="Our vision extends beyond satellite radar: one timing platform for distributed sensing, starting in orbit.">
          <Link href="/roadmap" className="text-sm uppercase tracking-[0.2em] text-accent hover:text-navy">See the roadmap →</Link>
        </Band>
      </div>
      <div className="border-t border-ice"><WhyUsSection /></div>
    </div>
  );
}
