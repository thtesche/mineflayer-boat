# Release Process

This project uses **Semantic Release** to automate version bumps, changelog generation, and npm publishing.

## How It Works

1. **Write conventional commits** during development
2. **Merge PRs to `main`**
3. **GitHub Actions runs Semantic Release** automatically
   - Analyzes commit messages
   - Bumps version (major.minor.patch)
   - Generates changelog
   - Creates GitHub release
   - Publishes to npm

No manual tagging or npm publishing needed!

## Conventional Commits

Format: `<type>(<scope>): <subject>`

### Types

- **`feat:`** — new feature → **minor** version bump
- **`fix:`** — bug fix → **patch** version bump
- **`perf:`** — performance improvement → **patch** version bump
- **`docs:`** — documentation only → **no version bump**
- **`chore:`** — build, CI, dependencies → **no version bump**
- **`refactor:`** — code refactor → **no version bump**
- **`test:`** — test changes → **no version bump**

### Breaking Changes

Add `BREAKING CHANGE:` in the commit body to trigger a **major** version bump:

```
feat: rewrite API

BREAKING CHANGE: The old `travel()` method has been removed.
Use `place()` + `drive()` instead.
```

## Examples

```bash
# Patch release (0.1.5)
git commit -m "fix: handle empty inventory on boat.recover()"

# Minor release (0.2.0)
git commit -m "feat: add route planning over water"

# Major release (1.0.0)
git commit -m "feat: redesign drive API

BREAKING CHANGE: drive() now takes a Route instead of Vec3"

# No release (docs update)
git commit -m "docs: clarify boat physics"
```

## Workflow

1. **Create a PR** with your changes
2. **Use conventional commits** in your PR
3. **Get reviewed and approved**
4. **Merge to `main`**
5. **GitHub Actions** automatically:
   - Detects the commits
   - Bumps version in `package.json`
   - Updates `CHANGELOG.md`
   - Creates a GitHub Release
   - Publishes to npm
   - Pushes version commit back to `main`

## Requirements

### GitHub Secrets

Set these in Settings → Secrets and variables → Actions:

- **`NPM_TOKEN`** — npm API token for publishing
  - Create at: https://www.npmjs.com/settings/your-username/tokens
  - Type: Automation token
  - Permissions: Publish

`GITHUB_TOKEN` is provided automatically by GitHub Actions.

## Dry Run (Local)

Test the release process without publishing:

```bash
npx semantic-release --dry-run
```

This shows what version would be bumped and what changelog would be generated, without actually publishing.

## Manual Release (if needed)

If automation fails, you can release manually:

```bash
npx semantic-release --no-ci
```

(Requires `NPM_TOKEN` in environment or `~/.npmrc`)

## Disabling Auto-Release

To prevent a commit from triggering a release, add `[skip ci]` to the commit message:

```bash
git commit -m "docs: minor typo [skip ci]"
```
