# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run send       # generate a message and send it via WhatsApp
npm test           # run all unit tests (vitest)
npm run test:watch # run tests in watch mode
bash run.sh        # same as npm run send, but via the cron-safe nvm wrapper
```

To run a single test file:
```bash
npx vitest run tests/generateMessage.test.ts
```

## Architecture

The script is a single-shot CLI (`src/index.ts`) that orchestrates three modules:

- **`src/generateMessage.ts`** — calls Gemini 2.5 Flash (`@google/genai`) with a few-shot system prompt to produce a casual Spanish mood-lifting message. The prompt includes hand-picked example messages that define the tone; changes to tone/style belong here.
- **`src/sendMessage.ts`** — POSTs to the open-wa REST API (`POST /api/sessions/{sessionId}/messages/send-text`) with `X-API-Key` auth. Validates the response shape with Zod.
- **`src/logger.ts`** — appends a timestamped line to `messages.log` at the project root. Log path is resolved relative to the source file using `import.meta.url`.

`src/index.ts` validates all required env vars with Zod before calling anything — it will throw early with a clear message listing missing vars.

## Environment

All config lives in `.env` (see `.env.example`). Required vars:

| Var | Purpose |
|-----|---------|
| `GEMINI_API_KEY` | Gemini API key from aistudio.google.com (free tier) |
| `OPENWA_API_KEY` | open-wa instance API key |
| `OPENWA_BASE_URL` | Base URL of the open-wa instance (e.g. `http://localhost:2785`) |
| `OPENWA_SESSION_ID` | UUID of the active WhatsApp session — get it via `GET /api/sessions` |
| `WIFE_CHAT_ID` | Recipient WhatsApp ID in `countrycode+number@c.us` format |

## Cron

Two entries in the user's crontab fire `run.sh` at 9am and 7pm daily. `run.sh` sources nvm and reads the Node version from `.nvmrc` — so the cron entries never need updating after a Node upgrade, only `.nvmrc` does.

Cron-level errors go to `cron-errors.log`; application results go to `messages.log`.
