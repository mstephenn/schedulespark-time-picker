# Time Picker Package Release Process

This runbook prepares `@schedulespark/time-picker` for npm publishing.

## Release Gates

Complete these checks before the first publish and before every subsequent beta:

- Package metadata: name, exports, `files`, license, repository, and `publishConfig`.
- README: install instructions, styling import, usage, options, range behavior, and screenshots.
- Changelog: a release entry exists for the version being published.
- API review: public exports are reviewed for stability and documented in `docs/public-api-review.md`.
- Security review: dependency and package-content checks are recorded in `docs/security-review.md`.
- CI: package test, typecheck, lint, and build jobs pass.

## Version Approval

Do not change `packages/time-picker/package.json` `version` without explicit approval from the maintainer. Version bumps are release decisions, not incidental cleanup.

## Prepublish Commands

Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @schedulespark/time-picker test
pnpm --filter @schedulespark/time-picker typecheck
pnpm --filter @schedulespark/time-picker lint
pnpm --filter @schedulespark/time-picker build
pnpm --filter @schedulespark/time-picker pack --dry-run
```

Inspect the dry-run package file list. It should include `package.json`, `dist`, README, license, changelog, and package docs.

## Publish Command

After version approval and all release gates pass:

```bash
pnpm --filter @schedulespark/time-picker publish --access public --tag beta
```
