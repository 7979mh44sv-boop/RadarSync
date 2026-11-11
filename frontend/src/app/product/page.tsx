import type { Metadata } from "next";
import TimingBoxInfographic from "@/components/infographic/TimingBoxInfographic";
import { ProductSection } from "@/components/product/ProductSections";

export const metadata: Metadata = { title: "Product — RadarSync Timing Box (concept)" };

export default function ProductPage() {
  return (
    <div className="bg-gradient-to-b from-ice/60 to-cloud pt-16">
      <ProductSection afterRender={<TimingBoxInfographic />} />
    </div>
  );
}
