"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signInWithEmail(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const normalizedEmail = email.trim().toLowerCase();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function signUpWithEmail(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.endsWith("@dctechmicro.com")) {
    return {
      error: "Access restricted: Only @dctechmicro.com corporate email addresses are permitted to sign up.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        full_name: fullName || split_email(normalizedEmail),
        name: fullName || split_email(normalizedEmail),
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
          email: normalizedEmail,
          full_name: fullName || split_email(normalizedEmail),
          display_name: fullName || split_email(normalizedEmail),
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
  const email = formData.get("email") as string;

  if (!email) {
    return { error: "Please provide a valid work email." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.endsWith("@dctechmicro.com")) {
    return {
      error: "Access restricted: Only @dctechmicro.com corporate email addresses are permitted.",
    };
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
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

function split_email(email: string): string {
  return email.split("@")[0].replace(/[^a-zA-Z0-9]/g, " ");
}
