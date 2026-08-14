import { NextRequest, NextResponse } from "next/server";
import { getDiscordOAuthUrl } from "../../lib/discord";
import { createOAuthState } from "../../lib/session";

export async function GET(request: NextRequest) {
  try {
    const state = await createOAuthState();
    const targetUrl = getDiscordOAuthUrl(state);
    return NextResponse.redirect(new URL(targetUrl));
  } catch (error: any) {
    return new NextResponse(`OAuth Initialization Error: ${error?.message || error}`, {
      status: 500
    });
  }
}
