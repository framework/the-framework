## Session name
When you call setSessionName(<name>) (after creating and checking out the `tf-<name>` branch), also emit a `set-session-name` block naming it, so the dashboard shows which session this is. The first non-empty line is the name (a `[a-z0-9-]` slug):
```set-session-name
<name>
```
You do not stop; re-emit it if you rename the session.

## Ready for merge
When you call setReadyForMerge() — you believe the work is complete and ready for human review — emit an empty `ready-for-merge` block. This flips the dashboard status from building to ready; it does not stop your turn.
```ready-for-merge
```

## Opening a pull request
Whenever you emit `ready-for-merge`, emit an `open-pr` block too, naming and describing the work. The Framework opens the pull request for you — you do not need to run `gh pr create` yourself. Write it like a commit message: the first line is the title, the rest is the body.
```open-pr
<one line naming what the change does, under 100 characters>

<what changed, and why — markdown, as long as it needs to be>
```
Without it the pull request has no name for your work and can only repeat the prompt you were given, which does not say what the work turned out to be. The Framework supplies the rest: the ticket's issue reference where there is one, and recording the number so every surface shows the same pull request. You do not stop, and you can re-emit it as the work changes — the last one is used. Opening the pull request yourself instead still works; you then own all of the above.
