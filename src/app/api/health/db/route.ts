import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Daily keep-alive (Vercel Cron, see vercel.json). Supabase's free tier pauses a
 * project after a week without database activity, e.g. over a holiday break; one
 * tiny read a day prevents that. When CRON_SECRET is set in Vercel, only the cron
 * job (which sends it as a Bearer token) can call this.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  const { error } = await createAdminClient().from("sessions").select("id").limit(1);
  return NextResponse.json(
    { status: error ? "error" : "ok", checkedAt: new Date().toISOString() },
    { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } }
  );
}
