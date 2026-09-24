import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";

// Helper to inject enterprise security headers
function applySecurityHeaders(res: NextResponse) {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return res;
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/auth");
  const isPublicApi = pathname.startsWith("/api/health");

  // Fast-path 1: Public APIs and health checks bypass Supabase Auth entirely
  if (isPublicApi) {
    return applySecurityHeaders(NextResponse.next({ request }));
  }

  // Fast-path 2: Check for presence of Supabase auth session cookies
  const allCookies = request.cookies.getAll();
  const hasAuthToken = allCookies.some((c) => c.name.startsWith("sb-"));

  // If visitor has no auth session cookies at all:
  if (!hasAuthToken) {
    if (!isAuthPage) {
      // Immediately redirect to /login without redundant remote network calls
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return applySecurityHeaders(NextResponse.redirect(url));
    }
    // Allow access to login/auth pages immediately
    return applySecurityHeaders(NextResponse.next({ request }));
  }

  // Active session exists: initialize Supabase to validate & refresh token
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-supabase-url.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshing the auth token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If token is expired/invalid and trying to access protected pages
  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  // If user is already authenticated and visits /login
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  return applySecurityHeaders(supabaseResponse);
}

