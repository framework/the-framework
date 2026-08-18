The agent's transcript, shared by the live stream and the replay of a finished one: every event as a human-readable line, with the conversation and the agent's interactive surfaces rendered as themselves.

## TLDR

- Your prompts read YOU (blue) and the agent's replies AGENT, both as Markdown; a long message collapses to its first line and expands in place, and the system prompt hides behind a character count.
- The agent's first prompt is hoisted to the very top, so the log opens with what you asked rather than the machinery that preceded it; later turns stay where they happened.
- Colour carries meaning: failures red, your own turn blue, decision badges amber, milestones green, pushed surfaces primary — and a stopped agent is not an error, since stopping was asked for.
- When the transcript knows its agent, a decision row IS the interaction: an open question is answerable in place, an answered one collapses to a ✓ card, and one whose agent ended stays plain text — its audience is gone.
- The latest browser row hosts the live inline preview — one screencast, with re-said pages replacing their earlier row rather than stacking — and the live log follows the newest row but yields the moment the reader scrolls up.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
