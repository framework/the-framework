Priority: 2
GitHub: [#1547](https://github.com/gemstack-land/the-framework/issues/1547)

# Cloud hand-off leaves scratch refs on origin — sweep them

## TLDR

Since #1544, every "Run on: Claude web" run leaves two dead refs on origin once provisioning settles: the slash-free `cloud-*` ref the driver pushes pre-hand-off (anthropics/claude-code#87235 workaround) and the run branch (`the-framework/agent-…`). The session works on its own `claude/*` branch and opens its PR from there, so nothing consumes these afterward — one pair per web run, accumulating forever. Sweep options: (1) driver deletes the ref once session creation settles — but there's a provisioning race (only "session created" is signaled, not "clone finished"; deleting too early strands the session, needing `claude --teleport` recovery); (2) daemon sweep deleting `cloud-*` refs and ended-run branches with no open PR older than a safe age (~a day). Option 2 is safer given the race.

## Why it matters

The refs are tiny and this is low priority, but the list grows with every web run. First live run's leftovers: `cloud-1-3955352b` + `the-framework/agent-2026-08-17T10-52-38-535Z`, both at commit 5ef9f285 (from #1546, session_01VTAkK8iU4FhDr5EkQPbTV3).

## Source

Imported from GitHub issue [gemstack-land/the-framework#1547](https://github.com/gemstack-land/the-framework/issues/1547), created 2026-08-17, no labels, 0 comments.
