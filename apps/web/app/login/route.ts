import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getDiscordOAuthUrl } from "../../lib/discord";
import { getCookieOptions, STATE_COOKIE } from "../../lib/session";

export async function GET(request: NextRequest) {
  try {
    const state = randomBytes(24).toString("base64url");
    const targetUrl = getDiscordOAuthUrl(state);
    const options = await getCookieOptions(10 * 60);

    const response = NextResponse.redirect(new URL(targetUrl));
    response.cookies.set(STATE_COOKIE, state, options);
    return response;
  } catch (error: any) {
    return new NextResponse(`OAuth Initialization Error: ${error?.message || error}`, {
      status: 500
    });
  }
}
