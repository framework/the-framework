Everything the daemon runs in the background beside serving the dashboard: Discord notifications, automatic project management, CI watching, data-branch syncing, and disk reclamation.

## User Stories

- The user toggles a background service on the dashboard and it takes effect without restarting the daemon.
- The user pastes a Discord webhook into the dashboard and notifications start immediately.
- The user walks away and idle quota is spent on the roadmap: unattended agents drain the confirmed queue, CI-green pull requests are merged, and red ones get a fix agent.
- The user reads on this machine what other machines and cloud sessions pushed, without waiting.
- The user sees a project flagged when its shared data cannot reach origin, and the flag clears with the first sync that converges.

## Flows

- One clock runs every background job, each declaring how many ticks it wants between turns rather than owning an interval.
- Every service re-reads its preference on each tick, so a dashboard toggle takes effect without restarting the daemon.
- An agent the daemon starts resolves its options from the same two tiers the launcher uses — your settings, then the repo's committed file — so one nobody asked for and one someone clicked differ only in who asked.
- Auto PM spends idle quota on the roadmap: it fans out up to the configured number of unattended agents, each pinned to one queue entry. An entry is retired on the data branch (the dedicated branch the framework's shared records live on) once its agent's ending reports the work published — and it is the daemon, never the agent, that writes queue check-offs and ticket locks.
- The CI watch merges a watched PR once its checks pass, and puts a fix agent on one whose checks fail.
- An hourly sweep deletes the dead refs Claude-web hand-offs leave on origin, once they are old enough and provably hold no work.
- Settled web runs are matched to the `claude/*` branch that grew out of their hand-off, and the branch and its PR are adopted onto the run's record — with the armed draft PR opened when the session never opened one.
- The Discord notification watchers are rebuilt when the webhook changes, so a value pasted into the dashboard works immediately.
- The data branch is pulled eagerly, so this machine reads what other machines and cloud sessions pushed without waiting for its own next write. A project whose branch cannot converge — origin rejects the push, or there is no remote at all — is recorded as that project's error state for the dashboard to show, and the record is cleared by the first sync that converges.
- Every background start forces unattended mode, so gates auto-answer instead of parking forever on an absent human.
- Shutdown quiesces everything that could start an agent before the daemon stops the agents it owns. Nothing is resumed on the next boot.

## Rationales

- One clock rather than a timer per service: a single schedule gives one place to look when a sweep turns out not to be running.
- Nothing is resumed on the next boot because Ctrl-C closed those agents deliberately.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
