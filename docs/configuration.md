# Configuration

## Recommended pattern

- Keep topology in YAML (`primary`, ordered `failovers`, provider metadata).
- Keep sensitive values in `.env` and reference them from YAML `env.connectionString` keys.

## Validation behavior

- YAML schema is strict by default (`strict: true`).
- Unknown keys are rejected.
- Provider names follow a naming standard (`kebab-case` by default).
- Missing env vars referenced in YAML are rejected during config load.
- Each provider must define `env.connectionString`.

## Naming standards

- `kebab-case`
- `snake_case`
- `camelCase`
- `pascalCase`
