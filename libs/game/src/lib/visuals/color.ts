/** Parses a CSS hex colour (`#rgb` or `#rrggbb`) to 0xRRGGBB; `fallback` when malformed. */
export function parseHexColor(css: string, fallback: number): number {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(css.trim());
  const hex = m?.[1];
  if (!hex) return fallback;
  const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex;
  return Number.parseInt(full, 16);
}
