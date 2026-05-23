# Changelog

## [0.1.0] - 2026-05-23

### Added
- Initial open-source release of `waify` (formerly `openwa-scripts`)
- `waify setup` — guided first-run wizard: starts OpenWA via Docker, scans WhatsApp QR, configures Gemini API key and recipient
- AI provider abstraction (`src/core/providers/`) — Gemini ships in v1, interface ready for OpenAI/Anthropic/Ollama
- XDG config directories (`~/.config/waify/`) — works correctly from any working directory
- Recipients array schema with `min(1).max(1)` — future-ready for multi-recipient support
- Powered by [OpenWA](https://github.com/rmyndharis/OpenWA) — self-hosted WhatsApp API
