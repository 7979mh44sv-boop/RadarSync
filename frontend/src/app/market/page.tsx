import type { Metadata } from "next";
import { BusinessModelCanvas, MarketEntry, RevenueModel } from "@/components/product/BusinessModel";
import { Band, CustomerSection } from "@/components/product/ProductSections";
import ValueChain from "@/components/product/ValueChain";

export const metadata: Metadata = { title: "Market & Buyer Value — RadarSync" };

export default function MarketPage() {
  return (
    <div className="pt-16">
      <div className="bg-gradient-to-b from-ice/60 to-cloud"><CustomerSection /></div>
      <Band id="value-chain" kicker="Buyer value" title="From research to buyer value."
        lead="Research → Customer problem → Hardware capability → Simulated evidence → Buyer benefit → Remaining validation.">
        <ValueChain />
      </Band>
      <div className="border-t border-ice">
        <Band id="business-model" kicker="Business model" title="Our business model."
          lead="Hardware at the core. Services and software around it.">
          <BusinessModelCanvas />
        </Band>
      </div>
      <div className="border-t border-ice">
        <Band id="revenue" kicker="Revenue model" title="Three revenue streams."
          lead="Hardware. Integration. Software. One scalable business model.">
          <RevenueModel />
        </Band>
      </div>
      <div className="border-t border-ice">
        <Band id="entry" kicker="Entry strategy" title="Start narrow. Then grow."
          lead="Begin where timing decisions are made early: distributed SAR missions.">
          <MarketEntry />
        </Band>
      </div>
    </div>
  );
}
