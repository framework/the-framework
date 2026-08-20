Reads and grants Claude Code's own folder trust, so a web run never dies on the CLI's interactive trust question.

## Flows

- The trust record written is the CLI's own — the same one the user's accepting of the dialog would leave behind — and everything else in the CLI's config survives the write.
- A record that is missing or not understood reads as unknown; a config file that exists but cannot be parsed is never overwritten — it is the CLI's file, so the write refuses instead.

## Rationales

- The write automates consent already given, it does not invent it: starting a web agent on a project is itself the user's trust decision. Left as a manual one-time fix, the trust question breaks the click-and-it-works story for web runs.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
