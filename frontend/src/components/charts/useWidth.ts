"use client";

import { useEffect, useRef, useState } from "react";

/** Measure an element's content width (responsive charts). */
export function useWidth<T extends HTMLElement>(initial = 0) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
