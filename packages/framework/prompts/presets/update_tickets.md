Use the `tickets` skill. Update the tickets from this repo's GitHub issues, bringing across what has changed since the last import rather than starting over.

Note the current UTC time before you fetch anything, in ISO 8601. That is the timestamp you will record at the end, and taking it first is deliberate: an issue edited while you work is then picked up by the next update instead of being missed.

Read `lastImportedAt` off `tickets/meta.json` (`git show origin/tickets:tickets/meta.json` after `git fetch origin tickets`; `tickets list` says whether there are tickets).

Do one of the following:
- [Error] If there are existing tickets but `lastImportedAt` is missing, or `gh` is missing or logged out, report the error — say which of those it is — and abort
- [Empty] If there are no tickets, treat it as a first import and bring every open issue across
- [Update] Fetch only what changed: `gh issue list --state all --limit 500 --json number,title,body,state,labels,updatedAt --search "updated:>=<lastImportedAt>"`, and the discussion with `gh api --paginate "repos/{owner}/{repo}/issues/comments?since=<lastImportedAt>"`

Then reconcile, one ticket file per issue, each written with `tickets put <file>`:
- An issue with no ticket yet gets one
- An issue that already has a ticket has that ticket updated in place. Keep its filename, and keep its `.plan.md` but consider setting `outdated: yes`.
- New comments are worth folding into the ticket only where they change what the work is. Do not paste the thread.
- If an issue is now closed, `tickets close <file>` removes its ticket with its `.plan.md` and `.lock.md`

Finish with `tickets put meta.json` writing `{"lastImportedAt": "<the UTC time you noted at the start>"}`, and say in one line how many tickets you added, updated and removed.
