import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // .claude/** holds other sessions' git worktrees (whole copies of the repo);
    // their tests resolve "@/" to this checkout and must not run here.
    exclude: ["**/node_modules/**", "**/dist/**", "tablet/android/**", ".claude/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
