"use client";

import { useState } from "react";
import Image from "next/image";
import { Lock, Mail, ArrowRight, AlertCircle, CheckCircle2, Eye, EyeOff, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { signInWithEmail } from "../api/authActions";

const COMPANY_DOMAIN = "dctechmicro.com";

/** "juan" -> "juan@dctechmicro.com"; a full address (typed or autofilled) is sent as-is for the server to check. */
function toCompanyEmail(value: string) {
  const trimmed = value.trim();
  return trimmed.includes("@") ? trimmed : `${trimmed}@${COMPANY_DOMAIN}`;
}

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const showDomainSuffix = !username.includes("@");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    formData.set("email", toCompanyEmail(username));

    try {
      const res = await signInWithEmail(formData);
      if (res?.error) {
        setMessage({ type: "error", text: res.error });
        setLoading(false);
      } else if (res?.success) {
        setMessage({ type: "success", text: "Signed in! Redirecting to arena..." });
        window.location.href = "/";
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
    <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
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
          <div className="space-y-1.5">
            <label
              htmlFor="login-email"
              className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
            >
              <Mail className="h-3.5 w-3.5 text-slate-400" />
              Company email
            </label>
            <div className="flex items-stretch rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 transition-colors focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500">
              <input
                id="login-email"
                type="text"
                inputMode="email"
                name="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your.name"
                aria-describedby={showDomainSuffix ? "login-email-domain" : undefined}
                className="min-w-0 flex-1 rounded-lg bg-transparent px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
              />
              {showDomainSuffix && (
                <span
                  id="login-email-domain"
                  className="flex items-center rounded-r-lg border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-sm text-slate-500 dark:text-slate-400 select-none"
                >
                  @{COMPANY_DOMAIN}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="login-password"
              className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
            >
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                required
                minLength={6}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2.5 pl-3.5 pr-11 text-sm text-slate-900 dark:text-slate-100 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:text-emerald-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
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
            ) : (
              <span className="flex items-center gap-2">
                Sign In to Courts <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </form>

        {/* Access & Password Policy Info */}
        <div className="pt-2 flex flex-col items-center gap-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <div className="text-center space-y-1.5">
            <p className="text-slate-600 dark:text-slate-400">
              Default password for DCTECH colleagues:{" "}
              <code className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-mono font-bold">
                dctech123
              </code>
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-center gap-1">
              <LifeBuoy className="h-3 w-3 text-slate-400 shrink-0" />
              Can&apos;t sign in? Ask the Solution Department to reset your password.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
