Priority: 2
GitHub: [#945](https://github.com/gemstack-land/the-framework/issues/945)

# Discord chat assumes one live run per project

## TLDR

`discord/live-run.ts` `snapshotLiveRun` picks `metas.find(status === 'running')` — whichever running meta lists first — but since #736 a project can run several sessions at once, so chat routes to an arbitrary one. Found during the pinnacle-3 audit (PR #937). Minimum fix: state the single-live-run constraint in the module comment; real fix: let the bot list/target runs. Thread direction: the bot could always start a new session, guess the right project, run in a special "root but safe" directory, and ask the user when the project context isn't clear.

## Why it matters

With multi-session projects now real, a Discord message can silently steer the *wrong* run — an correctness issue for the chat surface, even if "one live run" was an acceptable MVP constraint. The open design question (how the bot picks among multiple active sessions and projects) is answered in outline but not built.

## Source

Imported from GitHub issue [gemstack-land/the-framework#945](https://github.com/gemstack-land/the-framework/issues/945), created 2026-07-21, label: `priority: low`, 3 comments.

### Original description

Found during the pinnacle-3 audit (PR #937).

discord/live-run.ts snapshotLiveRun picks `metas.find(status === 'running')` - whichever running meta lists first - but since #736 a project can run several sessions at once, so chat routes to an arbitrary one. Likely an accepted MVP constraint of the chat surface (routing models a single live run), but it is stated nowhere. Minimum fix: say so in the module comment; real fix: let the bot list/target runs.

### Notes from the GitHub thread

- Tested behavior: the bot picks the first running session, or starts a new one if none is active. Open question raised: what if the user has multiple active sessions and multiple projects?
- Maintainer suggestions: always start a new session; ideally guess the right project; run the bot in a special directory (the "root but safe" directory previously discussed) with a system prompt line "If context isn't clear (what project), ask user for context".
