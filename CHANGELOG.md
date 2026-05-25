# [0.4.0](https://github.com/Deckasoft/openWa-scripts/compare/v0.3.10...v0.4.0) (2026-05-25)


### Features

* **setup:** add spinners and fix terminal QR code rendering ([#13](https://github.com/Deckasoft/openWa-scripts/issues/13)) ([1bec822](https://github.com/Deckasoft/openWa-scripts/commit/1bec8223385659fe0cdcaeca6eb5e44a6de5463c))

## [0.3.10](https://github.com/Deckasoft/openWa-scripts/compare/v0.3.9...v0.3.10) (2026-05-25)

## [0.3.9](https://github.com/Deckasoft/openWa-scripts/compare/v0.3.8...v0.3.9) (2026-05-25)


### Bug Fixes

* **setup:** handle 409/400 on re-runs by reusing existing session ([#11](https://github.com/Deckasoft/openWa-scripts/issues/11)) ([153ea44](https://github.com/Deckasoft/openWa-scripts/commit/153ea44941ba2d813943bd7046eb29283545165d))

## [0.3.8](https://github.com/Deckasoft/openWa-scripts/compare/v0.3.7...v0.3.8) (2026-05-24)


### Bug Fixes

* **setup:** read generated API key from container instead of hardcoding dev-admin-key ([#10](https://github.com/Deckasoft/openWa-scripts/issues/10)) ([86e77f6](https://github.com/Deckasoft/openWa-scripts/commit/86e77f6e56853c981173f96b7abd238a4bd735e7))

## [0.3.7](https://github.com/Deckasoft/openWa-scripts/compare/v0.3.6...v0.3.7) (2026-05-24)


### Bug Fixes

* **setup:** remove the openwa dashboard package image from setup template ([#9](https://github.com/Deckasoft/openWa-scripts/issues/9)) ([fb6529d](https://github.com/Deckasoft/openWa-scripts/commit/fb6529d2556a6ec3cd1356adec3968678439131c))

## [0.3.6](https://github.com/Deckasoft/openWa-scripts/compare/v0.3.5...v0.3.6) (2026-05-24)


### Bug Fixes

* **setup:** render QR in terminal, collect API keys upfront, add dev-admin-key fallback ([#8](https://github.com/Deckasoft/openWa-scripts/issues/8)) ([e34f63e](https://github.com/Deckasoft/openWa-scripts/commit/e34f63eadd2ad4f644d70fe2b93e711d6490862d))

## [0.3.5](https://github.com/Deckasoft/openWa-scripts/compare/v0.3.4...v0.3.5) (2026-05-24)


### Bug Fixes

* **setup:** correct docker compose template, API key bootstrap, and session flow ([#7](https://github.com/Deckasoft/openWa-scripts/issues/7)) ([1b1dbbd](https://github.com/Deckasoft/openWa-scripts/commit/1b1dbbd4c773f8320ea9073971a52a89d7dbea07))

## [0.3.4](https://github.com/Deckasoft/openWa-scripts/compare/v0.3.3...v0.3.4) (2026-05-24)

## [0.3.3](https://github.com/Deckasoft/openWa-scripts/compare/v0.3.2...v0.3.3) (2026-05-24)


### Bug Fixes

* uppercase status label in log entries ([#5](https://github.com/Deckasoft/openWa-scripts/issues/5)) ([b12b177](https://github.com/Deckasoft/openWa-scripts/commit/b12b1776b55ad6e577c5fb4a7a48af9062d65ab2))

## [0.3.2](https://github.com/Deckasoft/openWa-scripts/compare/v0.3.1...v0.3.2) (2026-05-24)


### Bug Fixes

* **init:** replace stale wifeChatId reference with recipients.0.chatId in next steps ([91004db](https://github.com/Deckasoft/openWa-scripts/commit/91004db9f41e0257e2fe0e8e37e12aaec4afa0cf))
* **init:** revert recipients path to wifeChatId alias supported by config set ([d22d3b3](https://github.com/Deckasoft/openWa-scripts/commit/d22d3b37cabf127d8f2d7e36bb6e8dacd4d7aeb6))

## [0.3.1](https://github.com/Deckasoft/openWa-scripts/compare/v0.3.0...v0.3.1) (2026-05-24)


### Bug Fixes

* **ci:** use GH_TOKEN so semantic-release tags trigger npm-publish workflow ([f82e895](https://github.com/Deckasoft/openWa-scripts/commit/f82e895f5924bf303d0855b6ce3c0b77b23e590b))

# [0.3.0](https://github.com/Deckasoft/openWa-scripts/compare/v0.2.2...v0.3.0) (2026-05-24)


### Bug Fixes

* **ci:** remove invalid package-manager-cache input, opt into Node.js 24 actions ([27f436c](https://github.com/Deckasoft/openWa-scripts/commit/27f436c629d3f2044b1003ec1cddd7700fa60218))


### Features

* **ci:** add semantic-release for automated versioning from conventional commits ([7a569e6](https://github.com/Deckasoft/openWa-scripts/commit/7a569e6d2221618e65a1e925d95569ccc855554d))

# Changelog

## [0.1.0] - 2026-05-23

### Added
- Initial open-source release of `waify` (formerly `openwa-scripts`)
- `waify setup` — guided first-run wizard: starts OpenWA via Docker, scans WhatsApp QR, configures Gemini API key and recipient
- AI provider abstraction (`src/core/providers/`) — Gemini ships in v1, interface ready for OpenAI/Anthropic/Ollama
- XDG config directories (`~/.config/waify/`) — works correctly from any working directory
- Recipients array schema with `min(1).max(1)` — future-ready for multi-recipient support
- Powered by [OpenWA](https://github.com/rmyndharis/OpenWA) — self-hosted WhatsApp API
