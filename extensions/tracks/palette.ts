// The track colors (design D6): saturated mid-tones that read on light and dark basemaps and on
// imagery. A new entry gets the color the library uses least, ties going to palette order.

export const PALETTE = [
  { color: "#e5383b", label: "Red" },
  { color: "#1e88e5", label: "Blue" },
  { color: "#f4b400", label: "Yellow" },
  { color: "#b44dff", label: "Purple" },
  { color: "#00a896", label: "Teal" },
  { color: "#ff4f9a", label: "Pink" },
  { color: "#7cb518", label: "Green" },
  { color: "#ff7a00", label: "Orange" },
] as const;

/** The palette color least used in `used`, the earliest one on a tie. */
export function nextColor(used: Iterable<string>): string {
  const counts = new Map<string, number>(PALETTE.map(({ color }) => [color, 0]));
  for (const color of used) if (counts.has(color)) counts.set(color, counts.get(color)! + 1);
  let best: string = PALETTE[0].color;
  for (const { color } of PALETTE) if (counts.get(color)! < counts.get(best)!) best = color;
  return best;
}
