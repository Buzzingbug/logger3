import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, fetchDiscordUser } from "../../../../../lib/discord";
import { consumeOAuthState, setSession } from "../../../../../lib/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !(await consumeOAuthState(state))) {
    return NextResponse.redirect(new URL("/?auth=failed", request.url));
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

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
