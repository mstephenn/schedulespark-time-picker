# Security and Dependency Review

This document records the security checks required before publishing `@schedulespark/time-picker`.

## Current Dependency Model

- Runtime dependencies: none.
- Development dependencies: TypeScript and Vitest.

The package does not perform network requests, execute user-provided code, store secrets, or inject untrusted HTML.

## Required Checks Before First Publish

Run from the repository root:

```bash
pnpm audit --prod
pnpm --filter @schedulespark/time-picker pack --dry-run
```

Review the dry-run package contents for accidental source maps, local environment files, generated secrets, test fixtures with private data, or unrelated monorepo files.

Expected package contents are constrained by `files` in `package.json`:

- `CHANGELOG.md`
- `docs`
- `dist`
- `README.md`
- `LICENSE`

## Manual Review Checklist

- No `.env`, credentials, service tokens, or private URLs in the packed package.
- No bundled app-specific ScheduleSpark business logic in the package.
- No runtime dependency without a license and maintenance review.
- Package source does not use `innerHTML` or inject untrusted HTML.

## First Publish Decision

For this SCH-49 readiness pass:

- `pnpm audit --prod` reported no known vulnerabilities.
- `pnpm --filter @schedulespark/time-picker pack --dry-run` included only the expected package metadata, `dist`, README, license, changelog, package docs, and README screenshots.
- `npm whoami` returned `E401 Unauthorized` in the local environment, so publishing requires npm authentication before running the publish command.
