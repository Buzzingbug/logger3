export type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

export type DiscordGuild = {
  id: string;
  name: string;
  icon?: string | null;
  owner?: boolean;
  permissions: string;
  features?: string[];
};

const DISCORD_API = "https://discord.com/api/v10";
const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;

export function getDiscordOAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: required("DISCORD_CLIENT_ID"),
    redirect_uri: required("DISCORD_REDIRECT_URI"),
    response_type: "code",
    scope: "identify guilds",
    state
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCode(code: string) {
  const body = new URLSearchParams({
    client_id: required("DISCORD_CLIENT_ID"),
    client_secret: required("DISCORD_CLIENT_SECRET"),
    grant_type: "authorization_code",
    code,
    redirect_uri: required("DISCORD_REDIRECT_URI")
  });

  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) throw new Error(`Discord token exchange failed: ${response.status}`);
  return response.json() as Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
  }>;
}

export async function fetchDiscordUser(accessToken: string) {
  return discordFetch<DiscordUser>("/users/@me", accessToken);
}

export async function fetchManageableGuilds(accessToken: string) {
  const guilds = await discordFetch<DiscordGuild[]>("/users/@me/guilds", accessToken);
  return guilds.filter((guild) => guild.owner || hasManagePermission(guild.permissions));
}

export function guildIconUrl(guild: DiscordGuild) {
  if (!guild.icon) return null;
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=96`;
}

function hasManagePermission(permissions: string) {
  const bits = BigInt(permissions);
  return (bits & ADMINISTRATOR) === ADMINISTRATOR || (bits & MANAGE_GUILD) === MANAGE_GUILD;
}

async function discordFetch<T>(path: string, accessToken: string) {
  const response = await fetch(`${DISCORD_API}${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 }
  });

  if (!response.ok) throw new Error(`Discord API failed: ${response.status}`);
  return response.json() as Promise<T>;
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
