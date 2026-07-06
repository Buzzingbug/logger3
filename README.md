# Logger Bot

World-class Discord logging bot built for Railway, Postgres, Redis, and 100+ guilds.

## Apps

- `apps/bot`: Discord gateway worker and slash commands.
- `apps/web`: Next.js dashboard.
- `apps/worker`: BullMQ log delivery worker.
- `packages/db`: Drizzle schema and database access.
- `packages/shared`: shared config, constants, and helpers.

## Railway Start Commands

- Web service: `pnpm --filter @logger/web start`
- Bot service: `pnpm --filter @logger/bot start`
- Worker service: `pnpm --filter @logger/worker start`

## Required Environment Variables

Use Railway variables for all real values. `.env.example` is only a local reference.

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`
- `DATABASE_URL`
- `REDIS_URL`
- `SESSION_SECRET`
- `PUBLIC_APP_URL`

## Current Status

Phase 1 is complete. Phase 2 has core log capture, persistence, queue delivery, and a worker service scaffold.
