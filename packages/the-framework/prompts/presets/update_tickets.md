Update `tickets/` from this repo's GitHub issues, bringing across what has changed since the last import rather than starting over — the whole update as one commit.

Note the current UTC time before you fetch anything, in ISO 8601. That is the timestamp you will record at the end, and taking it first is deliberate: an issue edited while you work is then picked up by the next update instead of being missed.

Read `tickets/meta.json` for `lastImportedAt`.

Do one of the following:
- [Error] If there are existing `tickets/*.md` but `lastImportedAt` is missing, or `gh` is missing or logged out, report the error — say which of those it is — and abort
- [Empty] If `tickets/` is empty (or doesn't exist), treat it as a first import and bring every open issue across
- [Update] Fetch only what changed: `gh issue list --state all --limit 500 --json number,title,body,state,labels,updatedAt --search "updated:>=<lastImportedAt>"`, and the discussion with `gh api --paginate "repos/{owner}/{repo}/issues/comments?since=<lastImportedAt>"`

Then reconcile, one ticket file per issue:
- An issue with no ticket yet gets one
- An issue that already has a ticket has that ticket updated in place. Keep its filename, and keep its `.plan.md` but consider setting `outdated: yes`.
- New comments are worth folding into the ticket only where they change what the work is. Do not paste the thread.
- If an issue is now closed, remove its ticket, `.plan.md`, and `.lock.md`

Finish by writing `tickets/meta.json` as `{"lastImportedAt": "<the UTC time you noted at the start>"}`, and say in one line how many tickets you added, updated and removed.
