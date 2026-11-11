/**
 * Proposed business model, revenue model and market-entry path. All qualitative hypotheses:
 * no customers, partners, prices, revenues, margins or market sizes are claimed.
 */
export const BMC_LABEL = "Proposed model · to be validated with customers";

export const BMC_BLOCKS = [
  { key: "partners", t: "Key Partners", area: "lg:col-start-1 lg:row-start-1 lg:row-span-2",
    items: ["Atomic clock component suppliers", "Space test and qualification facilities", "Distributed-radar research groups"] },
  { key: "activities", t: "Key Activities", area: "lg:col-start-2 lg:row-start-1",
    items: ["Timing hardware design", "Clock characterisation and testing", "Calibration and timing-budget software", "Space qualification"] },
  { key: "resources", t: "Key Resources", area: "lg:col-start-2 lg:row-start-2",
    items: ["Validated clock-to-coherence models", "Timing and RF engineering know-how", "Test equipment (to acquire)"] },
  { key: "value", t: "Value Proposition", area: "lg:col-start-3 lg:row-start-1 lg:row-span-2", highlight: true,
    items: ["A characterised timing module on each radar satellite", "A timing budget that shows which clock a mission needs", "Helps where clock error limits coherence — not where other errors dominate"] },
  { key: "relationships", t: "Customer Relationships", area: "lg:col-start-4 lg:row-start-1",
    items: ["Engineering co-development", "Mission timing-budget studies", "Long-term support"] },
  { key: "channels", t: "Channels", area: "lg:col-start-4 lg:row-start-2",
    items: ["Direct technical sales", "Space and radar conferences", "Space programme calls"] },
  { key: "segments", t: "Customer Segments", area: "lg:col-start-5 lg:row-start-1 lg:row-span-2",
    items: ["Satellite radar payload makers", "Distributed SAR mission developers", "Satellite system integrators", "Later: aviation and other distributed sensing"] },
  { key: "costs", t: "Cost Structure", area: "lg:col-start-1 lg:col-span-3 lg:row-start-3",
    items: ["Hardware R&D and engineering staff", "Components and prototypes", "Environmental and space testing", "Software development"] },
  { key: "revenue", t: "Revenue Streams", area: "lg:col-start-4 lg:col-span-2 lg:row-start-3",
    items: ["Timing Box unit sales", "Integration and engineering services", "Calibration software licences and updates"] },
] as const;

export function BusinessModelCanvas() {
  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">{BMC_LABEL}</p>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:grid-rows-[auto_auto_auto]" aria-label="Business Model Canvas">
        {BMC_BLOCKS.map((b, i) => (
          <li key={b.key} className={`rounded-2xl border p-4 ${"highlight" in b && b.highlight ? "border-signal/50 bg-ice/70" : "border-ice bg-white"} ${b.area}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-navy">{b.t}</h3>
              <span className="font-mono text-[10px] text-slate-500">{i + 1}</span>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm leading-snug text-slate-600">
              {b.items.map((it) => <li key={it} className="flex gap-2"><span aria-hidden className="text-signal">·</span>{it}</li>)}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

export const REVENUE_STEPS = [
  { t: "Hardware", b: "Sell Timing Box units for each radar satellite." },
  { t: "Services", b: "Help teams integrate and test timing on their mission." },
  { t: "Software", b: "License calibration and timing-budget tools, with updates." },
];

export function RevenueModel() {
  return (
    <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
      {REVENUE_STEPS.map((s, i) => (
        <div key={s.t} className="contents">
          <div className="rounded-2xl border border-ice bg-white p-5">
            <span className="font-mono text-xs text-signal">0{i + 1}</span>
            <h3 className="mt-3 text-lg font-semibold text-navy">{s.t}</h3>
            <p className="mt-1 text-sm text-slate-600">{s.b}</p>
          </div>
          {i < REVENUE_STEPS.length - 1 && <span aria-hidden className="hidden self-center text-2xl text-signal md:block">+</span>}
        </div>
      ))}
    </div>
  );
}

export const ENTRY_STAGES = [
  { t: "Beachhead", b: "Distributed SAR mission developers who must fix a timing budget early." },
  { t: "Expand", b: "Radar payload makers and satellite integrators." },
  { t: "Platform", b: "One timing hardware family across satellite missions." },
  { t: "Adjacent", b: "Aviation and other distributed sensing — long-term vision." },
];

export function MarketEntry() {
  return (
    <ol className="relative grid gap-3 md:grid-cols-4" aria-label="Market entry and expansion path">
      <div aria-hidden className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-signal via-signal/40 to-transparent md:block" />
      {ENTRY_STAGES.map((s, i) => (
        <li key={s.t} className="relative rounded-2xl border border-ice bg-cloud p-5">
          <span className="flex h-3 w-3 rounded-full bg-signal ring-4 ring-signal/20" aria-hidden />
          <div className="mt-4 flex items-center justify-between"><h3 className="text-lg font-semibold text-navy">{s.t}</h3><span className="font-mono text-[10px] text-slate-500">STEP {i + 1}</span></div>
          <p className="mt-1 text-sm text-slate-600">{s.b}</p>
        </li>
      ))}
    </ol>
  );
}
