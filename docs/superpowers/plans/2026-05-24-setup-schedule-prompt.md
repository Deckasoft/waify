# Setup Schedule Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6-field cron validation to `ScheduledJobSchema` and a `promptScheduleJobs` helper that the `waify setup` wizard calls to collect at least one scheduled job from the user before starting the Docker automation.

**Architecture:** Cron validation lives in `src/core/schedule.ts` alongside the schema it validates. The interactive helper `promptScheduleJobs` lives in `src/cli/commands/setup.ts` and is exported for testing; it receives a `promptFn` callback so tests can drive it without mocking readline. The wizard inserts one new step between the phone number prompt and the docker-compose write.

**Tech Stack:** TypeScript, Zod, Node `readline` (already used), Vitest

---

## Files

| File | Change |
|------|--------|
| `src/core/schedule.ts` | Export `isValidCron` helper; add `.refine()` to `ScheduledJobSchema.schedule` |
| `src/cli/commands/setup.ts` | Export `promptScheduleJobs`; insert Step 5; update `finalizeSetup` signature |
| `tests/schedule.test.ts` | Extend with cron-validation cases |
| `tests/setup.test.ts` | New — unit-tests for `promptScheduleJobs` |

---

## Task 1: Cron validation in `ScheduledJobSchema`

**Files:**
- Modify: `src/core/schedule.ts`
- Test: `tests/schedule.test.ts`

- [ ] **Step 1: Write the failing tests**

Append this `describe` block to `tests/schedule.test.ts` (keep the existing content intact — just add the import and describe block at the bottom). The file already imports from `../src/core/schedule.ts`; extend that import line to include `ScheduledJobSchema`:

```typescript
// Change existing import line from:
import { renderOfeliaIni } from '../src/core/schedule.ts'
// to:
import { renderOfeliaIni, ScheduledJobSchema } from '../src/core/schedule.ts'
```

Then append to the bottom of `tests/schedule.test.ts`:

```typescript
describe('ScheduledJobSchema cron validation', () => {
  const valid = (schedule: string) =>
    () => ScheduledJobSchema.parse({ name: 'job', schedule, command: 'send' })

  it('accepts a valid 6-field cron', () => {
    expect(valid('0 0 9 * * *')).not.toThrow()
  })

  it('accepts all-wildcard cron', () => {
    expect(valid('* * * * * *')).not.toThrow()
  })

  it('accepts step expressions', () => {
    expect(valid('*/5 * * * * *')).not.toThrow()
  })

  it('accepts range expressions', () => {
    expect(valid('0 0 9-17 * * 1-5')).not.toThrow()
  })

  it('rejects 5-field standard cron', () => {
    expect(valid('0 9 * * *')).toThrow('6-field')
  })

  it('rejects out-of-range seconds (60)', () => {
    expect(valid('60 0 9 * * *')).toThrow('6-field')
  })

  it('rejects out-of-range hours (24)', () => {
    expect(valid('0 0 24 * * *')).toThrow('6-field')
  })

  it('rejects out-of-range month (13)', () => {
    expect(valid('0 0 9 * 13 *')).toThrow('6-field')
  })

  it('rejects non-numeric non-wildcard field', () => {
    expect(valid('0 0 9 * abc *')).toThrow('6-field')
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npx vitest run tests/schedule.test.ts
```

Expected: 9 new failures (`ScheduledJobSchema cron validation` suite), existing `renderOfeliaIni` tests still pass.

- [ ] **Step 3: Implement `isValidCron` and add refine to the schema**

In `src/core/schedule.ts`, add after the imports and before `ScheduledJobSchema`:

```typescript
const CRON_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0, 59],  // seconds
  [0, 59],  // minutes
  [0, 23],  // hours
  [1, 31],  // day-of-month
  [1, 12],  // month
  [0, 7],   // day-of-week
]

const isValidCronField = (field: string, [min, max]: readonly [number, number]): boolean => {
  if (field === '*') return true
  if (field.includes('/') || field.includes('-')) return true
  const n = Number(field)
  return Number.isInteger(n) && n >= min && n <= max
}

export const isValidCron = (value: string): boolean => {
  const fields = value.trim().split(/\s+/)
  return fields.length === 6 && fields.every((f, i) => isValidCronField(f, CRON_RANGES[i]!))
}
```

