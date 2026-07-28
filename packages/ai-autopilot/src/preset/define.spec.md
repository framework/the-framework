`defineDomainPreset` — fail-fast validation of a `DomainPresetSpec` into a frozen `DomainPreset`, plus `DomainPresetError`.

## TLDR

- Requires a kebab-case `name`; `title` defaults to `name`, `description` to `''`, `loops`/`prompts` to frozen empty arrays so callers never null-check.
- `defaultEvent` is trimmed and omitted entirely when blank.
