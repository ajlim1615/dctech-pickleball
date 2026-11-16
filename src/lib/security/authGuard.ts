import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export interface AuthContext {
  userId: string;
  email: string;
  role: "admin" | "player" | "staff";
  profile: Profile;
}

/**
 * Server-side guard ensuring caller is an authenticated user.
 */
export async function requireAuthenticatedUser(): Promise<{ error?: string; context?: AuthContext }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Authentication required. Please sign in." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { error: "User profile not found or inactive." };
  }

  return {
    context: {
      userId: user.id,
      email: user.email || profile.email,
      role: (profile.role as any) || "player",
      profile: profile as Profile,
    },
  };
}

/**
 * Server-side guard ensuring caller has verified administrative privileges.
 */
export async function requireAdminUser(): Promise<{ error?: string; context?: AuthContext }> {
  const authRes = await requireAuthenticatedUser();
  if (authRes.error || !authRes.context) {
    return { error: authRes.error || "Authentication required." };
  }

  const { role, email } = authRes.context;
  const isAdmin = role === "admin" || email?.toLowerCase() === "admin@dctechmicro.com";

  if (!isAdmin) {
    return { error: "Forbidden: You do not have administrative privileges to perform this action." };
  }

  return authRes;
}

/**
 * Server-side guard for actions only the System Admin account may take: changing a
 * player's rating, name, photo or role, and resetting passwords. Regular admins run
 * sessions but can't change who people are.
 */
export async function requireSystemAdmin(): Promise<{ error?: string; context?: AuthContext }> {
  const authRes = await requireAuthenticatedUser();
  if (authRes.error || !authRes.context) {
    return { error: authRes.error || "Authentication required." };
  }
  if (!isRootSystemAdmin(authRes.context.email)) {
    return { error: "Only the System Admin account (admin@dctechmicro.com) can do this." };
  }
  return authRes;
}

/**
 * Checks if target email is the root system admin account.
 */
export function isRootSystemAdmin(email?: string | null): boolean {
  return email?.toLowerCase() === "admin@dctechmicro.com";
}
