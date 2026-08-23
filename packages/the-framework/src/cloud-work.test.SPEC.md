What the tests cover for adoption — matching a cloud session's own `claude/*` branch back to the `web`-target agent that handed the task off, and recording that branch and its pull request onto the agent's archive.

**Matching by ancestry.** The one remote head that descends from the agent's hand-off anchor is adopted as its branch. A head forked before the anchor is ruled out. Zero matches adopt nothing — that is the normal state of an agent still waiting — and two matching heads also adopt nothing, because ancestry alone cannot arbitrate between them. Real git is exercised too: the pass fetches heads the local checkout has never seen, writes them as remote-tracking refs so a later garbage collection cannot discard them, and picks out only the descendant of the anchor.

**What gets recorded and what gets opened.** When the cloud session already opened its own pull request, that pull request is recorded and no second one is opened. When the agent is armed for a pull request the session never opened, a draft is opened on the matched branch and recorded. An agent armed only as far as push has its branch recorded and nothing opened. A matched head that is nothing more than the anchor itself gets no pull request, because the session pushed no work beyond the hand-off. An agent whose branch was already adopted but which is still owed its armed pull request keeps being asked about, without re-recording the branch.

**Which agents the pass considers.** It skips agents that did not run on the `web` target, agents still running, agents with no hand-off anchor recorded, agents already fully adopted, and agents older than the adoption window. With nothing waiting it does not even fetch. The window is applied when the archive is read rather than after every record has been parsed, so a long history costs no extra reads.

**Failures never guess.** An unreachable or missing remote adopts nothing and never throws. A pull-request listing that fails records the branch — a fact regardless — but opens nothing and reports the failure, so "the session opened none" and "this pass could not tell" are never confused; otherwise a transient outage opened a second draft on a branch that already had one. An agent whose record names a branch that is neither the one it was born on nor the matched head is left alone entirely.

**The recurring pass.** Overlapping ticks join the pass already running rather than starting a second, adoptions and failures are both reported out loud, and a stopped pass runs nothing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
