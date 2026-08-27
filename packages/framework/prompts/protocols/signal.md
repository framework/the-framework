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

## Reporting an error
When you hit something only the user can fix — a missing file you were told to read, a command that will not run, a login you do not have — emit an `error` block saying what is wrong, then carry on or stop as the task requires. The first line is the headline; anything below it is the detail.
```error
<what is wrong, in one line>

<the detail: what you ran, what it said>
```
The Framework marks it in the session log and counts it on the session, so the user sees it without reading the whole log. It does not stop your turn and it does not ask the user anything — use `AWAIT` for a question. Report the same thing once: a re-emitted identical block is ignored.
