## [1.0.1](https://github.com/thtesche/mineflayer-boat/compare/v1.0.0...v1.0.1) (2026-11-03)


### Bug Fixes

* release workflow should only run after tests pass ([eda73f9](https://github.com/thtesche/mineflayer-boat/commit/eda73f9d27043e98f2ca5f123747440eaba5a503))

# 1.0.0 (2026-11-03)


### Bug Fixes

* correct unit test paths in npm scripts ([26796b0](https://github.com/thtesche/mineflayer-boat/commit/26796b05f683dd2189ba3ecc30a11e261d39e0a7))
* resolve TypeScript type errors in integration tests ([1d0a91e](https://github.com/thtesche/mineflayer-boat/commit/1d0a91e37161bc68e551e1fbcfed2001b14e2264))
* simplify GitHub Actions workflow (Docker tests run locally) ([14eedcd](https://github.com/thtesche/mineflayer-boat/commit/14eedcd7df16387668487d751d37764a0099276b))


### Features

* add comprehensive test infrastructure (Docker, CI/CD, integration tests) ([8aba0c1](https://github.com/thtesche/mineflayer-boat/commit/8aba0c13626e9f594a21b1b999fc4063d6f9bb8b))
* add travel() convenience API for complete boat journeys ([eb2be54](https://github.com/thtesche/mineflayer-boat/commit/eb2be54bf93e227ee39bdbde27368bbf05f8c08e))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Stable integration test suite (31 tests, 1 skipped) that gates CI on GitHub Actions
- Interactive 2D visualization of bot movement during drives
- Docker multi-version testing (1.21.4 and 26.1)
- MIT LICENSE file
- Semantic Release automation for npm publishing

### Changed
- Migrated vitest poolOptions to v4+ top-level config
- Improved Development documentation with clearer test setup instructions

### Fixed
- Stabilized integration tests by fixing double-reset desync in arena setup
- Replaced `waitForTicks()` with `sleep()` while mounted (physicsTick is paused)
- Fixed dismount test assertions to check guaranteed behavior only
- Batched console commands to single Docker exec to prevent CPU contention timeouts
- Added 500ms settle after arena reset to drain late packets from previous resets

## [0.1.0] - 2024-11-03

### Added
- Initial release: `place`, `board`, `drive`, `leave`, `recover` API
- Boat physics simulation with kinematic model
- Server correction tracking and resyncing
- Support for Minecraft 1.21.4 and 26.1
- Unit tests for kinematics and water detection
- Spike tests validating basic boat travel
- Docker-based integration testing infrastructure
