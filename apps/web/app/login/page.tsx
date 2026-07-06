import { redirect } from "next/navigation";
import { getDiscordOAuthUrl } from "../../lib/discord";
import { createOAuthState } from "../../lib/session";

export default async function LoginPage() {
  const state = await createOAuthState();
  redirect(getDiscordOAuthUrl(state));
}
