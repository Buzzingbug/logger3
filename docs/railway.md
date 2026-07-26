# Railway Deployment

Create one Railway project with five services:

1. Postgres
2. Redis
3. A GitHub service for `apps/bot`
4. A GitHub service for `apps/worker`
5. A GitHub service for `apps/web`

Use the same repository for each GitHub service. Configure these start commands:

- Bot: `pnpm --filter @logger/bot start`
- Worker: `pnpm --filter @logger/worker start`
- Web: `pnpm --filter @logger/web start`

Add the following shared Railway variables to every application service:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DATABASE_URL`
- `REDIS_URL`
- `PUBLIC_APP_URL`

Add these web-only variables:

- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI` set to `${PUBLIC_APP_URL}/api/auth/callback/discord`
- `SESSION_SECRET`

Before the first production deploy, run this command once from a Railway shell attached to any app service:

```sh
pnpm db:migrate
```

In the Discord Developer Portal, enable Server Members Intent and Message Content Intent. Invite the bot with `bot` and `applications.commands` scopes. It needs View Audit Log, View Channel, Send Messages, and Embed Links in every destination log channel.
