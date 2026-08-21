The agent's transcript, shared by the live stream and the replay of a finished one: every event as a human-readable line, with the conversation and the agent's interactive surfaces rendered as themselves.

## Flows

- The user's prompts read YOU (blue) and the agent's replies AGENT, both as Markdown. A long message collapses to its first line and expands in place, and the system prompt hides behind a character count.
- The agent's first prompt is hoisted to the very top, so the log opens with what the user asked rather than the machinery that preceded it; later turns stay where they happened.
- Colour carries meaning: failures red, the user's own turn blue, decision badges amber, milestones green, the surfaces the agent pushes (views, previews, browser rows) primary — and a stopped agent is not an error, since stopping was asked for.
- When the transcript knows its agent, a decision row IS the interaction: an open question is answerable in place, an answered one collapses to a ✓ card, and one whose agent ended stays plain text — its audience is gone.
- The latest browser row hosts the live inline preview — there is one screencast, and a page announced again replaces its earlier row rather than stacking. The live log follows the newest row but yields the moment the reader scrolls up.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
