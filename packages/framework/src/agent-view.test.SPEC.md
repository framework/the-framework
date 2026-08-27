What the tests cover, all against an agent's own event log:

- Lifecycle progress: an untouched agent, and one still on its birth branch, reads as building with no session name; the name is read off the latest observed branch, a rename wins, and a branch The Framework did not mint carries none; signalling ready for merge flips the agent to ready.
- The wrapped session: the driver and workspace from the opening announcement merge with the id and deep link from the latest one, and there is no session summary at all before the session opens. The workspace survives the later id announcement, because it is the pair together that reopens the coding agent's session after the worktree is gone. The model is folded per leg: the latest announcement wins, and a leg that recorded no model clears it.
- The handoff arming: an agent with no arming events reads as pushing and opening a PR — which is what it will actually do — while merging reads as off, because merging is opt-in and silence must never read as an agent that will land on the default branch by itself. The arming can be seeded from the agent's status record for a view that attached after the opening event, so a push-only agent never reads as "Open PR"; an arming event in the stream always wins over that seed; the latest arming wins, so unticking a box sticks; a merge-armed agent never reads as a draft PR, and an arming event that says nothing about merging leaves a seeded merge arming alone.
- The handoff outcome: once the handoff has run, the summary reports it as done with its URL, failed with the error the bar shows beside the retry button, or skipped with the reason.
- Errors: every error the agent reported is kept, oldest first, with its detail when the agent wrote one, and an agent that reported none has an empty list.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
