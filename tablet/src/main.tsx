import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyTheme, loadTheme } from "./lib/theme";
import "./styles.css";

// Apply the saved theme before the first render so a dark tablet never flashes light.
loadTheme().then((theme) => {
  applyTheme(theme);
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
