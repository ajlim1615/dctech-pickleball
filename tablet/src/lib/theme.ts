import { getMeta, setMeta } from "../db/repo";

export type Theme = "light" | "dark";

/** Light unless the stored value is exactly "dark". */
export function parseTheme(raw: unknown): Theme {
  return raw === "dark" ? "dark" : "light";
}

export async function loadTheme(): Promise<Theme> {
  try {
    return parseTheme(await getMeta("theme"));
  } catch {
    return "light";
  }
}

export async function saveTheme(theme: Theme): Promise<void> {
  await setMeta("theme", theme);
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}
