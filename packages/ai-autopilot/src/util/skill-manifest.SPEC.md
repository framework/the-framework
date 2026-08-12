Parses a SKILL.md-shaped document — the one format shared by domain presets, loops, and prompt bundles — into a validated manifest (name, description, usage hints) and its markdown instructions body.

## TLDR

- The leading metadata block must carry a name (restricted to characters that survive later composition) and a description; hints like what it applies to, when to load it, and when to skip it are optional.
- Unknown fields are tolerated and dropped for forward compatibility; authors keep custom data under a dedicated metadata field that passes through untouched.
- Bad documents fail with errors naming the offending field and, when known, the source file.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
