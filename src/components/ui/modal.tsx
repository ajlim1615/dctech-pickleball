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

/*
 * One page-wide scroll lock shared by every open modal. Modals can stack (a
 * player card, then their photo on top), so each one used to save "the
 * original" overflow and restore it on close; a modal that re-ran its effect
 * while another was open saved "hidden" as the original and left the page
 * unscrollable. Now the first open modal saves the real styles and only the
 * last one to close restores them.
 */
const noopSubscribe = () => () => {};

let openModals: symbol[] = [];
let savedStyles: { overflow: string; paddingRight: string; htmlOverflow: string } | null = null;

function lockScroll(id: symbol) {
  if (openModals.length === 0) {
    savedStyles = {
      overflow: document.body.style.overflow,
      paddingRight: document.body.style.paddingRight,
      htmlOverflow: document.documentElement.style.overflow,
    };
    // Compensate for scrollbar removal to prevent layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }
  openModals.push(id);
}

function unlockScroll(id: symbol) {
  openModals = openModals.filter((m) => m !== id);
  if (openModals.length === 0 && savedStyles) {
    document.body.style.overflow = savedStyles.overflow;
    document.body.style.paddingRight = savedStyles.paddingRight;
    document.documentElement.style.overflow = savedStyles.htmlOverflow;
    savedStyles = null;
  }
}

export function Modal({
  isOpen,
  onClose,
  children,
  className,
  preventBackdropClose = false,
}: ModalProps) {
  // True only in the browser (portals need document.body); false during server render.
  const mounted = React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
  const [id] = React.useState(() => Symbol("modal"));

  // Latest close handler and setting, read by Escape without re-running the lock.
  const closeRef = React.useRef(onClose);
  const preventRef = React.useRef(preventBackdropClose);
  React.useEffect(() => {
    closeRef.current = onClose;
    preventRef.current = preventBackdropClose;
  });

  // Lock body scrolling while open; depends only on isOpen so re-renders can't disturb it.
  React.useEffect(() => {
    if (!isOpen) return;
    lockScroll(id);

    // Escape closes only the top-most modal.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || openModals[openModals.length - 1] !== id) return;
      if (closeRef.current && !preventRef.current) closeRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      unlockScroll(id);
    };
  }, [isOpen, id]);

  const backdropRef = React.useRef<HTMLDivElement>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const pointerDownOnBackdrop = React.useRef(false);

  const isBackdropTarget = (target: EventTarget | null) =>
    target === backdropRef.current || target === wrapperRef.current;

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      onPointerDown={(e) => {
        pointerDownOnBackdrop.current = isBackdropTarget(e.target);
      }}
      onClick={(e) => {
        const startedOnBackdrop = pointerDownOnBackdrop.current;
        pointerDownOnBackdrop.current = false;
        if (!startedOnBackdrop || !isBackdropTarget(e.target)) return;
        if (preventBackdropClose || !onClose) return;
        if (openModals[openModals.length - 1] !== id) return;
        e.stopPropagation();
        onClose();
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
        ref={wrapperRef}
        className="w-full flex items-center justify-center select-text [&>*]:cursor-default"
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
