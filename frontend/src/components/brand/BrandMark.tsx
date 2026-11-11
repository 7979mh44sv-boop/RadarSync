/** Original RadarSync vector mark: three nodes on a shared orbit with a common centre. No trademark claimed. */
export function BrandMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}>
      <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.9" />
      <circle cx="16" cy="16" r="2.4" fill="#3b82f6" />
      <circle cx="16" cy="5" r="2.3" fill="currentColor" />
      <circle cx="25.5" cy="21.5" r="2.3" fill="currentColor" />
      <circle cx="6.5" cy="21.5" r="2.3" fill="currentColor" />
    </svg>
  );
}

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-white ${className}`}>
      <BrandMark />
      <span className="font-mono text-sm font-semibold tracking-[0.35em]">RADARSYNC</span>
    </span>
  );
}
