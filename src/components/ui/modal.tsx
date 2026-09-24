"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
  preventBackdropClose?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  children,
  className,
  preventBackdropClose = false,
}: ModalProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scrolling while modal is open to prevent background bleed and scroll shifting
  React.useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    // Compensate for scrollbar removal to prevent layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose && !preventBackdropClose) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      document.documentElement.style.overflow = originalHtmlOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, preventBackdropClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (!preventBackdropClose && onClose && e.target === e.currentTarget) {
          onClose();
        }
      }}
      className={cn(
        "fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen h-[100dvh] min-h-screen z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto cursor-pointer animate-in fade-in duration-150 select-none",
        className
      )}
      style={{
        margin: 0,
        boxSizing: "border-box",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full flex items-center justify-center cursor-default select-text"
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
