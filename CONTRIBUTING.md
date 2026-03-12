# Contributing to SaiyanDB

Thanks for contributing.

## Ways to contribute

- Report bugs and edge cases
- Improve docs and examples
- Add tests (unit/integration)
- Propose features that keep API compatibility in mind

## Local setup

```bash
git clone https://github.com/akashpaudel/saiyandb.git
cd saiyandb
npm install
```

Recommended validation before opening a PR:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run build
npm run test:unit
npm run test:integration
```

If you use Docker integration tests:

```bash
npm run integration:up
npm run test:integration:docker
npm run integration:down
```

## Branch and PR workflow

- Create a branch from `main`.
- Keep PRs focused and small when possible.
- Include tests for behavior changes.
- Update docs when changing API, config, or workflows.
- Add clear PR description: what changed, why, and how to test.

## Coding guidelines

- Keep public API small and backward compatible.
- Keep failover behavior deterministic (primary first, then ordered failovers).
- Never log secrets (passwords, tokens, full connection strings).
- Use parameterized SQL for values.
- Validate dynamic identifiers before interpolation.
- Keep health checks non-destructive (`SELECT 1`).

## Testing expectations

- New logic should include unit tests.
- Failover behavior changes should include integration coverage.
- Avoid brittle tests tied to timing unless cooldown behavior is being tested.

## Commit conventions

No strict format is required, but these are preferred:

- Use imperative style (`add`, `fix`, `update`, `refactor`).
- Keep first line concise.
- Explain the reason in the body when context is important.

## Documentation expectations

When behavior changes, update:

- `README.md`
- `docs/quickstart.md`
- `docs/configuration.md`
- `docs/integration-testing.md` (if integration behavior changed)

## Questions

Open an issue for design discussion before implementing large changes.
