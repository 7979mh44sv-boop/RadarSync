import type { Metadata } from "next";
import { ClosingImpression, PathToHardware, VisionHero, WhyCompany } from "@/components/roadmap/Finale";
import { RoadmapSection } from "@/components/product/ProductSections";

export const metadata: Metadata = { title: "Roadmap & Vision — RadarSync" };

export default function RoadmapPage() {
  return (
    <>
      <VisionHero />
      <PathToHardware />
      <details className="mx-auto w-full max-w-7xl px-6 pb-16">
        <summary className="cursor-pointer text-sm font-semibold uppercase tracking-[0.18em] text-navy">Detailed milestones and engineering risks</summary>
        <div className="-mx-6"><RoadmapSection /></div>
      </details>
      <WhyCompany />
      <ClosingImpression />
    </>
  );
}
