import type { Provenance } from "@/lib/api";
import { PROVENANCE_INFO } from "@/lib/scenarios";

export default function ProvenanceBadge({ kind, className = "" }: { kind: Provenance; className?: string }) {
  const info = PROVENANCE_INFO[kind];
  return (
    <span
      title={info.description}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${info.className} ${className}`}
    >
      <span aria-hidden>{info.glyph}</span>
      {info.label}
    </span>
  );
}
