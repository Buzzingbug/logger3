# Architecture

## Services

- Web dashboard: Next.js, Discord OAuth, guild configuration.
- Bot worker: Discord gateway events, slash commands, fast event intake.
- Queue worker: BullMQ jobs for log delivery, exports, cleanup, retries.
- Postgres: durable guild config and log events.
- Redis: queues, short-lived caches, rate-limit state, distributed locks.

## Event Flow

1. Discord sends gateway event.
2. Bot normalizes event and stores minimal durable metadata.
3. Bot caches snapshots where future logs need previous state.
4. Bot enqueues delivery job.
5. Worker renders embed and sends via Discord channel or webhook.
6. Dashboard reads config and searchable logs from Postgres.

## Scale Rules

- Gateway handlers must stay fast.
- No heavy REST fan-out in gateway handlers.
- Every delivery path must tolerate retries and Discord rate limits.
- Store enough state to explain missing or partial logs.
- Keep shard-aware boundaries from day one, even before sharding is required.
