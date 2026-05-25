# QR Rendering Fix for `waify setup`

**Date:** 2026-05-24
**Status:** Approved, ready for implementation plan
**Scope:** `src/cli/commands/setup.ts`, `src/core/paths.ts`, tests

## Problem

During `waify setup`, the WhatsApp QR code never renders in the terminal. The wait spinner finishes silently and setup proceeds to polling for connection, leaving the user with no way to scan. Re-running `waify setup` does not fix the issue.

A secondary problem: when a previous run left the session in a `ready` (already-linked) state, the QR poll loop runs to its full 5-minute timeout because no QR is ever generated for a ready session.

## Root cause

`renderQrInTerminal` in `src/cli/commands/setup.ts` calls:

```ts
qrcode.generate(raw, { small: true }, () => resolve())
```

`qrcode-terminal`'s `generate` only writes to stdout when called *without* a callback. When a callback is provided, the rendered string is handed to the callback instead. The current code's callback ignores its argument, so the QR is generated but discarded. The PR #13 "fix" never actually printed anything; the bug is deterministic, which is why re-runs do not help.

## Goals

1. Restore terminal QR rendering.
2. Always provide a non-terminal fallback so the user can link their device even if the terminal QR is unscannable (small terminal, broken font, SSH session, copy/paste).
3. Skip the QR step when the session is already linked.

## Non-goals

- No changes to spinners, polling timeouts, Chromium lock cleanup, or any other setup step.
- No `--force` reset flag. Auto-skip on `ready` is sufficient.
- No new runtime dependency. The fallback uses POSIX `sed` and `base64`.

## Design

### 1. Fix terminal rendering

Replace the broken Promise-wrapped `renderQrInTerminal` with a synchronous boolean-returning function. `qrcode-terminal` writes synchronously when called without a callback, so the Promise wrapper is unnecessary.

```ts
const renderQrInTerminal = (dataUrl: string): boolean => {
  const raw = decodeQrDataUrl(dataUrl)
  if (!raw) return false
  qrcode.generate(raw, { small: true })
  return true
}
```

Return value tells the caller whether the terminal QR rendered, so the fallback messaging can adapt ("scan above OR open the image" vs. "open the image").

### 2. Save QR as PNG fallback

New helper `saveQrImage(dataUrl: string): string | null`:

- Strip the `data:image/png;base64,` prefix.
- Base64-decode the payload.
- Write to `qrImagePath()` (`~/.config/waify/qr.png`).
- Return the absolute path on success, `null` on failure.

Wrapped in try/catch — a write failure logs `Could not save QR image: <err>` and returns `null`. Setup does not fail.

### 3. Path helper

Add `qrImagePath()` to `src/core/paths.ts`, mirroring `composePath()`:

```ts
export const qrImagePath = (): string =>
  join(homedir(), '.config', 'waify', 'qr.png')
```

### 4. User-facing orchestrator

New helper `presentQr(dataUrl, sessionId, baseUrl, apiKey)`:

1. `renderQrInTerminal(dataUrl)` — terminal QR if decode succeeds.
2. If decode failed, print: `(Could not decode QR image — use the saved PNG or curl command below)`.
3. `saveQrImage(dataUrl)` — always attempt. On success print:
   ```
   QR also saved to: <path>
   Open it with:    open <path>
   ```
4. Always print the curl re-fetch one-liner (so the user has a way to retry if the QR expires before they scan):
   ```
   To re-fetch if it expires:
     curl -s -H "X-API-Key: <key>" <baseUrl>/api/sessions/<id>/qr \
       | sed 's/.*"qrCode":"data:image\/png;base64,//;s/".*//' \
       | base64 -d > waify-qr.png
   ```

The curl command intentionally uses `sed` (not `jq`) because `sed` and `base64` are POSIX-ubiquitous on macOS and Linux; we cannot assume `jq` is installed.

### 5. Re-run skip when already linked

