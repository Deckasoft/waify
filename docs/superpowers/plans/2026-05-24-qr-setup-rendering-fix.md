# QR Setup Rendering Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the QR code never rendering during `waify setup`, add always-on PNG + curl fallback, and auto-skip the QR step when the WhatsApp session is already linked.

**Architecture:** Extract the QR decode and PNG-save logic into a new `src/core/qr.ts` module so it's testable and follows the codebase's "pure functions in `src/core/`" pattern. Fix the call-site bug in `setup.ts` (a `qrcode-terminal` callback that discarded the rendered string). Add a `presentQr` orchestrator in `setup.ts` that always prints the terminal QR, the saved PNG path, and a curl re-fetch one-liner. Add a single status pre-check before QR polling to skip the QR step on re-runs when the session is already `ready`.

**Tech Stack:** TypeScript (ESM, strict), Node 22, vitest, `qrcode-terminal` + `pngjs` + `jsqr` (existing), `qrcode` (new devDependency for test fixtures).

**Spec:** `docs/superpowers/specs/2026-05-24-qr-setup-rendering-fix-design.md`

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/core/paths.ts` | modify | Add `qrImagePath()` |
| `src/core/qr.ts` | create | Pure `decodeQrDataUrl` (PNG data URL → raw QR string) and `saveQrImage` (data URL → PNG file at `qrImagePath()`) |
| `src/cli/commands/setup.ts` | modify | Replace broken `renderQrInTerminal`, add `presentQr` orchestrator, add session-status pre-check, remove now-duplicated `decodeQrDataUrl` and its `pngjs`/`jsqr` imports |
| `tests/paths.test.ts` | create | Test `qrImagePath()` |
| `tests/qr.test.ts` | create | Round-trip test for `decodeQrDataUrl` + write/error tests for `saveQrImage` |
| `package.json` | modify | Add `qrcode` to `devDependencies` |

---

## Task 1: Add `qrImagePath()` to `src/core/paths.ts`

**Files:**
- Create: `tests/paths.test.ts`
- Modify: `src/core/paths.ts` (add one export after line 20)

- [ ] **Step 1: Write the failing test**

Create `tests/paths.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest'
import { join } from 'path'
import { homedir } from 'os'
import { qrImagePath } from '../src/core/paths.ts'

