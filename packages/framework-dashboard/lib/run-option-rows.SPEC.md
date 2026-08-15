The session options as one table with every rule between them already applied, so the launcher and the settings page render the same options and can never disagree.

## TLDR

- A box shows the option's effective value, not the stored one: an option overridden by another reads as off, because off is what the session will do.
- Transparent turns the whole framework off, so it disables every option below it.
- Publishing is a strict ladder — push branch, open PR, auto-merge — each rung alive only while the one below is on, which makes "publish nothing" expressible and the contradictory PR-without-push state unreachable. Auto-merge is the one rung off by default: publishing a branch is reversible, landing it is not.
- Three boxes, one stored rung: a row says what ticking it *writes* rather than assuming its own name is a setting, so unticking one lowers the whole ladder instead of leaving a merge armed over a pull request nobody asked for.
- The browser option is offered only under Claude Code, the one agent it is wired to; every disabled row says why.
- A finished session's composer shows the filtered subset of the same table: only the options a resume will actually apply.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
