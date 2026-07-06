# Logger Bot

World-class Discord logging bot built for Railway, Postgres, Redis, and 100+ guilds.

## Apps

- `apps/bot`: Discord gateway worker and slash commands.
- `apps/web`: Next.js dashboard.
- `packages/db`: Drizzle schema and database access.
- `packages/shared`: shared config, constants, and helpers.

## Phase 1 Setup

1. Create a Discord application and bot in the Discord Developer Portal.
2. Enable required privileged intents: Server Members and Message Content.
3. Create Railway services: web, bot, worker later, Postgres, Redis.
4. Add environment variables from `.env.example`.
5. Install dependencies with `pnpm install`.
6. Run `pnpm dev:bot` and `pnpm dev:web` locally.

## Railway Start Commands

- Web service: `pnpm --filter @logger/web start`
- Bot service: `pnpm --filter @logger/bot start`

## Current Status

Phase 1 scaffold is ready. Next step is dependency install, migrations, OAuth, and real Discord login smoke test.
