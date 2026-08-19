"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Users, Trophy, User, ShieldCheck, PlayCircle, BookOpen, Clock } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

import { createClient } from "@/lib/supabase/client";

export function Navbar() {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const [currentTime, setCurrentTime] = useState<string>("");
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const formatted = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      setCurrentTime(formatted);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUserRole(null);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      setUserRole(profile?.role || "player");
    };

    fetchUserRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUserRole();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const navItems = [
    { label: "Live Courts", href: "/", icon: Activity },
    { label: "Sessions", href: "/sessions", icon: PlayCircle },
    { label: "Queue", href: "/queue", icon: Users },
    { label: "Rankings", href: "/rankings", icon: Trophy },
    { label: "Guide", href: "/guide", icon: BookOpen },
    { label: "Profile", href: "/profile", icon: User },
    ...(userRole === "admin" ? [{ label: "Admin", href: "/admin", icon: ShieldCheck }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#090d14]/90 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center p-0.5 shadow-xs transition-colors">
            <Image
              src="/icon-192.png"
              alt="DCTECH Pickleball Logo"
              width={34}
              height={34}
              className="h-full w-full object-contain rounded-lg"
              priority
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
                DCTECH <span className="text-emerald-500 dark:text-emerald-400 font-normal">|</span> Pickleball
              </span>
              <Badge variant="volt" className="text-[10px] px-1.5 py-0">
                PROD
              </Badge>
            </div>
            <span className="text-[11px] font-medium tracking-wide text-slate-500 dark:text-slate-400 font-mono">
              OPEN PLAY & RATINGS
            </span>
          </div>
        </Link>

        {/* Desktop Navigation (Only when logged in) */}
        {!isLoginPage && userRole && (
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-inner font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Top-Right Live Arena Clock & Theme Toggle */}
        <div className="flex items-center gap-2.5">
          {!isLoginPage && userRole && (
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-1 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span>{currentTime || "LIVE"}</span>
            </div>
          )}

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
