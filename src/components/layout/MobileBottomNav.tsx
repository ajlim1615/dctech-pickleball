"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, PlayCircle, Users, Trophy, User, ShieldCheck, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export function MobileBottomNav() {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const [userRole, setUserRole] = useState<string | null>(null);

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

  if (isLoginPage || !userRole) return null;

  const navItems = [
    { label: "Courts", href: "/", icon: Activity },
    { label: "Sessions", href: "/sessions", icon: PlayCircle },
    { label: "Rankings", href: "/rankings", icon: Trophy },
    { label: "Profile", href: "/profile", icon: User },
    ...(userRole === "admin" ? [{ label: "Admin", href: "/admin", icon: ShieldCheck }] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#090d14]/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] transition-colors shadow-lg">
      <div className="flex items-center justify-around h-15 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-1.5 px-1 text-[10px] font-mono transition-all rounded-xl active:scale-90 select-none",
                isActive
                  ? "text-emerald-600 dark:text-[#d4e938] font-bold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <div className={cn("p-1 rounded-xl transition-all", isActive && "bg-emerald-50 dark:bg-emerald-950/50 shadow-2xs")}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <span className="truncate mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
