"use client";

import { useState } from "react";
import Image from "next/image";
import { Lock, ArrowRight, AlertCircle, CheckCircle2, ShieldCheck, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { signOut, updateUserPassword } from "../api/authActions";

/** First sign-in screen: accounts still on the shared default password set their own here. */
export function SetPasswordForm({ email }: { email?: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await updateUserPassword(new FormData(e.currentTarget));
      if (res?.error) {
        setMessage({ type: "error", text: res.error });
        setLoading(false);
      } else {
        setMessage({ type: "success", text: "Password set! Taking you to the arena..." });
        window.location.href = "/";
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Something went wrong. Please try again.",
      });
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    window.location.href = "/login";
  }

  const inputClass =
    "w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  return (
    <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-2xl backdrop-blur-xl">
      <CardHeader className="space-y-3 text-center pb-6 border-b border-slate-200 dark:border-slate-800/80">
        <div className="mx-auto relative h-13 w-13 shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center p-1 shadow-sm">
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
          Set your password
        </CardTitle>
        <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
          You signed in with the shared default password. Choose your own to keep your account, rating and spot in
          line safe.
        </CardDescription>
        {email && (
          <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400/80">{email}</p>
        )}
      </CardHeader>

      <CardContent className="pt-6 space-y-5">
        {message && (
          <div
            role={message.type === "error" ? "alert" : "status"}
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
          <div className="space-y-1.5">
            <label htmlFor="newPassword" className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              name="newPassword"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="At least 6 characters"
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Type it again"
              className={inputClass}
            />
          </div>

          <Button type="submit" disabled={loading} variant="default" className="w-full font-semibold mt-2">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Save password <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </form>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex justify-center">
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Not you? Sign out
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
