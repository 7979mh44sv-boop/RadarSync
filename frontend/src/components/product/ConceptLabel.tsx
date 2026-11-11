export default function ConceptLabel({ children = "Conceptual — proposed hardware, not built" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-500 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-300">
      <span aria-hidden>◇</span>
      {children}
    </span>
  );
}
