The composer's token chips: pills that read nicely in the editor but always serialize back to the exact plain text the agent parses — macros like `<AWAIT>`, action calls like `showChoices()`, and project/file references.

## TLDR

- Holds the catalogs of insertable macros and agent-action calls, each with a one-line hint for the trigger menus.
- Typing a complete token by hand turns it into a chip on the spot, and a known token's casing is normalized to the canonical form the agent expects.
- A chip is one atomic unit — selected and deleted whole, not letter by letter.

## Rationales

- Because a chip flattens to its text verbatim (no escaping), the prompt over the wire is unchanged — presets and everything downstream keep working untouched.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
