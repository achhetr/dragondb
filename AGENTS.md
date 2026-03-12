# AGENTS Guidance

## Project Purpose

This repository is a Node.js TypeScript library for a cloud-agnostic DAL with failover.

## Local Setup

```bash
npm install
npm run typecheck
npm run build
```

## Runtime Model

- DB config model is `primary` + ordered `failovers`.
- The system resolves `dbType` first, then uses built-in `pg` support.
- Current release supports `pg` only.
- Use YAML for non-secret topology and failover settings.
- Use `.env` for secret values (credentials, URLs, passwords).
- Providers should use env-based `connectionString` references in YAML.
- YAML parsing is strict by default and should reject unknown keys.
- Provider names in YAML must follow a selected naming standard (default `kebab-case`).

## Reliability Rules

- Always attempt `primary` first.
- Apply `primaryRetryCooldownMs` after primary failures to avoid repeated hot-loop retries.
- On error, try `failovers` in configured order.
- Never swallow provider failures silently.
- Log provider attempts, failover events, health check results, and query IDs.
- Health checks must remain non-destructive (`SELECT 1`).

## Security Rules

- Never log secrets (passwords, tokens, full connection strings).
- Use parameterized SQL for values.
- Validate dynamic identifiers before interpolation.

## API Compatibility Rules

- Keep the public API small and stable.
- Prefer backward-compatible changes.
- Export clear TypeScript types for config, logging, and health status.

## Validation Before Commit

```bash
npm run lint
npm run format:check
npm run typecheck
npm run build
npm run test:unit
npm run test:integration
```
