import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  // Relative asset paths so the bundle loads from inside the Android app.
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Shared, Supabase-free rule code from the online app.
      "@": path.resolve(__dirname, "../src"),
    },
  },
  server: { port: 5180 },
});
