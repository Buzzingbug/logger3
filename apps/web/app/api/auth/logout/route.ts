import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "../../../../lib/session";

function getAppBaseUrl(request: NextRequest): string {
  const envUrl = process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.trim().replace(/\/$/, "");

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = request.headers.get("host");
  if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
    return `https://${host}`;
  }

  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  await clearSession();
  return NextResponse.redirect(new URL("/", getAppBaseUrl(request)));
}
