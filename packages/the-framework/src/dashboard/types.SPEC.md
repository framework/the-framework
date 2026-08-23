The shared vocabulary the dashboard's launch and its results speak: what a Start can ask for, what a Start, an add-project, a preview or a worktree read answers with, and what the launcher must know before it lets the user press Start.

## Business logic — TL;DR

- **What a Start can ask for** - the options the user sets in the launcher and the daemon sets for the work it starts on its own; anything left unset means off, except where a setting explicitly defers to the repo's own committed config.
- **Three kinds of Start** - a normal framework task, a verbatim prompt, and the research preset rendered around what the user asked about.
- **A Start answers with the agent's identity** - so the dashboard can select the agent it just started rather than guessing which of several running agents is the new one.
- **A refusal says whether it was busy** - a Start can be refused because something is already running, which reads differently from any other failure.
- **The launcher is told only what is wrong** - the driver-readiness answer carries blocking problems and non-blocking warnings, each already phrased for a human and each naming its own fix.
- **Never disclose the filesystem where adding projects is not offered** - the onboarding suggestion of "use this directory as your first project" is withheld entirely on a host that cannot add projects.
- **Where an agent is working** - a worktree read says which checkout the agent has, whether it is the agent's own or a fallback to the project's checkout, whether it has uncommitted changes, its branch, its size, and its PR — distinguishing "no PR" from "the PR lookup has not finished yet".

## Business logic

### What a Start can ask for

#### User story

Before launching, the user sets how this particular task should run: which coding agent and model, where it executes, how far it publishes itself when it finishes, whether the agent gets a real browser, whether The Framework's own prompt applies at all.

#### Business logic

A Start carries the options set alongside it, and they ride with the agent it spawns. An option left unset means off — today's behavior — except where the option's own rule says otherwise. In particular:

- **Prompt scope** — vanilla drops The Framework's built-in system prompt while keeping the controls the dashboard drives the agent with; transparent goes further and runs the wrapped coding agent fully raw, with no framework prompt, no gates, no dashboard, and no backlog loop.
- **Where and by whom** — the driver (Claude Code by default), the model (the driver's own default when unset), and the run target: this device by default, or a GitHub Actions runner, or a Claude Code cloud session.
- **Publishing** — the handoff level this agent reaches when it finishes. Left unset, the repo's committed config decides, and failing that the default `pr` — which is what makes the handoff zero-configuration.
- **Extras** — in-context directories the agent is pointed at, a real browser for the agent, and queuing the quality follow-ups as agent queue entries once the agent signals ready for merge.
- **Continuation** — a Start can resume a finished agent's own conversation with its full prior context, or continue an existing agent rather than starting a new one, so messaging a stopped agent again keeps it as one row in the history instead of spawning an unrelated-looking second one.
- **Ticket linkage** — the ticket this agent implements, set by the daemon when the agent queue entry it drains links back to one, so the Overview can show that ticket as being implemented rather than inferring it from a plan. A separate flag marks an agent that plans its ticket instead of implementing it, so its PR does not claim to close the linked issue — merging a plan would close the issue with the work still undone.
- **Unattended** — nobody is watching: the agent's gates take the recommended option instead of parking for an answer, and the agent stays out of the stay-open chat loop, so it ends at settle and its armed handoff fires. Set for the work the daemon starts on its own and for dashboard surfaces that fire routine or preset work. Stop still works, because stopping aborts the agent rather than answering a gate.
- **Device** — running on a connected device carries that device's address, token and label. This is memory-only, set at submit time from a saved device, never written to the preferences or the registry and never available as a command-line flag, because a device token is a per-browser secret. It is stripped before the task is forwarded, so the device starts an ordinary local agent and never relays onward.

### Three kinds of Start, and what a Start answers

#### User story

The user types a prompt, or picks a preset that prefills the box and possibly edits it, or asks for research on something.

#### Business logic

A build is the normal framework task. A prompt runs the posted text verbatim — what the page sends once a preset has prefilled the box. Research renders the research preset around what was asked about, defaulting to the current PR when nothing was named.

A successful Start reports the identity the daemon allocated for the agent whenever the agent got its own worktree, so the dashboard can select exactly the agent it just started; with several agents running it can no longer find the new one by looking for "the running one", since an earlier agent is still running and the new one has not yet written its status record. A refused Start carries its reason, and separately marks the case where the refusal is because something is already running.

### Guardrails on what is disclosed and what is claimed

#### User story

The onboarding checklist offers "add the directory you are in" as a one-click first project — but a host that does not let anyone add projects must not leak where it is running from.

#### Business logic

The onboarding suggestion names the server's own working directory, and the project it is already registered as when it is one. Both are withheld entirely where adding projects is not wired, so such a host never discloses its filesystem layout.

The launcher's driver-readiness answer reports only what is wrong: blocking problems, each naming its own fix, and non-blocking warnings — chiefly running as the root user, which breaks every agent the same way. Both are already written for a human to read as-is.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
