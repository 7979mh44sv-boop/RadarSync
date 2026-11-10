export interface LegendItem {
  id: string;
  label: string;
  color: string;
  dash?: string;
  marker?: "line" | "square" | "circle" | "triangle" | "hatch";
  hollow?: boolean;
}

function Swatch({ item }: { item: LegendItem }) {
  const m = item.marker ?? "line";
  return (
    <svg width="26" height="12" aria-hidden className="shrink-0">
      {m === "line" && <line x1="1" y1="6" x2="25" y2="6" stroke={item.color} strokeWidth="2.5" strokeDasharray={item.dash} />}
      {m === "square" && <rect x="9" y="2" width="8" height="8" fill={item.hollow ? "none" : item.color} stroke={item.color} strokeWidth="1.5" />}
      {m === "circle" && <circle cx="13" cy="6" r="4" fill={item.hollow ? "none" : item.color} stroke={item.color} strokeWidth="1.5" />}
      {m === "triangle" && <path d="M8 2 L18 2 L13 10 Z" fill={item.hollow ? "none" : item.color} stroke={item.color} strokeWidth="1.5" />}
      {m === "hatch" && (
        <>
          <rect x="3" y="2" width="20" height="8" rx="2" fill={item.color} opacity="0.35" />
          <path d="M5 10 L11 2 M11 10 L17 2 M17 10 L23 2" stroke={item.color} strokeWidth="1.5" />
        </>
      )}
    </svg>
  );
}

export default function Legend({ items, className = "" }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted ${className}`} aria-label="Legend">
      {items.map((it) => (
        <li key={it.id} className="flex items-center gap-2">
          <Swatch item={it} />
          <span className="text-foreground/85">{it.label}</span>
        </li>
      ))}
    </ul>
  );
}
