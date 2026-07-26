const DISCORD_API = "https://discord.com/api/v10";

const ADMINISTRATOR = 0x8n;
const VIEW_AUDIT_LOG = 0x80n;
const VIEW_CHANNEL = 0x400n;
const SEND_MESSAGES = 0x800n;
const EMBED_LINKS = 0x4000n;

type DiscordGuild = { id: string; name: string };
type DiscordMember = { user: { id: string }; roles: string[] };
type DiscordRole = { id: string; permissions: string };
type DiscordChannel = {
  id: string;
  type: number;
  permission_overwrites?: Array<{ id: string; type: number; allow: string; deny: string }>;
};

export type GuildDiagnostics = {
  state: "ready" | "attention" | "unavailable";
  botPresent: boolean;
  auditLog: boolean | null;
  channels: Array<{
    id: string;
    canView: boolean;
    canSend: boolean;
    canEmbed: boolean;
  }>;
};

export async function getGuildDiagnostics(
  guildId: string,
  channelIds: Array<string | null | undefined>
): Promise<GuildDiagnostics> {
  const token = process.env.DISCORD_TOKEN;
  if (!token) return { state: "unavailable", botPresent: false, auditLog: null, channels: [] };

  try {
    const bot = await discordFetch<{ id: string }>("/users/@me", token);
    const [guild, member, roles] = await Promise.all([
      discordFetch<DiscordGuild>(`/guilds/${guildId}`, token),
      discordFetch<DiscordMember>(`/guilds/${guildId}/members/${bot.id}`, token),
      discordFetch<DiscordRole[]>(`/guilds/${guildId}/roles`, token)
    ]);
    void guild;

    const basePermissions = roles
      .filter((role) => role.id === guildId || member.roles.includes(role.id))
      .reduce((permissions, role) => permissions | BigInt(role.permissions), 0n);
    const ids = [...new Set(channelIds.filter((id): id is string => Boolean(id)))];
    const channelResults = await Promise.all(
      ids.map(async (id) => {
        try {
          const channel = await discordFetch<DiscordChannel>(`/channels/${id}`, token);
          const permissions = calculateChannelPermissions(
            channel,
            guildId,
            member.roles,
            basePermissions
          );
          return {
            id,
            canView: hasPermission(permissions, VIEW_CHANNEL),
            canSend: hasPermission(permissions, SEND_MESSAGES),
            canEmbed: hasPermission(permissions, EMBED_LINKS)
          };
        } catch {
          return { id, canView: false, canSend: false, canEmbed: false };
        }
      })
    );
    const auditLog = hasPermission(basePermissions, VIEW_AUDIT_LOG);
    const channelsReady = channelResults.every(
      (channel) => channel.canView && channel.canSend && channel.canEmbed
    );

    return {
      state: auditLog && channelsReady ? "ready" : "attention",
      botPresent: true,
      auditLog,
      channels: channelResults
    };
  } catch {
    return { state: "attention", botPresent: false, auditLog: null, channels: [] };
  }
}

function calculateChannelPermissions(
  channel: DiscordChannel,
  guildId: string,
  roleIds: string[],
  basePermissions: bigint
) {
  if (hasPermission(basePermissions, ADMINISTRATOR)) return basePermissions;

  const overwrites = channel.permission_overwrites ?? [];
  let permissions = applyOverwrite(
    basePermissions,
    overwrites.find((entry) => entry.id === guildId)
  );
  const roleOverwrites = overwrites.filter(
    (entry) => entry.type === 0 && roleIds.includes(entry.id)
  );
  const roleDeny = roleOverwrites.reduce((value, entry) => value | BigInt(entry.deny), 0n);
  const roleAllow = roleOverwrites.reduce((value, entry) => value | BigInt(entry.allow), 0n);
  permissions = (permissions & ~roleDeny) | roleAllow;
  return permissions;
}

function applyOverwrite(
  permissions: bigint,
  overwrite: { allow: string; deny: string } | undefined
) {
  if (!overwrite) return permissions;
  return (permissions & ~BigInt(overwrite.deny)) | BigInt(overwrite.allow);
}

function hasPermission(permissions: bigint, permission: bigint) {
  return (
    (permissions & ADMINISTRATOR) === ADMINISTRATOR || (permissions & permission) === permission
  );
}

async function discordFetch<T>(path: string, token: string) {
  const response = await fetch(`${DISCORD_API}${path}`, {
    headers: { authorization: `Bot ${token}` },
    next: { revalidate: 0 }
  });
  if (!response.ok) throw new Error(`Discord API failed: ${response.status}`);
  return response.json() as Promise<T>;
}