Then update the `schedule` field in `ScheduledJobSchema`:

```typescript
export const ScheduledJobSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'name must be lowercase alphanumeric with dashes'),
  schedule: z
    .string()
    .min(1)
    .refine(isValidCron, { message: 'schedule must be a 6-field cron expression (e.g. 0 0 9 * * *)' }),
  command: z.string().min(1).default('send'),
})
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
npx vitest run tests/schedule.test.ts
```

Expected: all pass (existing `renderOfeliaIni` suite + 9 new cron validation cases).

- [ ] **Step 5: Commit**

```bash
git add src/core/schedule.ts tests/schedule.test.ts
git commit -m "feat: add 6-field cron validation to ScheduledJobSchema"
```

---

## Task 2: `promptScheduleJobs` helper

**Files:**
- Modify: `src/cli/commands/setup.ts`
- Create: `tests/setup.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/setup.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { promptScheduleJobs } from '../src/cli/commands/setup.ts'

const createMockPrompt = (answers: string[]) => {
  let index = 0
  return async (_question: string): Promise<string> => answers[index++] ?? ''
}

describe('promptScheduleJobs', () => {
  it('returns one job when user declines to add more', async () => {
    const promptFn = createMockPrompt(['my-job', '0 0 9 * * *', 'n'])
    const jobs = await promptScheduleJobs(promptFn)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({ name: 'my-job', schedule: '0 0 9 * * *', command: 'send' })
  })

  it('returns one job when user presses enter (default N)', async () => {
    const promptFn = createMockPrompt(['my-job', '0 0 9 * * *', ''])
    const jobs = await promptScheduleJobs(promptFn)
    expect(jobs).toHaveLength(1)
  })

  it('collects two jobs when user enters y then n', async () => {
    const promptFn = createMockPrompt([
      'job-one', '0 0 9 * * *', 'y',
      'job-two', '0 0 19 * * *', 'n',
    ])
    const jobs = await promptScheduleJobs(promptFn)
    expect(jobs).toHaveLength(2)
    expect(jobs[1]).toMatchObject({ name: 'job-two', schedule: '0 0 19 * * *' })
  })

  it('re-prompts on invalid name and accepts the corrected one', async () => {
    const promptFn = createMockPrompt(['Invalid Name!', 'valid-name', '0 0 9 * * *', 'n'])
    const jobs = await promptScheduleJobs(promptFn)
    expect(jobs[0]!.name).toBe('valid-name')
  })

  it('re-prompts on invalid cron and accepts the corrected one', async () => {
    const promptFn = createMockPrompt(['my-job', '0 9 * * *', '0 0 9 * * *', 'n'])
    const jobs = await promptScheduleJobs(promptFn)
    expect(jobs[0]!.schedule).toBe('0 0 9 * * *')
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npx vitest run tests/setup.test.ts
```

Expected: module-not-found or export-not-found error for `promptScheduleJobs`.

- [ ] **Step 3: Add `promptScheduleJobs` to `setup.ts`**

`setup.ts` already imports from `../../core/schedule.ts`. Extend that existing import line to include `isValidCron`, `ScheduledJobSchema`, and `ScheduledJob`:

```typescript
// Change existing import line from:
import { defaultSchedule, saveSchedule } from '../../core/schedule.ts'
// to:
import { isValidCron, saveSchedule, ScheduledJobSchema, type ScheduledJob } from '../../core/schedule.ts'
```

(`defaultSchedule` is no longer needed after Task 3 removes the conditional write — drop it here.)

Then add the exported function anywhere before `registerSetup` (e.g., just above it):

