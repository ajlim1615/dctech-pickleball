import { NextResponse } from "next/server";

/**
 * High-performance health check endpoint for Load Balancers & Kubernetes / Nginx probes
 * Returns HTTP 200 with service status, version, and server timestamp.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "dctech-pickleball",
      timestamp: new Date().toISOString(),
      uptime: process.uptime ? Math.floor(process.uptime()) : undefined,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}
