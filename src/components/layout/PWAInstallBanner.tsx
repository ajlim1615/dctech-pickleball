"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const PWA_DISMISSED_KEY = "dctech_pwa_banner_dismissed";

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user already dismissed the banner previously
    const isDismissed = localStorage.getItem(PWA_DISMISSED_KEY);
    if (isDismissed === "true") return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
      localStorage.setItem(PWA_DISMISSED_KEY, "true");
    }
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    setShowBanner(false);
    // Persist dismissal so it doesn't pop up on every page refresh/navigation
    localStorage.setItem(PWA_DISMISSED_KEY, "true");
  }

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 z-50 mx-auto max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 transition-all">
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center p-0.5 shadow-xs">
          <Image
            src="/icon-192.png"
            alt="DCTECH Pickleball Logo"
            width={36}
            height={36}
            className="h-full w-full object-contain rounded-lg"
            priority
          />
        </div>
        <div className="text-xs">
          <div className="font-bold text-slate-900 dark:text-slate-100">Install DCTECH | Pickleball</div>
          <div className="text-slate-500 dark:text-slate-400">Add to home screen for court alerts</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="volt" size="sm" onClick={handleInstall} className="text-xs font-bold h-8 px-3 shadow-xs">
          <Download className="h-3 w-3 mr-1" />
          Install
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Dismiss installation banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
