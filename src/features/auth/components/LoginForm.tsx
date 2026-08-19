"use client";

import { useState } from "react";
import Image from "next/image";
import { Lock, Mail, ArrowRight, AlertCircle, CheckCircle2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { signInWithEmail, signUpWithEmail } from "../api/authActions";

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);

    try {
      if (mode === "signin") {
        const res = await signInWithEmail(formData);
        if (res?.error) {
          setMessage({ type: "error", text: res.error });
          setLoading(false);
        } else if (res?.success) {
          setMessage({ type: "success", text: "Signed in! Redirecting to arena..." });
          window.location.href = "/";
        }
      } else if (mode === "signup") {
        const res = await signUpWithEmail(formData);
        if (res?.error) {
          setMessage({ type: "error", text: res.error });
          setLoading(false);
        } else if (res?.success) {
          setMessage({ type: "success", text: res.message || "Account created! You may now sign in." });
          setMode("signin");
          setLoading(false);
        }
      }
    } catch (err) {
      console.error("Auth submit error:", err);
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "An unexpected error occurred. Please try again.",
      });
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-2xl backdrop-blur-xl">
      <CardHeader className="space-y-3 text-center pb-6 border-b border-slate-200 dark:border-slate-800/80">
        <div className="mx-auto relative h-13 w-13 shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center p-1 shadow-sm transition-colors">
          <Image
            src="/icon-192.png"
            alt="DCTECH Pickleball Logo"
            width={46}
            height={46}
            className="h-full w-full object-contain rounded-lg"
            priority
          />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          DCTECH <span className="text-emerald-500 font-normal">|</span> Pickleball
        </CardTitle>
        <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
          DCTECH Employee Pickleball & Open Play Platform
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6 space-y-5">
        {/* Mode Selector Tabs (Sign In & Sign Up) */}
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800 font-mono text-xs shadow-inner">
          <button
            type="button"
            onClick={() => { setMode("signin"); setMessage(null); }}
            className={`rounded-md py-2 font-medium transition-all ${
              mode === "signin"
                ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setMessage(null); }}
            className={`rounded-md py-2 font-medium transition-all ${
              mode === "signup"
                ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Status Message Alert */}
        {message && (
          <div
            className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs ${
              message.type === "error"
                ? "border-rose-500/30 bg-rose-50 dark:bg-red-950/40 text-rose-700 dark:text-red-300"
                : "border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            {message.type === "error" ? (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500 dark:text-red-400" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500 dark:text-emerald-400" />
            )}
            <span className="leading-relaxed">{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-slate-400" />
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                required
                placeholder="e.g. Jordan Miller"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-slate-400" />
              Company Email (@dctechmicro.com)
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="username@dctechmicro.com"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-xs"
            />
            <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400/80">
              Only @dctechmicro.com corporate email addresses are authorized.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              placeholder="••••••••••••"
              minLength={6}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            variant="default"
            className="w-full font-semibold mt-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                Processing...
              </span>
            ) : mode === "signin" ? (
              <span className="flex items-center gap-2">
                Sign In to Courts <ArrowRight className="h-4 w-4" />
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Create Player Account <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </form>

        <div className="pt-2 text-center">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Available on office Wi-Fi, home, and mobile browsers.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
