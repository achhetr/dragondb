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
- The system resolves `dbType` first, then uses the registered driver.
- Current release supports `pg` only.
- Custom drivers can be added through `registerDriver()`.
- Use YAML for non-secret topology and failover settings.
- Use `.env` for secret values (credentials, URLs, passwords).

## Reliability Rules

- Always attempt `primary` first.
- On error, try `failovers` in configured order.
- Never swallow provider failures silently.
- Log provider attempts, failover events, and health check results.
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
npm run typecheck
npm run build
npm test
```
