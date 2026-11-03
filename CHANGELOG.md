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
