export default function ConceptLabel({ children = "Concept architecture" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-500 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-600">
      <span aria-hidden>◇</span>
      {children}
    </span>
  );
}
