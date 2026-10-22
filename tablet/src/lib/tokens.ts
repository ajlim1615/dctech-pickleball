/**
 * The Clubhouse colour tokens. styles.css defines the same values as CSS variables;
 * this copy lets the contrast tests check them.
 */
export type TokenName =
  | "bg"
  | "surface"
  | "sunken"
  | "line"
  | "ink"
  | "muted"
  | "primary"
  | "on-primary"
  | "t1"
  | "t1-bg"
  | "t2"
  | "t2-bg"
  | "court"
  | "court-line"
  | "clay"
  | "clay-bg"
  | "ball";

export const TOKENS: Record<"light" | "dark", Record<TokenName, string>> = {
  light: {
    bg: "#f6f3ec",
    surface: "#fffdf8",
    sunken: "#efeadf",
    line: "#e4ded1",
    ink: "#1d2421",
    muted: "#6f695c",
    primary: "#1f3b2f",
    "on-primary": "#f6f3ec",
    t1: "#2f6b4f",
    "t1-bg": "#d6e6d5",
    t2: "#2f5a7a",
    "t2-bg": "#d8e4ec",
    court: "#e3ebdf",
    "court-line": "#ffffff",
    clay: "#9f4b28",
    "clay-bg": "#f5e3d8",
    ball: "#d4e938",
  },
  dark: {
    bg: "#111714",
    surface: "#19211d",
    sunken: "#151c18",
    line: "#26302b",
    ink: "#ece6d8",
    muted: "#97a097",
    primary: "#a9d1b4",
    "on-primary": "#10241a",
    t1: "#8fcca5",
    "t1-bg": "#1f3a2c",
    t2: "#93c2e0",
    "t2-bg": "#1d3242",
    court: "#1c2a22",
    "court-line": "#3b4d42",
    clay: "#e39a74",
    "clay-bg": "#3a261d",
    ball: "#d4e938",
  },
};
