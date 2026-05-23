# CLAUDE.md

Guidance for Claude Code working in this repository.

## Commands

```bash
# Local dev (no docker)
npm run wife -- --help    # invoke the CLI via tsx
npm run send              # generate + send (equivalent to `wife send`)
npm run tui               # launch the Ink TUI
npm run build             # tsup → dist/cli/index.js
npm test                  # vitest (run once)
npm run test:watch        # vitest watch mode

# Dockerized (production path)
docker compose up -d                          # API + dashboard + scheduler
docker compose run --rm sender init           # one-time seed (Dockerfile ENTRYPOINT is the wife CLI)
bin/wife <subcommand>                         # host shortcut: `docker compose run --rm sender "$@"`

# Single test
npx vitest run tests/generateMessage.test.ts
```

## Architecture

The CLI entry is `src/cli/index.ts` (Commander). Each subcommand lives in `src/cli/commands/*.ts` and delegates to pure-function modules in `src/core/`:

- `src/core/config.ts` — Zod-validated `data/config.json` (openwaBaseUrl, openwaSessionId, wifeChatId).
- `src/core/secrets.ts` — Zod-validated `.env` (GEMINI_API_KEY, OPENWA_API_KEY).
- `src/core/prompt.ts` — `data/prompt.json` (systemPrompt + examples) + `generateMessage(args)` calling Gemini 2.5 Flash.
- `src/core/sender.ts` — `sendMessage(args)` POSTing to the OpenWA REST API. Response shape validated with Zod.
- `src/core/logger.ts` — appends to `data/messages.log`, plus `readHistory()` for the TUI/CLI viewers.
- `src/core/schedule.ts` — `data/schedule.json` is the source of truth; `saveSchedule()` also regenerates `data/ofelia.ini` for the Ofelia daemon.
- `src/core/paths.ts` — resolves all data file paths from `WIFE_DATA_DIR` (defaults to `./data/`).

The TUI is Ink/React under `src/tui/`. `App.tsx` is the tab router; one screen per tab lives in `src/tui/screens/`.

## Docker layout

`docker-compose.yml` uses `include:` to pull in `../Deckasoft/OpenWA/docker-compose.dev.yml`. That gives us `openwa-api` (port 2785, REST + Swagger at `/api/docs`) and `openwa-dashboard` (port 2886). Our compose adds:

- `sender` — `profiles: [tools]`, on-demand; built from the local Dockerfile. The `bin/wife` host wrapper just runs `docker compose run --rm sender "$@"`.
- `scheduler` — `mcuadros/ofelia`; reads `data/ofelia.ini`, spawns a `sender` container per job tick.

OpenWA's compose renames the default network to `openwa-network`; both of our services join that default so they can reach `http://openwa-api:2785` over compose DNS.

## Data files

| File | Role | Committed? |
|------|------|-----------|
| `data/prompt.json` | System prompt + few-shot examples | yes (defaults shipped) |
| `data/ofelia.ini` | Ofelia daemon config (auto-generated) | yes (stub; regenerated on `wife schedule …`) |
| `data/config.json` | User-specific (URLs, session ID, chat ID) | no |
| `data/schedule.json` | User-specific (jobs) | no |
| `data/messages.log` | Send/error history | no |

`wife init` seeds the missing files (`data/config.json`, `data/schedule.json`, also overwrites `data/ofelia.ini` from defaults).

## Scheduling

`data/schedule.json` is the human-edited model (`{ jobs: [{ name, schedule, command }] }`). On save, `regenerateOfeliaIni()` writes a `job-run` block per job to `data/ofelia.ini`. Each job spawns a transient `openwa-scripts-sender:latest` container that runs the given command (default `send`) with `/data` mounted from the host and `.env` mounted read-only.

After editing the schedule, run `docker compose restart scheduler` (Ofelia reloads only on restart).

## Settings model

Hybrid: secrets stay in `.env` (read by `dotenv`, written by `secrets.saveSecrets()` — note that comments are not preserved on writeback); everything else lives in `data/config.json` (Zod-validated). `wife config set <key> <value>` writes to the right file based on the key.
