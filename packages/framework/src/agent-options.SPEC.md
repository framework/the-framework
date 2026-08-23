Turns the user's settled preferences into the options an agent starts with, so an agent started by Auto PM behaves exactly like one the user launches from the dashboard.

## Business logic — TL;DR

- **One mapping for every launcher** - the dashboard and the daemon derive an agent's options from the same rules, so an unattended agent honours the driver, model, run target and every other setting.
- **A repo's committed config speaks in preferences** - `the-framework.yml` contributes only the settings it actually sets, so an unset key leaves the tier below it untouched.
- **Handoff defaults to opening a PR** - a finished agent left alone pushes its branch and opens a PR; the handoff levels form one ladder, not independent switches.
- **Settled answers are stated explicitly** - the settings a repo's config could also set are always sent, including when they are off, so the repo file cannot turn back on what the launcher just showed as off.
- **Defaults and inapplicable settings are left unsaid** - anything already assumed — the Claude Code driver, the `local` run target, no model override — is omitted, and the browser preview is sent only for Claude Code, which is the only driver that can use it.

## Business logic

### One mapping for every launcher

#### User story

The user configures a project once — driver, model, run target, browser preview, quality pass, handoff. Whether they then click Start in the dashboard or leave Auto PM to work the agent queue overnight, the agent must run with those same settings.

#### Business logic

The user's preferences are mapped into an agent's starting options by one shared rule set that every launcher uses. The mapping receives the already-merged preferences — deciding whether the global or the per-project setting wins happens before this — and turns that one settled answer into the agent's options.

#### Rationale

This mapping used to live in the dashboard, which was fine while the browser was the only thing starting agents. Auto PM starts them too and passed nothing at all, so an unattended agent ignored the driver, the model and every other per-project setting that an agent started from the dashboard would have honoured.

### A repo's committed config speaks in preferences

#### User story

A project commits `the-framework.yml` so that everyone working the repo gets the same defaults, and expects settings the file does not mention to keep coming from their own preferences.

#### Business logic

The repo's committed config is read as the preferences it speaks for: whether the agent is transparent, whether it is vanilla, and how far a finished agent publishes itself. Only the settings the file actually sets are contributed, so an unset setting leaves the tier below it alone. The preset and event settings in the file have no preference counterpart — there is no preset picker — and stay on the raw config for display only.

#### Rationale

Handoff belongs in the committed file because whether an agent publishes itself is a fact about the repo. It is also where pushing without opening a PR stays reachable, now that the dashboard launcher offers a single Open PR row.

### Handoff defaults to opening a PR

#### User story

A user starts an agent without touching any publishing setting and finds a pushed branch with a PR waiting for them.

#### Business logic

When no handoff level is set, a finished agent pushes its branch and opens a PR. The handoff levels are one ladder whose rungs are nested — local, then push, then PR, then merge — rather than three independent switches.

#### Rationale

As a ladder, "open a PR without pushing" is not representable at all, instead of being a combination that has to be repaired by silently turning the push back on. That silent repair is what once made a launcher offering "publish nothing" unable to actually deliver it — `gh` will not open a PR for a branch the remote has never seen.

### Settled answers are stated explicitly

#### User story

The user switches vanilla off in the dashboard for a project whose committed `the-framework.yml` turns it on, and the agent must start with vanilla off.

#### Business logic

Vanilla, transparent and the handoff level are always stated on the agent's options, including when they are off or at the default. The launcher has already resolved every layer it can see, so the agent states the settled answer and the CLI takes it as the nearest layer. Saying nothing would let the repo's committed file turn back on what the launcher just showed as off, or publish further than the launcher just showed.

### Defaults and inapplicable settings are left unsaid

#### User story

A user who changes nothing gets an agent identical to the one they would have got before these settings existed.

#### Business logic

Settings that merely repeat what is already assumed are omitted: the Claude Code driver, the `local` run target, an empty model, an empty extra context. The browser preview is passed only when the driver is Claude Code — no other driver takes MCP servers, so sending it would only earn a "no effect" notice from the CLI, which matches the dashboard disabling that box for other drivers. The quality pass before an agent becomes mergeable is sent only when it is on.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