Between the existing Step 11 (start session) and Step 12 (QR poll), add a single status check:

```ts
const preStatusRes = await fetchWithTimeout(
  `${baseUrl}/api/sessions/${sessionId}`,
  { headers: { 'X-API-Key': openwaApiKey } },
)
const preStatus = StatusResponseSchema.safeParse(await preStatusRes.json())
if (preStatus.success && preStatus.data.status === 'ready') {
  console.warn('✓ WhatsApp already linked — skipping QR scan')
  // Skip Step 12 (QR fetch + presentQr) and Step 13 (connection poll).
  // Continue from Step 14: persist sessionId, then Step 15: seed defaults.
}
```

If the status read fails or returns an unexpected shape, fall through to QR polling. We do not block setup on a transient status read.

## User flow

### First-time setup

```
✓ OpenWA API is ready
✓ Waiting for QR code (Chromium is starting)...

📱 Scan the QR code below with WhatsApp to link your device:
   Settings → Linked Devices → Link a Device

<ascii QR>

   QR also saved to: /Users/you/.config/waify/qr.png
   Open it with:    open /Users/you/.config/waify/qr.png

   To re-fetch if it expires:
     curl -s -H "X-API-Key: …" http://localhost:2785/api/sessions/…/qr \
       | sed 's/.*"qrCode":"data:image\/png;base64,//;s/".*//' | base64 -d > waify-qr.png

   (QR expires in ~20s — re-run setup if it expires before you scan)
⠋ Waiting for you to scan the QR code...
```

### Re-run with existing connected session

```
✓ OpenWA API is ready
✓ WhatsApp already linked — skipping QR scan
✓ All done! Run `waify send` to send your first message.
```

## Error handling

| Failure | Behavior |
|---|---|
| `decodeQrDataUrl` returns null | Print warning, skip terminal render, still save PNG and print curl. Image + curl become primary path. |
| `saveQrImage` write fails | Log warning, return null, omit the "Open it with" lines. Setup continues. |
| Status pre-check fails or returns unexpected shape | Fall through to existing QR poll loop. No regression. |
| OpenWA API returns QR successfully but PNG decode produces no QR data | Same as "decode returns null" — fallback path activates. |

## Testing

Vitest. New tests, all live alongside existing `tests/` files.

- `decodeQrDataUrl` round-trip: encode a known string to a QR PNG (via the `qrcode` package as a `devDependency`), feed through `decodeQrDataUrl`, assert the string round-trips. This test would have caught the original bug.
- `saveQrImage`: given a known data URL, writes a valid PNG at the path returned by `qrImagePath()`; bytes match the decoded base64. Uses `WIFE_DATA_DIR` override pattern from existing tests.
- `qrImagePath`: returns the expected absolute path; mirrors existing `paths.ts` test conventions.

Skipped (low value, high mock cost):
- The status pre-check skip path and the curl-string formatting are straight-line glue inside the action handler. Mocking the entire setup flow (Docker, fetch, readline) for these would dwarf the code under test.

## Implementation notes

- `qrcode-terminal` and `pngjs` + `jsqr` stay. Decode pipeline is correct; only the call site is wrong.
- The `qrcode` package is added as a `devDependency` only, for the round-trip test fixture.
- The PR should not bump the package version — semantic-release handles that on merge.

## Files touched

| File | Change |
|---|---|
| `src/cli/commands/setup.ts` | Fix `renderQrInTerminal`, add `saveQrImage` + `presentQr`, add status pre-check |
| `src/core/paths.ts` | Add `qrImagePath()` |
| `tests/setup.test.ts` (new) | Tests for `decodeQrDataUrl`, `saveQrImage`. Requires exporting both helpers from `setup.ts` (currently file-local). |
| `tests/paths.test.ts` (new) | Test for `qrImagePath` |
| `package.json` | Add `qrcode` to `devDependencies` |
