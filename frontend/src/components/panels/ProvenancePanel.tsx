import ProvenanceBadge from "@/components/ProvenanceBadge";
import type { LimitationsResponse, Provenance, ScenarioList } from "@/lib/api";
import { formatHz, formatSci } from "@/lib/format";
import { PROVENANCE_INFO, styleFor } from "@/lib/scenarios";

const PARAM_LABEL: Record<string, string> = {
  white_fm_a: "White FM coefficient a",
  flicker_fm_b: "Flicker FM floor b",
  random_walk_fm_c: "Random-walk FM coefficient c",
  drift_per_s: "Linear drift D",
};

export default function ProvenancePanel({ scenarios, limitations }: { scenarios: ScenarioList; limitations: LimitationsResponse }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(PROVENANCE_INFO) as Provenance[]).map((k) => (
          <div key={k} className="rounded-xl border border-border bg-background/40 p-3">
            <ProvenanceBadge kind={k} />
            <p className="mt-2 text-xs leading-relaxed text-muted">{PROVENANCE_INFO[k].description}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-warning/40 bg-warning/5 p-4">
        <h3 className="flex items-center gap-2 text-sm font-medium text-warning">
          <span aria-hidden>⚠</span> Key limitations
        </h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-foreground/85">
          {limitations.statements.map((s) => <li key={s}>{s}</li>)}
        </ul>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="mb-2 text-left text-[11px] uppercase tracking-wider text-muted">
              SA65 model-implied phase noise vs. sourced datasheet limits (10 MHz output)
            </caption>
            <thead className="text-muted">
              <tr>
                <th className="py-1 pr-3 font-normal">Offset</th>
                <th className="py-1 pr-3 font-normal">Model <ProvenanceBadge kind="assumption" className="ml-1" /></th>
                <th className="py-1 pr-3 font-normal">Datasheet limit <ProvenanceBadge kind="sourced" className="ml-1" /></th>
                <th className="py-1 font-normal">Margin</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {limitations.sa65_phase_noise_check.map((c) => (
                <tr key={c.offset_hz} className="border-t border-border/60">
                  <td className="py-1 pr-3">{formatHz(c.offset_hz)}</td>
                  <td className="py-1 pr-3">{c.model_dbc_hz.toFixed(1)} dBc/Hz</td>
                  <td className="py-1 pr-3">{c.datasheet_limit_dbc_hz.toFixed(0)} dBc/Hz</td>
                  <td className={`py-1 ${c.margin_db < 0 ? "text-warning" : ""}`}>
                    {c.margin_db > 0 ? "+" : ""}{c.margin_db.toFixed(1)} dB {c.margin_db < 0 ? "(model exceeds limit)" : "(model below limit)"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Maximum excess: {limitations.max_model_excess_db.toFixed(1)} dB. This compares spectral densities at discrete offsets against datasheet
            limits; it is a model-consistency check and does not bound actual radar coherence loss in either direction.
          </p>
        </div>

        <div className="space-y-3">
          {scenarios.scenarios.map((s) => (
            <details key={s.key} className="rounded-xl border border-border/70 px-3 py-2">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-sm">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: styleFor(s.key).color }} />
                <span className="font-medium">{s.label}</span>
                <ProvenanceBadge kind={s.category} />
                <span className="ml-auto font-mono text-[11px] text-muted">σy(1 s) = {formatSci(s.adev_at_1s.value)}</span>
              </summary>
              <table className="mt-2 w-full text-left text-[11px]">
                <tbody>
                  {Object.entries(s.parameters).map(([k, q]) => (
                    <tr key={k} className="border-t border-border/50 align-top">
                      <td className="py-1 pr-2 text-muted">{PARAM_LABEL[k] ?? k}</td>
                      <td className="py-1 pr-2 font-mono">{formatSci(q.value)} {q.unit === "-" ? "" : q.unit}</td>
                      <td className="py-1 pr-2"><ProvenanceBadge kind={q.provenance} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">{s.notes}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted/80">Basis: {Object.values(s.parameters)[0]?.source}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