```typescript
export const promptScheduleJobs = async (
  promptFn: (question: string) => Promise<string>,
): Promise<ScheduledJob[]> => {
  process.stderr.write(
    '\nConfigure your message schedule (at least one job required).\n' +
      'Job names: lowercase letters, numbers, and dashes only.\n' +
      'Cron pattern: 6 fields, e.g. 0 0 9 * * *  (sec min hour dom month dow)\n\n',
  )

  const jobs: ScheduledJob[] = []

  do {
    let name = ''
    while (!/^[a-z0-9-]+$/.test(name)) {
      name = (await promptFn('Job name: ')).trim()
      if (!/^[a-z0-9-]+$/.test(name)) {
        process.stderr.write('Name must be lowercase letters, numbers, and dashes only.\n')
      }
    }

    let schedule = ''
    while (!isValidCron(schedule)) {
      schedule = (await promptFn('Cron pattern (e.g. 0 0 9 * * *): ')).trim()
      if (!isValidCron(schedule)) {
        process.stderr.write(
          'Invalid cron pattern. Use 6 space-separated fields, e.g. 0 0 9 * * *\n',
        )
      }
    }

    jobs.push(ScheduledJobSchema.parse({ name, schedule, command: 'send' }))

    const more = (await promptFn('Add another schedule? (y/N) ')).trim().toLowerCase()
    if (more !== 'y') break
  } while (true)

  return jobs
}
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
npx vitest run tests/setup.test.ts
```

Expected: all 5 pass.

- [ ] **Step 5: Run full test suite — confirm no regressions**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/cli/commands/setup.ts tests/setup.test.ts
git commit -m "feat: add promptScheduleJobs helper for interactive schedule setup"
```

---

## Task 3: Wizard integration

**Files:**
- Modify: `src/cli/commands/setup.ts`

- [ ] **Step 1: Update `finalizeSetup` to accept jobs**

Find `finalizeSetup` in `src/cli/commands/setup.ts` (around line 141) and replace it:

```typescript
const finalizeSetup = (sessionId: string, jobs: ScheduledJob[]): void => {
  saveConfig({ ...loadConfig(), openwaSessionId: sessionId })
  if (!existsSync(promptPath())) {
    savePrompt(defaultPrompt)
  }
  saveSchedule({ jobs })
  console.warn('\n✓ All done! Run `waify send` to send your first message.')
}
```

Note: the `existsSync(scheduleJsonPath())` guard is removed — the user just configured the schedule explicitly so we always write it.

- [ ] **Step 2: Insert Step 5 and thread `jobs` to `finalizeSetup`**

Find the block after the phone number prompt that starts with `// Save Gemini key and recipient immediately` (around line 214). Insert the new step between saving credentials and writing docker-compose:

```typescript
        // Save Gemini key and recipient immediately so a QR timeout doesn't lose user input
        saveSecrets({ GEMINI_API_KEY: geminiKey.trim(), OPENWA_API_KEY: '' })
        saveConfig({ ...loadConfig(), recipients: [{ chatId }] })

        // Step 5 — Collect schedule jobs
        const jobs = await promptScheduleJobs((q) => promptLine(rl, q))

        // Step 6 — Write docker-compose.yml  (previously Step 5)
        console.warn('Writing docker-compose.yml...')
        writeFileSync(composePath(), composeTemplate(), 'utf-8')
```

Then find the single call to `finalizeSetup` (around line 500) and update it:

```typescript
        finalizeSetup(sessionId, jobs)
```

- [ ] **Step 3: Run full test suite — confirm all pass**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/setup.ts
git commit -m "feat: prompt user for schedule jobs during waify setup wizard"
```

---

## Task 4: PR

- [ ] **Step 1: Push branch and open PR**

```bash
git checkout -b feat/setup-schedule-prompt
git push -u origin feat/setup-schedule-prompt
gh pr create \
  --title "feat: interactive schedule prompt in setup wizard" \
  --body "$(cat <<'EOF'
## Summary
- Adds 6-field cron validation to \`ScheduledJobSchema\` (benefits \`waify schedule add\` too)
- Adds \`promptScheduleJobs\` helper that collects at least one job interactively
- Inserts schedule collection as Step 5 in \`waify setup\`, before the Docker automation starts

## Test plan
- [ ] \`npx vitest run\` — all tests pass
- [ ] \`npm run wife -- setup\` — wizard prompts for job name and cron after phone number
- [ ] Enter an invalid cron (5 fields) — wizard re-prompts with error message
- [ ] Enter an invalid name (spaces) — wizard re-prompts with error message
- [ ] Enter \`y\` when asked to add another — wizard collects second job
- [ ] After setup completes, \`~/.config/waify/schedule.json\` contains the entered jobs
EOF
)"
```
