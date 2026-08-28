What the tests cover: where an agent the daemon starts is allowed to land, and what happens when its process never gets going.

Shutdown: a start arriving after the daemon has begun stopping its agents is refused rather than spawned into the gap, and nothing is spawned at all. A start already in flight when the shutdown lands is refused too, and takes back everything it had allocated — the fresh worktree, its agent branch, and the written-out task description.

The checkout an agent gets: a git project whose worktree could not be created fails the start rather than falling back to the user's own checkout, and no agent is spawned; a project that is not a git repository still falls back to the main checkout, is started without an agent id to signal it, and the reason is logged in words that distinguish "not a repository" from "git failed". A worktree creation killed for taking too long has its half-written directory removed, while any other git rejection leaves the path alone.

An agent whose process dies at boot without ever reporting itself: the start still succeeds, and the daemon then records the agent as failed under the agent id its worktree is named with, dated by that id rather than by when the daemon noticed, carrying the prompt so the row is identifiable — so the agent's page stops waiting for a session that will never start. The cause is visible: the process's error output is kept in full and its tail appears in the agent's event log alongside how the process ended. The checkout is retained for inspection. An agent that did report its own ending is left untouched — its status is not rewritten and no failure line is invented. An agent whose checkout is gone gets no record written at all, and no directory is created where the checkout used to be. A task description a process died without reading is removed from disk.

Retrying a transient death: only transport failures count — a connection closed mid-response, a reset connection, an overloaded API — while a boot death or a genuine work failure does not. Only the last ending in an agent's event log counts, and only a failed one, so a continued agent whose latest leg succeeded is not treated as failed and a malformed line does not hide the ending around it. An agent that dies to a transport failure is continued in its own retained checkout rather than restarted as a new agent, at most twice, after which its failure stands; an agent that fails on its own terms is never continued.

Refusing a start the driver cannot serve: a start on a logged-out driver is refused with a reason that names the fix, and spends no worktree, no agent branch and no process. An agent targeting a GitHub Actions runner is not gated on the local driver at all. A passing check is reused across a burst of starts, while a failing one is re-checked on every start so that logging in is picked up by the very next start.

Held slots: a live agent's slot names the agent and its process id, and stopping the agents reports the same name and clears the slot.

The agent's environment: the spawned process's PATH starts with the `skill-branches` package's executable directory and continues with the daemon's own, and the `branches` command found through it lists the very checkout the daemon allocated.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
