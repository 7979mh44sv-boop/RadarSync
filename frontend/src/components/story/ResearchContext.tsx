export const RESEARCH_SOURCES = [
  {
    href: "https://www.uni-ulm.de/in/korato/",
    title: "KoRaTo — Cooperative aperture synthesis for tomographic radar imaging",
    org: "Research Training Group, Ulm University and FAU Erlangen-Nuremberg (DFG-funded)",
    note: "Develops a UAV- and radar-based monitoring system in which cooperative UAV swarms synthesise a common high-resolution 3D tomographic image.",
  },
  {
    href: "https://www.uni-ulm.de/index.php?id=124712",
    title: "KoRaTo research area 1: Spatial and Temporal Coherence",
    org: "Ulm University / FAU Erlangen-Nuremberg",
    note: "Describes coherence as “a key requirement and yet unresolved issue for cooperative aperture synthesis” and targets synchronisation of distributed clock sources in the picosecond range, using wireless synchronisation methods (CFDDS-TWR).",
  },
  {
    href: "https://elliit.se/project/cooperative-coordinated-coherent-drone-distributed-radar/",
    title: "Cooperative Coordinated Coherent Drone Distributed Radar (ELLIIT project E4)",
    org: "ELLIIT; PI Lund University, co-PI Blekinge Institute of Technology",
    note: "Develops a distributed radar system for deployment on a drone swarm, for detection, positioning, tracking and imaging in low-visibility situations such as search and rescue.",
  },
  {
    href: "https://doi.org/10.1109/TRS.2025.3593818",
    title: "J. Kanz, C. Bonfert, C. Gesell, A. Grathwohl, F. Bormuth, G. Krieger, C. Waldschmidt, “Coherent Multistatic UAV-Based SAR”",
    org: "IEEE Transactions on Radar Systems, vol. 3, pp. 1056–1072, 2025",
    note: "Peer-reviewed article on coherent multistatic synthetic-aperture radar with UAVs.",
  },
];

export default function ResearchContext() {
  return (
    <div className="space-y-4">
      <ul className="grid gap-3 md:grid-cols-2">
        {RESEARCH_SOURCES.map((s) => (
          <li key={s.href} className="rounded-xl border border-border bg-background/40 p-4">
            <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-accent">
              {s.title}
            </a>
            <div className="mt-1 text-[11px] text-muted">{s.org}</div>
            <p className="mt-2 text-xs leading-relaxed text-muted">{s.note}</p>
          </li>
        ))}
      </ul>
      <p className="rounded-lg border border-border/70 bg-background/30 px-3 py-2 text-xs leading-relaxed text-muted">
        These independent efforts concern UAV-borne distributed radar, an adjacent platform; they show that time and phase coherence across
        separately moving radar nodes is an active and important problem — the same physics that distributed satellite radar faces. They do <span className="text-foreground">not</span> validate RadarSync&apos;s results or performance, and
        RadarSync is not affiliated with them. They also illustrate that high-stability onboard clocks are only one approach:
        wireless two-way synchronisation, repeater-based schemes and signal-processing methods are actively researched alternatives
        and complements.
      </p>
    </div>
  );
}
