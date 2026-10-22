function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** `top` at `amount` (0–1) over `bottom`, like CSS color-mix in srgb. */
export function mix(top: string, bottom: string, amount: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.replace("#", "").slice(i, i + 2), 16);
  const mixed = [0, 2, 4].map((i) => Math.round(channel(top, i) * amount + channel(bottom, i) * (1 - amount)));
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG contrast ratio between two #rrggbb colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
