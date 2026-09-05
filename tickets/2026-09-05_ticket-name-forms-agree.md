Priority: 4
Topics: [skill-tickets]

# A dot-prefixed ticket filename passes as a bare name but not as a path

## TLDR

In `packages/skill-tickets/src/names.ts`, `isTicketFile('.x.md')` is true while `isTicketPath('tickets/.x.md')` is false. The `tickets` command takes both forms for every `<file>` and `SKILL.md` calls them equivalent, so `tickets show .x.md` reads the file while `tickets show tickets/.x.md` refuses with `invalid-path`. Make the two gates agree: a leading dot is refused in both. Add a case to `names.test.ts` for each gate.

## Why it matters

A queue entry's link target is pasted into a command as is, and an agent that sees one form accepted and the other refused for the same name cannot tell what the rule is.
