import type { Metadata } from "next";
import Dashboard from "@/components/Dashboard";
import { Band, ScienceIntro, ValidationSection } from "@/components/product/ProductSections";
import ModelScope from "@/components/story/ModelScope";
import ResearchContext from "@/components/story/ResearchContext";

export const metadata: Metadata = { title: "Science & Live Demo — RadarSync" };

export default function SciencePage() {
  return (
    <div className="pt-16">
      <ScienceIntro />
      <main className="relative z-10 -mt-10">
        <Dashboard />
      </main>
      <div className="border-t border-ice"><ValidationSection /></div>
      <Band id="research" kicker="References" title="Limits and sources.">
        <ModelScope />
        <details className="mt-6 rounded-2xl border border-ice p-4">
          <summary className="cursor-pointer font-semibold text-navy">Related research on coherent distributed radar</summary>
          <div className="mt-4"><ResearchContext /></div>
        </details>
      </Band>
    </div>
  );
}
