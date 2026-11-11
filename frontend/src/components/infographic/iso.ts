/** Isometric projection helpers for the exploded hardware view. */
export const COS30 = Math.cos(Math.PI / 6);

export function iso(ox: number, oy: number) {
  return (x: number, y: number, z: number): [number, number] => [ox + (x - y) * COS30, oy + (x + y) * 0.5 - z];
}

export type Pt = [number, number];
export const poly = (pts: Pt[]) => pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");

/** Faces of a box (x0..x0+w, y0..y0+d, z..z+t): top, front (y = y0+d) and right (x = x0+w). */
export function boxFaces(P: ReturnType<typeof iso>, x0: number, y0: number, z: number, w: number, d: number, t: number) {
  const x1 = x0 + w, y1 = y0 + d, z1 = z + t;
  return {
    top: [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)] as Pt[],
    front: [P(x0, y1, z), P(x1, y1, z), P(x1, y1, z1), P(x0, y1, z1)] as Pt[],
    right: [P(x1, y0, z), P(x1, y1, z), P(x1, y1, z1), P(x1, y0, z1)] as Pt[],
  };
}
