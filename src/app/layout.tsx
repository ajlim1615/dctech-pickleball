import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { PWAInstallBanner } from "@/components/layout/PWAInstallBanner";
import { NavigationProgressBar } from "@/components/layout/NavigationProgressBar";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DCTECH | Pickleball",
  description: "Internal open-play pickleball queue, court management, and match scoring platform for DCTECH employees.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#090d14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col bg-background text-foreground antialiased font-sans"
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Suspense fallback={null}>
            <NavigationProgressBar />
          </Suspense>
          <Navbar />
          <main className="flex-1 pb-20 lg:pb-0">{children}</main>
          <MobileBottomNav />
          <PWAInstallBanner />
          <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-slate-100 dark:bg-[#070a10] py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span>© 2026 DCTECH | Pickleball</span>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
