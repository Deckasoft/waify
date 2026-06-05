# Contributing to waify

Thanks for your interest in improving **waify**! This guide covers everything you
need to land a change.

## Prerequisites

- **Node.js 22+**
- **Docker** (only needed to exercise the WhatsApp API server / scheduler end-to-end)
- A **Google Gemini API key** for any change that actually generates messages —
  [get one free](https://aistudio.google.com/apikey)

## Local setup

```bash
git clone https://github.com/Deckasoft/waify.git
cd waify
npm install

npm run waify -- --help   # run the CLI via tsx (no build needed)
npm run tui               # launch the Ink TUI
npm run build             # bundle with tsup → dist/cli/index.js
npm test                  # run the vitest suite once
npm run test:watch        # watch mode while developing
```

Run a single test file:

```bash
npx vitest run tests/generateMessage.test.ts
```

See [`CLAUDE.md`](./CLAUDE.md) for a tour of the architecture (core modules, the
TUI, the Docker layout, and the scheduler).

## Workflow

1. **Branch** off `main` — never push directly to `main`.
2. Make your change, **add or update tests**, and keep the suite green
   (`npm test`) and the build clean (`npm run build`).
3. Open a **pull request** against `main`. CI runs build + tests on every PR.
4. A maintainer reviews and merges. PRs are **squash-merged**.

## Commit & PR conventions (please read — this drives releases)

Releases are fully automated by [semantic-release](https://semantic-release.gitbook.io/):
merging to `main` computes the next version from commit messages, publishes to
npm, tags the release, and updates the changelog. To make that work, we use
[Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Example | Release effect |
|---|---|---|
| `fix:` | `fix: handle empty recipient list` | patch (`x.y.Z`) |
| `feat:` | `feat: add Telegram transport` | minor (`x.Y.0`) |
| `feat!:` or a `BREAKING CHANGE:` footer | `feat!: drop Node 20 support` | major (`X.0.0`) |
| `docs:` / `chore:` / `refactor:` / `test:` | `docs: clarify setup steps` | no release |

> [!IMPORTANT]
> Because PRs are **squash-merged, only the PR title (+ body) becomes the commit
> on `main`.** So your **PR title must be a valid Conventional Commit** — e.g.
> `feat: add weekend-only schedule`. A wrong or missing prefix causes the release
> to be mis-versioned or skipped entirely. Put any `BREAKING CHANGE:` footer in
> the PR description.

## Code style

This is a strict-TypeScript, functional-leaning codebase. In short:

- Avoid `any` and `as` casts; prefer `zod` schemas for validation.
- Prefer immutability — no `let`/mutation where a functional form works.
- `const` arrow functions, named exports, ESM imports, no barrel files.
- No semicolons, single quotes, 100-char lines (enforced by Prettier).

When in doubt, match the surrounding code.

## Reporting issues

Use the [issue templates](https://github.com/Deckasoft/waify/issues/new/choose)
— bug reports and feature requests. For **security vulnerabilities, do not open a
public issue**; see [SECURITY.md](./SECURITY.md).

## Code of Conduct

By participating you agree to abide by our
[Code of Conduct](./CODE_OF_CONDUCT.md).
