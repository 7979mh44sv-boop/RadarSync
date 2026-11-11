"use client";

import { StatusBlock } from "@/components/Panel";
import ProvenanceBadge from "@/components/ProvenanceBadge";
import type { RequirementsResponse } from "@/lib/api";
import { formatDb, formatSci } from "@/lib/format";
import { deriveKeyInsight } from "@/lib/insight";
import { useDefaultInsight } from "@/lib/defaultInsight";

export const CHAIN_STEPS = ["Research", "Customer problem", "Hardware capability", "Simulated evidence", "Buyer benefit", "Remaining validation"] as const;
type Kind = "sourced" | "simulated" | "hypothesis" | "proposed" | "gap";
const KIND: Record<Kind, string> = {
  sourced: "SOURCED", simulated: "SIMULATED", hypothesis: "HYPOTHESIS", proposed: "PROPOSED", gap: "TO VALIDATE",
};
const KIND_CLS: Record<Kind, string> = {
  sourced: "border-slate-300/60 text-slate-700",
  simulated: "border-accent/60 text-accent",
  hypothesis: "border-dotted border-violet-500 text-violet-700",
  proposed: "border-dashed border-slate-400 text-slate-600",
  gap: "border-warning/60 text-warning",
};

export interface ChainCell { text: string; kind: Kind }
export type ChainRow = { title: string; cells: ChainCell[] };

/** Build the chain; every simulated number comes from the live requirement response. */
export function buildValueChain(data: RequirementsResponse): ChainRow[] {
  const ins = deriveKeyInsight(data);
  const req = ins.requirementRange ? `σy(1 s) ≤ ${formatSci(ins.requirementRange[0])}…${formatSci(ins.requirementRange[1])}` : "no requirement determined in range";
  return [
    {
      title: "Coherence needs a quantified clock specification",
      cells: [
        { kind: "simulated", text: `Under default assumptions, ≤ ${formatDb(ins.targetDb)} ${ins.metric} loss needs ${req}, depending on the clock's noise shape.` },
        { kind: "hypothesis", text: "Mission teams must decide which clock stability their radar formation needs before committing to hardware." },
        { kind: "proposed", text: "Timing Box with a characterised clock core plus a timing-budget tool built on the RadarSync models." },
        { kind: "simulated", text: `Requirement solver result: ${req} (approximate Monte Carlo bracket per shape in panel F).` },
        { kind: "hypothesis", text: "Specify the clock from the coherence target instead of over- or under-buying." },
        { kind: "gap", text: "Customer coherence targets, geometries and carrier choices are not yet confirmed." },
      ],
    },
    {
      title: "Today's commercial CSAC decorrelates at X-band",
      cells: [
        { kind: "sourced", text: "Microchip SA65 datasheet: σy(1 s) = 3×10⁻¹⁰; the commercial part is not rated for space, a space option is listed." },
        { kind: "hypothesis", text: "Compact, low-power clocks that keep separate radar satellites phase-coherent are not readily available." },
        { kind: "proposed", text: "A space-oriented Timing Box designed around a next-generation clock core." },
        { kind: "simulated", text: ins.sa65AtSpecDb !== null ? `The SA65 model at datasheet stability reaches ${formatDb(ins.sa65AtSpecDb)} ${ins.metric} loss (random-phase ceiling ${formatDb(data.loss_ceiling_db)}).` : "SA65 result not included in this run." },
        { kind: "hypothesis", text: "A path to coherent multi-satellite radar without large, power-hungry laboratory clocks." },
        { kind: "gap", text: "NextGen CSAC is hypothetical challenge technology; radiation and thermal-vacuum behaviour untested." },
      ],
    },
    {
      title: "Clock improvement helps only until non-clock errors dominate",
      cells: [
        { kind: "simulated", text: `Below σy(1 s) ≈ ${ins.floorDominatedBelow ? formatSci(ins.floorDominatedBelow) : "—"} the clock causes < ${Math.round(ins.shareThreshold * 100)} % of timing-error variance; loss sits on the ${formatDb(ins.floorDb)} non-clock floor.` },
        { kind: "hypothesis", text: "Integrators risk paying for clock stability that calibration or link errors make useless." },
        { kind: "proposed", text: "Calibration & sync software that reports whether clock or non-clock errors limit coherence." },
        { kind: "simulated", text: `The hypothetical NextGen models reach ${ins.nextgenAtSpecDb.length ? ins.nextgenAtSpecDb.map(formatDb).join(" / ") : "—"}, i.e. the floor: no extra benefit at 1 s synchronisation.` },
        { kind: "hypothesis", text: "Right-size the timing budget across clock, calibration and synchronisation." },
        { kind: "gap", text: "Real calibration and inter-satellite link error budgets are assumptions." },
      ],
    },
    {
      title: "Longer intervals between synchronisation updates",
      cells: [
        { kind: "simulated", text: "In the sensitivity sweep (panel G), weaker clocks lose coherence as the synchronisation interval grows (simulated up to 100 s)." },
        { kind: "hypothesis", text: "Inter-satellite synchronisation opportunities may be limited or interrupted." },
        { kind: "proposed", text: "High-stability holdover between synchronisation updates, with holdover monitoring." },
        { kind: "simulated", text: "Use panel G with “Synchronisation interval” to compare clocks under the same assumptions." },
        { kind: "hypothesis", text: "Fewer synchronisation exchanges and more tolerance to link interruptions — never indefinite, link-free coherence." },
        { kind: "gap", text: "Orbital dynamics, link outage statistics and in-orbit aging over long holdover are not modelled." },
      ],
    },
  ];
}

export function ValueChainContent({ data }: { data: RequirementsResponse }) {
  const rows = buildValueChain(data);
  const Pill = ({ kind }: { kind: Kind }) => (
    <span className={`inline-flex rounded-full border px-1.5 py-0.5 font-mono text-[9.5px] tracking-wider ${KIND_CLS[kind]}`}>{KIND[kind]}</span>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <ProvenanceBadge kind="simulated" />
        <span>Simulated values come live from our requirement solver. Every step is labelled by evidence type.</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((r) => {
          const evidence = r.cells.find((c) => c.kind === "simulated")!;
          const gap = r.cells[r.cells.length - 1];
          return (
            <article key={r.title} className="rounded-2xl border border-ice bg-white p-5 transition-colors hover:border-accent/40">
              <h3 className="text-base font-semibold text-navy">{r.title}</h3>
              <div className="mt-3 space-y-2 text-sm leading-relaxed">
                <p className="text-slate-700"><Pill kind={evidence.kind} /> <span className="ml-1">{evidence.text}</span></p>
                <p className="text-slate-600"><Pill kind={gap.kind} /> <span className="ml-1">{gap.text}</span></p>
              </div>
              <details className="mt-3 text-xs text-slate-500">
                <summary className="cursor-pointer text-slate-600 hover:text-navy">Full chain: research → buyer benefit → validation</summary>
                <ol className="mt-2 space-y-1.5">
                  {r.cells.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="w-36 shrink-0 font-mono text-[10px] uppercase tracking-wider text-slate-500">{CHAIN_STEPS[i]}</span>
                      <span><Pill kind={c.kind} /> <span className="ml-1 text-slate-600">{c.text}</span></span>
                    </li>
                  ))}
                </ol>
              </details>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default function ValueChain() {
  const state = useDefaultInsight();
  if (state.state === "ready" && state.data) return <ValueChainContent data={state.data} />;
  return <StatusBlock state={state.state === "idle" ? "loading" : state.state} error={state.error} height={200} />;
}
