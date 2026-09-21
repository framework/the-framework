Issue: [#1764](https://github.com/framework/the-framework/issues/1764)

# Cursor parity checklist: what the framework covers, what is missing, what is skipped on purpose

## TLDR

The direction is an open-source alternative to Cursor's agent product, built on skills: "inferior is fine, but every important feature must be covered." The issue scores every feature on cursor.com/product against FEATURES-SPEC.md: 13 covered, 7 partial, 4 missing, 8 skipped on purpose (editor features, design mode, deep codebase search, checkpoints).

**Missing:** code review before merge (BugBot), Linear integration, plugin marketplace, mobile. **Partial:** subagents, starting an agent from a terminal, Slack (Discord only), debug with runtime data, team rules on one page, MCP as a user feature, image as context.

Proposed order for the gaps: (1) a code-review skill that reviews every PR on open, (2) start an agent from a terminal, (3) team rules on one page (docs only), (4) MCP as a user-facing feature, (5) image as context in the composer, (6) Slack beside Discord, (7) a phone-sized dashboard. Linear and the marketplace wait for the catalogues and the distribution design.

**Decisions wanted:** which of the four missing items are in, and whether any skipped row should not be.

## Why it matters

It is the yardstick for "every important feature covered", and it turns the gaps into an ordered backlog. It also lists what Cursor lacks: runs on the user's own subscription, quota-aware autonomy, tickets and claims on a git branch, routines, and working without the dashboard.

## Source

Imported from GitHub issue [framework/the-framework#1764](https://github.com/framework/the-framework/issues/1764), created 2026-09-08, no labels, 0 comments.
