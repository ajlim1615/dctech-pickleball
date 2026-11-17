import { randomBytes, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_PASSWORD } from "@/lib/security/defaultPassword";

/**
 * Creates a player who isn't signed up yet: a walk-in or a guest.
 *
 * Every profile must belong to a sign-in account (profiles.id references
 * auth.users), so this makes the account first; the handle_new_user trigger then
 * creates the profile, and we set the name and starting rating. With a company
 * email the person can sign in with the starting password and must change it;
 * without one (guests) the account gets a placeholder email and a random password
 * nobody knows, so it can't be used to sign in.
 *
 * Server-only: uses the service key, so callers must check who is acting first.
 */
export async function createPlayerAccount(params: {
  fullName: string;
  displayName: string;
  email?: string;
  rating: number;
  isGuest?: boolean;
}): Promise<{ id?: string; error?: string }> {
  const admin = createAdminClient();
  const isGuest = Boolean(params.isGuest);
  const canSignIn = Boolean(params.email) && !isGuest;
  const email = canSignIn
    ? params.email!
    : `guest_${randomUUID()}@dctechmicro.local`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: canSignIn ? DEFAULT_PASSWORD : randomBytes(24).toString("base64url"),
    email_confirm: true,
    app_metadata: canSignIn ? { must_change_password: true } : { guest: isGuest },
    user_metadata: { full_name: params.fullName },
  });
  if (error || !data.user) {
    const taken = /already|registered|exists/i.test(error?.message ?? "");
    return { error: taken ? `"${email}" already has an account.` : `The player couldn't be added: ${error?.message}` };
  }

  // The trigger made the profile with defaults; set the real name, guest flag, and starting rating.
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: params.fullName,
      display_name: params.displayName,
      skill_rating: params.rating,
      is_guest: isGuest,
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.user.id);
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: `The player couldn't be added: ${profileError.message}` };
  }

  return { id: data.user.id };
}
