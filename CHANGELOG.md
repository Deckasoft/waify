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
