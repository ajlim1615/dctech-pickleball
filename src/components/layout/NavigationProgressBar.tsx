"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);

  // Complete and reset progress bar whenever route change completes
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      // Find closest anchor tag
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Ignore external, target="_blank", downloads, mailto, tel, or hash links
      if (
        href.startsWith("http") ||
        href.startsWith("//") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        target.getAttribute("target") === "_blank" ||
        target.hasAttribute("download") ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      // If linking to the exact same page, don't trigger progress bar
      try {
        const currentUrl = new URL(window.location.href);
        const targetUrl = new URL(href, window.location.href);
        if (
          currentUrl.pathname === targetUrl.pathname &&
          currentUrl.search === targetUrl.search
        ) {
          return;
        }
      } catch {
        // invalid URL string, skip
        return;
      }

      setIsNavigating(true);
    };

    window.addEventListener("click", handleAnchorClick, { capture: true });
    return () => {
      window.removeEventListener("click", handleAnchorClick, { capture: true });
    };
  }, []);

  if (!isNavigating) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-50 pointer-events-none h-[2.5px] overflow-hidden bg-slate-900/40"
    >
      <div className="h-full bg-gradient-to-r from-emerald-500 via-lime-400 to-emerald-400 w-full animate-nav-progress origin-left shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
    </div>
  );
}
