"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Users,
  Trophy,
  User,
  ShieldCheck,
  PlayCircle,
  BookOpen,
  LogOut,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import { cn, formatRating } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/features/auth/api/authActions";

function LiveNavbarClock() {
  const [currentTime, setCurrentTime] = useState<string>("");

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

  return (
    <div className="hidden lg:flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-1 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 shadow-sm whitespace-nowrap">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
      </span>
      <span>{currentTime || "LIVE"}</span>
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";
  const [userProfile, setUserProfile] = useState<{
    id: string;
    email: string;
    full_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
    role: string;
    skill_rating: number;
  } | null>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const fetchUserProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setUserProfile(null);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email, full_name, display_name, avatar_url, role, skill_rating")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserProfile(profile);
      }
    };

    fetchUserProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      fetchUserProfile();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    }
  };

  const navItems = [
    { label: "Live Courts", href: "/", icon: Activity },
    { label: "Sessions", href: "/sessions", icon: PlayCircle },
    { label: "Rankings", href: "/rankings", icon: Trophy },
    { label: "Guide", href: "/guide", icon: BookOpen },
    ...(userProfile?.role === "admin" ? [{ label: "Admin", href: "/admin", icon: ShieldCheck }] : []),
  ];

  const displayName = userProfile?.full_name || userProfile?.display_name || "Employee";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#090d14]/90 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
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
          <div className="flex flex-col shrink-0">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
                DCTECH <span className="text-emerald-500 dark:text-emerald-400 font-normal">|</span> Pickleball
              </span>
            </div>
            <span className="text-[10px] font-medium tracking-wide text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">
              OPEN PLAY & RATINGS
            </span>
          </div>
        </Link>

        {/* Desktop Navigation (Only when logged in on large screens) */}
        {!isLoginPage && userProfile && (
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
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

        {/* Top-Right Tools & User Menu */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {!isLoginPage && userProfile && <LiveNavbarClock />}

          <ThemeToggle />

          {/* User Profile & Sign Out Dropdown Menu */}
          {!isLoginPage && userProfile && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-2 p-1 sm:pl-2 sm:pr-2.5 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-emerald-500/40 transition-all cursor-pointer shadow-2xs select-none"
                title={`${displayName} - Account & Sign Out`}
              >
                <div className="relative h-7 w-7 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-mono font-bold text-slate-700 dark:text-slate-200 shrink-0">
                  {userProfile.avatar_url ? (
                    <Image
                      src={userProfile.avatar_url}
                      alt={displayName}
                      fill
                      sizes="28px"
                      className="object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>

                <span className="hidden sm:block text-xs font-bold text-slate-800 dark:text-slate-200 max-w-24 truncate">
                  {displayName.split(" ")[0]}
                </span>

                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-slate-400 transition-transform duration-200",
                    isMenuOpen && "rotate-180 text-emerald-500"
                  )}
                />
              </button>

              {/* Floating Dropdown Card */}
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150 z-50">
                  {/* User Profile Info Header */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/60 space-y-1 mb-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {displayName}
                      </p>
                      {userProfile.role === "admin" ? (
                        <Badge variant="volt" className="text-[9px] font-mono py-0 px-1">
                          ADMIN
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] font-mono py-0 px-1">
                          ★ {formatRating(userProfile.skill_rating)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                      {userProfile.email}
                    </p>
                  </div>

                  {/* Navigation Links */}
                  <div className="space-y-0.5">
                    <Link
                      href="/profile"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <User className="h-4 w-4 text-emerald-500" />
                      <span>My Profile & Stats</span>
                    </Link>

                    {userProfile.role === "admin" && (
                      <Link
                        href="/admin"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <ShieldCheck className="h-4 w-4 text-amber-500" />
                        <span>System Admin Panel</span>
                      </Link>
                    )}

                    <Link
                      href="/guide"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <BookOpen className="h-4 w-4 text-sky-500" />
                      <span>Pickleball Rules & Guide</span>
                    </Link>
                  </div>

                  <div className="my-1.5 border-t border-slate-100 dark:border-slate-800/80" />

                  {/* Prominent Sign Out Button */}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-900/50 transition-all cursor-pointer shadow-2xs"
                  >
                    <span className="flex items-center gap-2">
                      <LogOut className="h-4 w-4" />
                      <span>{isSigningOut ? "Signing out..." : "Sign Out"}</span>
                    </span>
                    <span className="text-[10px] font-mono text-rose-400 dark:text-rose-500">
                      Log Off
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
