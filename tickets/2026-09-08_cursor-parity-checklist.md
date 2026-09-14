Priority: 5
Topics: [product]
GitHub: [#1764](https://github.com/framework/the-framework/issues/1764)

# Cursor parity checklist: what the framework covers, what is missing, what is skipped on purpose

## TLDR

Direction: an open-source alternative to Cursor's agent product on the skills architecture — "inferior is fine, but every important feature must be covered". The issue rates every feature on cursor.com/product against the framework: 13 covered, 7 partial, 4 missing, 8 skipped on purpose.

Missing: mobile, Linear integration, code review before merge (BugBot-like), plugin marketplace. Partial: subagents, starting an agent from our CLI, Slack (Discord only), debug with runtime data, team rules on one page, image as context, MCP as a user-facing feature.

Proposed order for the gaps:
1. Code review before merge, as a skill.
2. Start an agent from a terminal.
3. Team rules on one page (docs only).
4. MCP as a user-facing feature.
5. Image as context in the composer.
6. Slack beside Discord.
7. A phone-sized dashboard.

Linear and the marketplace wait for the catalogues and distribution design.

**Decisions wanted:** which of the four missing items are in, and whether any skipped row should not be. Per the maintainer (2026-09-08), the skills architecture comes first; Cursor features later.

## Why it matters

It is the yardstick for the product direction, and each accepted gap becomes its own ticket.

## Source

Imported from GitHub issue [framework/the-framework#1764](https://github.com/framework/the-framework/issues/1764), created 2026-09-08.