describe('qrImagePath', () => {
  afterEach(() => {
    delete process.env['WAIFY_DATA_DIR']
  })

  it('returns <WAIFY_DATA_DIR>/qr.png when WAIFY_DATA_DIR is set', () => {
    process.env['WAIFY_DATA_DIR'] = '/tmp/waify-test'
    expect(qrImagePath()).toBe('/tmp/waify-test/qr.png')
  })

  it('defaults to ~/.config/waify/qr.png when WAIFY_DATA_DIR is not set', () => {
    delete process.env['WAIFY_DATA_DIR']
    expect(qrImagePath()).toBe(join(homedir(), '.config', 'waify', 'qr.png'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/paths.test.ts`
Expected: FAIL with `"qrImagePath" is not exported by "src/core/paths.ts"` (or similar import-resolution error).

- [ ] **Step 3: Add `qrImagePath()` to `src/core/paths.ts`**

Append this export at the bottom of `src/core/paths.ts` (after `composePath`):

```ts
export const qrImagePath = (): string => join(dataDir(), 'qr.png')
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/paths.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/paths.ts tests/paths.test.ts
git commit -m "feat(paths): add qrImagePath helper for saved QR PNG fallback"
```

---

## Task 2: Add `qrcode` as a devDependency (test fixture only)

The test for `decodeQrDataUrl` needs to generate a real QR PNG from a known string. The `qrcode` package (different from the already-installed `qrcode-terminal`) provides `QRCode.toBuffer(str)` for this purpose. It ships its own TypeScript types — no `@types/qrcode` needed.

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

Run: `npm install --save-dev qrcode`
Expected: `package.json` and `package-lock.json` updated; `node_modules/qrcode` exists.

- [ ] **Step 2: Verify it's marked as devDependency only**

Run: `node -e "const p=require('./package.json'); console.log('dev:', !!p.devDependencies.qrcode, 'runtime:', !!p.dependencies?.qrcode)"`
Expected: `dev: true runtime: false`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add qrcode devDependency for QR round-trip test fixture"
```

---

## Task 3: Create `src/core/qr.ts` with `decodeQrDataUrl` and `saveQrImage`

This task moves `decodeQrDataUrl` out of `setup.ts` (where it can't be tested without mocking the whole CLI flow) and adds the new `saveQrImage` next to it. `decodeQrDataUrl` is wrapped in try/catch so malformed PNGs return `null` instead of throwing — this matches the spec's error-handling table.

**Files:**
- Create: `src/core/qr.ts`
- Create: `tests/qr.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/qr.test.ts`:

```ts
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import QRCode from 'qrcode'
import * as fs from 'fs'

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof fs>('fs')
  return {
    ...actual,
    writeFileSync: vi.fn(),
  }
})

const KNOWN_QR_STRING = 'waify-qr-test-fixture'
let testDataUrl: string

beforeAll(async () => {
  const buffer = await QRCode.toBuffer(KNOWN_QR_STRING, { type: 'png', scale: 4 })
  testDataUrl = `data:image/png;base64,${buffer.toString('base64')}`
})

beforeEach(() => {
  vi.clearAllMocks()
  process.env['WAIFY_DATA_DIR'] = '/tmp/waify-qr-test'
})

describe('decodeQrDataUrl', () => {
  it('round-trips a known string through PNG encode + decode', async () => {
    const { decodeQrDataUrl } = await import('../src/core/qr.ts')
    expect(decodeQrDataUrl(testDataUrl)).toBe(KNOWN_QR_STRING)
  })

  it('returns null when the payload is not a valid PNG', async () => {
    const { decodeQrDataUrl } = await import('../src/core/qr.ts')
    const garbage = `data:image/png;base64,${Buffer.from('not-a-png').toString('base64')}`
    expect(decodeQrDataUrl(garbage)).toBeNull()
  })
})

describe('saveQrImage', () => {
  it('writes decoded PNG bytes to qrImagePath() and returns the path', async () => {
    const { saveQrImage } = await import('../src/core/qr.ts')
    const { qrImagePath } = await import('../src/core/paths.ts')

    const result = saveQrImage(testDataUrl)

    expect(result).toBe(qrImagePath())
    const write = vi.mocked(fs.writeFileSync)
    expect(write).toHaveBeenCalledOnce()
    const [path, bytes] = write.mock.calls[0] as [string, Buffer]
    expect(path).toBe(qrImagePath())
    const expected = Buffer.from(
      testDataUrl.replace(/^data:image\/\w+;base64,/, ''),
      'base64',
    )
    expect(Buffer.compare(bytes, expected)).toBe(0)
  })

  it('returns null and warns when writeFileSync throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(fs.writeFileSync).mockImplementationOnce(() => {
      throw new Error('disk full')
    })

    const { saveQrImage } = await import('../src/core/qr.ts')
    const result = saveQrImage(testDataUrl)

    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('disk full'))
    warnSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/qr.test.ts`
Expected: FAIL — `Cannot find module '../src/core/qr.ts'` (the module doesn't exist yet).

- [ ] **Step 3: Create `src/core/qr.ts`**

```ts
import { writeFileSync } from 'fs'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'
import { qrImagePath } from './paths.ts'

const stripDataUrlPrefix = (dataUrl: string): string =>
  dataUrl.replace(/^data:image\/\w+;base64,/, '')

export const decodeQrDataUrl = (dataUrl: string): string | null => {
  try {
    const buffer = Buffer.from(stripDataUrlPrefix(dataUrl), 'base64')
    const png = PNG.sync.read(buffer)
    const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)
    return result?.data ?? null
  } catch {
    return null
  }
}

export const saveQrImage = (dataUrl: string): string | null => {
  try {
    const buffer = Buffer.from(stripDataUrlPrefix(dataUrl), 'base64')
    const path = qrImagePath()
    writeFileSync(path, buffer)
    return path
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`Could not save QR image: ${msg}`)
    return null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/qr.test.ts`
Expected: PASS, 4 tests (`round-trips`, `returns null when payload is not a valid PNG`, `writes decoded PNG bytes`, `returns null and warns when writeFileSync throws`).

- [ ] **Step 5: Commit**

```bash
git add src/core/qr.ts tests/qr.test.ts
git commit -m "feat(core): add qr module with decodeQrDataUrl and saveQrImage"
```

---

## Task 4: Wire the fix into `src/cli/commands/setup.ts`

Four changes in one task because they're tightly coupled (changing the import surface, swapping the call-site, and adding the pre-check all touch the same file and must land together to keep the file consistent):

1. Swap imports: remove `pngjs` and `jsqr`, add `decodeQrDataUrl` + `saveQrImage` from `../../core/qr.ts`.
2. Delete the file-local `decodeQrDataUrl`.
3. Replace the Promise-wrapped `renderQrInTerminal` with the synchronous version, and add `presentQr`.
4. In the `setup` action handler: add the status pre-check, and replace the `await renderQrInTerminal(qrCode)` call with `presentQr(...)`.

**Files:**
- Modify: `src/cli/commands/setup.ts`

- [ ] **Step 1: Swap imports**

In `src/cli/commands/setup.ts`, find lines 7–9:

```ts
import qrcode from 'qrcode-terminal';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
```

Replace with:

```ts
import qrcode from 'qrcode-terminal';
import { decodeQrDataUrl, saveQrImage } from '../../core/qr.ts';
```

- [ ] **Step 2: Delete the file-local `decodeQrDataUrl`**

In `src/cli/commands/setup.ts`, delete lines 81–87 (the entire `decodeQrDataUrl` function — the canonical version now lives in `src/core/qr.ts`):

```ts
const decodeQrDataUrl = (dataUrl: string): string | null => {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  const png = PNG.sync.read(buffer);
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return result?.data ?? null;
};
```

- [ ] **Step 3: Replace `renderQrInTerminal` with the synchronous version, add `presentQr`**

The remaining `renderQrInTerminal` in `src/cli/commands/setup.ts` (was lines 89–100) currently looks like:

```ts
const renderQrInTerminal = (dataUrl: string): Promise<void> =>
  new Promise((resolve) => {
    const raw = decodeQrDataUrl(dataUrl);
    if (raw) {
      qrcode.generate(raw, { small: true }, () => resolve());
    } else {
      console.warn(
        '   (Could not decode QR image — try scanning from the API URL instead)',
      );
      resolve();
    }
  });
```

Replace that entire function with:

```ts
const renderQrInTerminal = (dataUrl: string): boolean => {
  const raw = decodeQrDataUrl(dataUrl);
  if (!raw) return false;
  qrcode.generate(raw, { small: true });
  return true;
};

const presentQr = (
  dataUrl: string,
  sessionId: string,
  baseUrl: string,
  apiKey: string,
): void => {
  const rendered = renderQrInTerminal(dataUrl);
  if (!rendered) {
    console.warn(
      '   (Could not decode QR image — use the saved PNG or curl command below)',
    );
  }
  const savedPath = saveQrImage(dataUrl);
  if (savedPath) {
    console.warn(`\n   QR also saved to: ${savedPath}`);
    console.warn(`   Open it with:    open ${savedPath}`);
  }
  console.warn('\n   To re-fetch the QR if it expires:');
  console.warn(
    `     curl -s -H "X-API-Key: ${apiKey}" ${baseUrl}/api/sessions/${sessionId}/qr \\`,
  );
  console.warn(
    `       | sed 's/.*"qrCode":"data:image\\/png;base64,//;s/".*//' \\`,
  );
  console.warn(`       | base64 -d > waify-qr.png`);
};
```

- [ ] **Step 4: Add the status pre-check in the action handler**

In the `setup` action, find the existing `startRes` block (currently lines 348–361). After the `if (!startRes.ok && startRes.status !== 400) { ... }` check, insert the pre-check block:

```ts
        // Pre-check — if the session is already linked from a previous run,
        // skip the QR poll (which would otherwise wait the full 5 min timeout
        // because OpenWA doesn't generate a QR for ready sessions).
        try {
          const preStatusRes = await fetchWithTimeout(
            `${baseUrl}/api/sessions/${sessionId}`,
            { headers: { 'X-API-Key': openwaApiKey } },
          );
          if (preStatusRes.ok) {
            const preStatus = StatusResponseSchema.safeParse(
              await preStatusRes.json(),
            );
            if (preStatus.success && preStatus.data.status === 'ready') {
              console.warn('✓ WhatsApp already linked — skipping QR scan');
              saveConfig({ ...loadConfig(), openwaSessionId: sessionId });
              if (!existsSync(promptPath())) {
                savePrompt(defaultPrompt);
              }
              if (!existsSync(scheduleJsonPath())) {
                saveSchedule(defaultSchedule);
              }
              console.warn(
                '\n✓ All done! Run `waify send` to send your first message.',
              );
              return;
            }
          }
        } catch {
          // Status read failed — fall through to QR polling. No regression.
        }
```

- [ ] **Step 5: Replace the `renderQrInTerminal` call-site with `presentQr`**

Find the existing block (currently around lines 395–404):

```ts
        if (qrCode) {
          await renderQrInTerminal(qrCode);
          console.warn(
            '\n   (QR expires in ~20s — re-run setup if it expires before you scan)',
          );
        } else {
          console.warn(
            '   QR code was not ready in time. Re-run `waify setup` to try again.',
          );
        }
```

Replace with (no more `await` — `presentQr` is synchronous):

```ts
        if (qrCode) {
          presentQr(qrCode, sessionId, baseUrl, openwaApiKey);
          console.warn(
            '\n   (QR expires in ~20s — re-run setup if it expires before you scan)',
          );
        } else {
          console.warn(
            '   QR code was not ready in time. Re-run `waify setup` to try again.',
          );
        }
```

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: All tests pass — the new `paths.test.ts` and `qr.test.ts` plus the existing `generateMessage.test.ts`, `logger.test.ts`, `sendMessage.test.ts`.

- [ ] **Step 7: Run a type-check / build**

Run: `npm run build`
Expected: tsup builds `dist/cli/index.js` without TypeScript errors. Confirms that the removed `pngjs`/`jsqr` imports are not still referenced anywhere in `setup.ts` and that the new `presentQr` signature is consistent.

- [ ] **Step 8: Manual smoke (optional but recommended)**

If Docker is available locally:

Run: `npm run waify -- setup`
Expected: When the QR PNG arrives, the terminal shows an ASCII QR block, followed by `QR also saved to: ~/.config/waify/qr.png`, the `Open it with: open …` line, and the multi-line curl command. The `waify-qr.png` file should exist after running the printed curl one-liner.

If you have an already-linked session (re-run case):
Run: `npm run waify -- setup` (second time)
Expected: After "OpenWA API is ready" you see "✓ WhatsApp already linked — skipping QR scan" and setup completes without hitting the 5-minute QR timeout.

- [ ] **Step 9: Commit**

```bash
git add src/cli/commands/setup.ts
git commit -m "$(cat <<'EOF'
fix(setup): render QR properly, add PNG + curl fallback, skip on ready

The qrcode-terminal call passed a callback, which makes the library hand
the rendered string to the callback instead of printing to stdout. The
callback discarded its argument, so the QR was generated but never shown.

Move decodeQrDataUrl into src/core/qr.ts alongside a new saveQrImage
helper that writes the PNG to ~/.config/waify/qr.png. Add a presentQr
orchestrator that always prints the terminal QR (when decodable), the
saved-image path, and a curl re-fetch one-liner using sed + base64
(POSIX-ubiquitous, no jq dependency).

Add a session-status pre-check between session start and QR polling so
re-runs against an already-linked session skip the 5-minute QR timeout
and proceed directly to seeding defaults.
EOF
)"
```

---

## Self-review

**Spec coverage:**
- Goal 1 (restore terminal QR rendering) → Task 4 Steps 1–3 (drop callback, sync render).
- Goal 2 (always-on fallback: PNG + curl) → Task 3 (`saveQrImage`) + Task 4 Step 3 (`presentQr`).
- Goal 3 (skip when ready) → Task 4 Step 4 (pre-check).
- Spec §1 Fix terminal rendering → Task 4 Step 3.
- Spec §2 Save QR as PNG fallback → Task 3.
- Spec §3 Path helper → Task 1.
- Spec §4 User-facing orchestrator (`presentQr`) → Task 4 Step 3.
- Spec §5 Re-run skip → Task 4 Step 4.
- Spec error-handling table:
  - `decodeQrDataUrl` returns null → covered by `presentQr` warning branch (Task 4 Step 3) + unit test (Task 3 Step 1, "returns null when payload is not a valid PNG").
  - `saveQrImage` write fails → covered by try/catch in `saveQrImage` (Task 3 Step 3) + unit test (Task 3 Step 1, "returns null and warns when writeFileSync throws").
  - Status pre-check fails → covered by the `try/catch` wrapping the pre-check (Task 4 Step 4) — falls through to existing QR poll.
- Spec testing requirements: `decodeQrDataUrl` round-trip ✓, `saveQrImage` write + error ✓, `qrImagePath` ✓.
- Spec implementation notes: `qrcode-terminal`/`pngjs`/`jsqr` retained ✓, `qrcode` added as devDependency only ✓ (Task 2 Step 2 verifies), no version bump ✓ (no `package.json` version edit anywhere).

**Placeholder scan:** None. Every code block is complete; every command has an exact expected outcome.

**Type consistency:**
- `decodeQrDataUrl(dataUrl: string): string | null` — same signature in `src/core/qr.ts` (Task 3 Step 3) and at the call site inside `renderQrInTerminal` (Task 4 Step 3).
- `saveQrImage(dataUrl: string): string | null` — same signature in `src/core/qr.ts` (Task 3 Step 3) and call site inside `presentQr` (Task 4 Step 3).
- `qrImagePath(): string` — same signature in `src/core/paths.ts` (Task 1 Step 3), imported by `src/core/qr.ts` (Task 3 Step 3).
- `presentQr(dataUrl: string, sessionId: string, baseUrl: string, apiKey: string): void` — defined and called consistently in Task 4 Steps 3 and 5.
- `StatusResponseSchema` — already declared at the top of `setup.ts` (line 28); reused by the pre-check in Task 4 Step 4.
- `WAIFY_DATA_DIR` env var name — matches the actual name in `src/core/paths.ts:5` (verified during context-gathering, not the `WIFE_DATA_DIR` typo from the spec).
