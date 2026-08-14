import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, fetchDiscordUser } from "../../../../../lib/discord";
import { consumeOAuthState, setSession } from "../../../../../lib/session";

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
  const baseUrl = getAppBaseUrl(request);
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !(await consumeOAuthState(state))) {
    return NextResponse.redirect(new URL("/?auth=failed", baseUrl));
  }

  const token = await exchangeCode(code);
  const user = await fetchDiscordUser(token.access_token);

  await setSession({
    userId: user.id,
    username: user.username,
    displayName: user.global_name ?? user.username,
    accessToken: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000
  });

  return NextResponse.redirect(new URL("/dashboard", baseUrl));
}
