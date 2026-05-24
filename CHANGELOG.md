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
