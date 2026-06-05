<!--
  ⚠️ PR TITLE MUST BE A CONVENTIONAL COMMIT — it becomes the squash commit on
  `main` and drives the automated release. Examples:
    fix: handle empty recipient list      → patch release
    feat: add Telegram transport          → minor release
    feat!: drop Node 20 support           → major release  (add BREAKING CHANGE below)
    docs: clarify setup steps             → no release
-->

## What & why

<!-- What does this change and why? Link any related issue: Closes #123 -->

## How was it verified?

<!-- Commands run, manual testing, screenshots/logs. -->

- [ ] `npm test` passes
- [ ] `npm run build` succeeds

## Checklist

- [ ] PR **title** is a valid Conventional Commit (see banner above)
- [ ] Any `BREAKING CHANGE:` is described here in the body
- [ ] Tests added/updated for the change
