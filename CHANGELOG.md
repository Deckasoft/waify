# [1.0.0](https://github.com/Deckasoft/openWa-scripts/compare/v0.7.0...v1.0.0) (2026-06-05)


* feat!: read CLI version from package.json and cut 1.0 ([#22](https://github.com/Deckasoft/openWa-scripts/issues/22)) ([6a9ea10](https://github.com/Deckasoft/openWa-scripts/commit/6a9ea10c622862646641a486f9607787bdcf5295))


### BREAKING CHANGES

* first stable 1.0.0 release.

* docs: document release workflow and fix stale README references

- CLAUDE.md: add src/core/version.ts to the architecture list and a
  "Releases & versioning" section (semantic-release + squash-merge caveat).
- README: correct OpenWA links to the deckasoft/openwa fork actually run
  (ghcr.io/deckasoft/openwa), bump Node 20+ -> 22+, and list language/
  timezone in config.json plus the generated Dockerfile/ofelia.ini.

# [0.7.0](https://github.com/Deckasoft/openWa-scripts/compare/v0.6.2...v0.7.0) (2026-06-05)


### Features

* message language, timezone-aware schedule builder, TUI restart + disconnect ([#21](https://github.com/Deckasoft/openWa-scripts/issues/21)) ([ed230fc](https://github.com/Deckasoft/openWa-scripts/commit/ed230fc3db08a68da146b642a739aa4d98531653))

## [0.6.2](https://github.com/Deckasoft/openWa-scripts/compare/v0.6.1...v0.6.2) (2026-06-04)


### Bug Fixes

* don't backslash-escape `=` in ofelia.ini environment lines ([#20](https://github.com/Deckasoft/openWa-scripts/issues/20)) ([658c930](https://github.com/Deckasoft/openWa-scripts/commit/658c930af51723fcc480895e8bbcdbbe3eb2ecc6))

## [0.6.1](https://github.com/Deckasoft/openWa-scripts/compare/v0.6.0...v0.6.1) (2026-06-04)


### Bug Fixes

* wire up Ofelia scheduling end-to-end ([#19](https://github.com/Deckasoft/openWa-scripts/issues/19)) ([90a2cb0](https://github.com/Deckasoft/openWa-scripts/commit/90a2cb09f32e9e243db5b6d12b2bf9ddcf17e816))

# [0.6.0](https://github.com/Deckasoft/openWa-scripts/compare/v0.5.1...v0.6.0) (2026-05-26)


### Features

* auto-restart Ofelia scheduler after schedule add/remove ([#17](https://github.com/Deckasoft/openWa-scripts/issues/17)) ([e01f360](https://github.com/Deckasoft/openWa-scripts/commit/e01f360055f1353e479b11c98e841ce203470c60))

## [0.5.1](https://github.com/Deckasoft/openWa-scripts/compare/v0.5.0...v0.5.1) (2026-05-25)

# [0.5.0](https://github.com/Deckasoft/openWa-scripts/compare/v0.4.4...v0.5.0) (2026-05-25)


### Features

* interactive schedule prompt in setup wizard ([#16](https://github.com/Deckasoft/openWa-scripts/issues/16)) ([fc18d52](https://github.com/Deckasoft/openWa-scripts/commit/fc18d526a1856724d4a8e0ba092cb35d6b08922e))

## [0.4.4](https://github.com/Deckasoft/openWa-scripts/compare/v0.4.3...v0.4.4) (2026-05-25)


### Bug Fixes

* load secrets from envPath() and handle start-session timeout ([#15](https://github.com/Deckasoft/openWa-scripts/issues/15)) ([748bc08](https://github.com/Deckasoft/openWa-scripts/commit/748bc08a3ea2018f4d3f35af8443a7d01353034a))

## [0.4.3](https://github.com/Deckasoft/openWa-scripts/compare/v0.4.2...v0.4.3) (2026-05-25)


### Reverts

* Revert "fix: load secrets from envPath() and handle start-session timeout" ([15d5797](https://github.com/Deckasoft/openWa-scripts/commit/15d5797267c9739f1745ebf5e54757851ba68528))

## [0.4.2](https://github.com/Deckasoft/openWa-scripts/compare/v0.4.1...v0.4.2) (2026-05-25)


### Bug Fixes

* load secrets from envPath() and handle start-session timeout ([2a659dc](https://github.com/Deckasoft/openWa-scripts/commit/2a659dc474bd8288639cdc327f3d83dc45c92716))

## [0.4.1](https://github.com/Deckasoft/openWa-scripts/compare/v0.4.0...v0.4.1) (2026-05-25)


### Bug Fixes

* **setup:** QR rendering fix, PNG + curl fallback, skip re-run timeout ([#14](https://github.com/Deckasoft/openWa-scripts/issues/14)) ([19a4e36](https://github.com/Deckasoft/openWa-scripts/commit/19a4e36ac6ca72aad2cb8effcf4af40ce2023288))

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
