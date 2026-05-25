# Design: Interactive Schedule Prompt in Setup Wizard

**Date:** 2026-05-24
**Scope:** `src/core/schedule.ts`, `src/cli/commands/setup.ts`

## Problem

`waify setup` seeds the schedule with hardcoded defaults (`waify-morning` at 09:00, `waify-evening` at 19:00). Users must edit `schedule.json` or use `waify schedule add` afterwards. There is also no validation on cron expressions — malformed patterns are silently written to `ofelia.ini`.

## Goal

Let users configure at least one scheduled job interactively during `waify setup`, and add real cron validation to `ScheduledJobSchema` so all schedule entry points benefit.

## Design

### 1. Cron validation in `ScheduledJobSchema`

In `src/core/schedule.ts`, the `schedule` field gets a `.refine()` validator:

- Splits on whitespace and requires exactly 6 fields.
- Each field must be `*`, a step expression (`*/n`), a range (`a-b`), or an integer within the allowed range for its position:
  - field 0 (seconds): 0–59
  - field 1 (minutes): 0–59
  - field 2 (hours): 0–23
  - field 3 (day-of-month): 1–31
  - field 4 (month): 1–12
  - field 5 (day-of-week): 0–7
- A field that contains `/` or `-` is accepted as-is (step/range) without validating the sub-values — Ofelia handles runtime errors for those.
- Error message: `"schedule must be a 6-field cron expression (e.g. 0 0 9 * * *)"`

This validation applies everywhere `ScheduledJobSchema.parse()` is called, including `waify schedule add`.

### 2. `promptScheduleJobs(rl)` helper in `setup.ts`

A private async function (not exported) that:

1. Prints a header:
   ```
   Configure your message schedule (at least one job required).
   Job names: lowercase letters, numbers, and dashes only.
   Cron pattern: 6 fields, e.g. 0 0 9 * * *  (sec min hour dom month dow)
   ```
2. Prompts for job name — loops until input matches `/^[a-z0-9-]+$/`, showing the constraint on failure.
3. Prompts for cron pattern — loops until the 6-field validation passes, showing `"Invalid cron pattern. Use 6 space-separated fields, e.g. 0 0 9 * * *"` on failure.
4. After each valid job, asks `Add another schedule? (y/N)`. Empty or `n` exits the loop; `y` repeats from step 2.
5. Returns `ScheduledJob[]` — always at least one entry.

### 3. Wizard integration

A new **Step 5** is inserted in `registerSetup` between the phone number prompt (Step 4) and writing docker-compose.yml (previously Step 5):

```
Step 3 — Gemini API key         (interactive)
Step 4 — Recipient phone number (interactive)
Step 5 — Schedule jobs          (interactive, new)
Step 6 — Write docker-compose.yml
...
Step N — finalizeSetup
```

`finalizeSetup` is updated to accept `ScheduledJob[]` and always calls `saveSchedule({ jobs })` unconditionally — removing the `existsSync` guard, since the user just configured it explicitly.

## Testing

- `ScheduledJobSchema` cron validation: unit tests covering valid expressions (`0 0 9 * * *`, `*/5 * * * * *`, `0 0 9-17 * * 1-5`), invalid field count (5-field standard cron), out-of-range values, and non-numeric non-wildcard values.
- `promptScheduleJobs`: tested by passing a mock readline interface that emits preset answers, asserting the returned `ScheduledJob[]`.
- Existing schedule tests continue to pass; the cron validation tests in `tests/schedule.test.ts` are extended (not replaced).

## Out of scope

- Deep validation of range/step expressions (e.g. `5-3` or `*/0`) — Ofelia handles runtime errors.
- Editing or removing jobs during setup — use `waify schedule` subcommands after setup.
- Changes to `waify init` — remains non-interactive.
