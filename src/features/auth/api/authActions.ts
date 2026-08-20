"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import { checkRateLimit, resetRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/security/rateLimit";
import { SignInSchema, MagicLinkSchema, sanitizeString } from "@/lib/security/validation";

export async function signInWithEmail(formData: FormData) {
  const rawEmail = formData.get("email") as string;
  const rawPassword = formData.get("password") as string;

  const validation = SignInSchema.safeParse({ email: rawEmail, password: rawPassword });
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid credentials." };
  }

  const { email, password } = validation.data;

  // Enforce Brute-Force Rate Limiting (5 attempts / min -> 5 min lock)
  const rateLimit = checkRateLimit(email, "auth_signin", RATE_LIMIT_CONFIGS.AUTH_STRICT);
  if (!rateLimit.success) {
    return { error: rateLimit.error };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // Clear rate limit counter on successful login
  resetRateLimit(email, "auth_signin");

  revalidatePath("/", "layout");
  return { success: true };
}

export async function signUpWithEmail(formData: FormData) {
  const rawEmail = formData.get("email") as string;
  const rawPassword = formData.get("password") as string;
  const rawFullName = formData.get("fullName") as string;

  const validation = SignInSchema.safeParse({ email: rawEmail, password: rawPassword });
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid signup details." };
  }

  const { email, password } = validation.data;
  const fullName = sanitizeString(rawFullName);

  // Enforce Rate Limiting
  const rateLimit = checkRateLimit(email, "auth_signup", RATE_LIMIT_CONFIGS.AUTH_STRICT);
  if (!rateLimit.success) {
    return { error: rateLimit.error };
  }

  if (!email.endsWith("@dctechmicro.com")) {
    return {
      error: "Access restricted: Only @dctechmicro.com corporate email addresses are permitted to sign up.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName || split_email(email),
        name: fullName || split_email(email),
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Ensure profile is created/synced in public.profiles table
  if (data?.user) {
    try {
      await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          email,
          full_name: fullName || split_email(email),
          display_name: fullName || split_email(email),
          role: "player",
          skill_rating: 3.0,
          is_active: true,
        },
        { onConflict: "id" }
      );
    } catch (err) {
      console.error("Profile upsert notice:", err);
    }
  }

  revalidatePath("/", "layout");
  return {
    success: true,
    message: "Account created successfully! You may now sign in.",
  };
}

export async function signInWithMagicLink(formData: FormData) {
  const rawEmail = formData.get("email") as string;

  const validation = MagicLinkSchema.safeParse({ email: rawEmail });
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Please provide a valid email." };
  }

  const { email } = validation.data;

  // Enforce Rate Limiting
  const rateLimit = checkRateLimit(email, "auth_magic_link", RATE_LIMIT_CONFIGS.AUTH_STRICT);
  if (!rateLimit.success) {
    return { error: rateLimit.error };
  }

  if (!email.endsWith("@dctechmicro.com")) {
    return {
      error: "Access restricted: Only @dctechmicro.com corporate email addresses are permitted.",
    };
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true, message: "Magic link sent! Check your inbox." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
  .from("profiles")
  .select("*")
  .eq("id", user.id)
  .single();

  return {
    user,
    profile,
  };
}

export async function updateUserPassword(formData: FormData) {
  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!newPassword || newPassword.length < 6) {
    return { error: "New password must be at least 6 characters long." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "New password and confirmation password do not match." };
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user || !user.email) {
    return { error: "Authentication required. Please sign in again." };
  }

  // If current password was provided, verify it first
  if (currentPassword) {
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) {
      return { error: "Incorrect current password. Please check and try again." };
    }
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath("/profile");
  return { success: true, message: "Password updated successfully!" };
}

function split_email(email: string): string {
  return email.split("@")[0].replace(/[^a-zA-Z0-9]/g, " ");
}
