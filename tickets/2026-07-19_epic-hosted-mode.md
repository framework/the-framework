priority: low
topics: [the-framework]

# Epic: Hosted mode. Run the agent on a server instead of the laptop / local machine

## TLDR

Two phases. **Phase 1 (small)**: connect the client to your own remote daemon — bind non-loopback, add a shared token, connection profiles (Local / My VPS); removes the laptop CPU ceiling and the lid-must-stay-open problem; the desktop app (#411) becomes this phase's thin client. **Phase 2 (big)**: one server per org — GitHub App login for identity/tenancy/repo access, projects become server-cloned repos (SQLite for users/org/tokens/project list only; `.the-framework/` stays the source of truth), per-run worktree+sandbox isolation, per-user auth on writes. The phase-2 blocker is *whose subscription*: (a) per-user `claude setup-token` server-side (default), (b) org API key (pay-per-token, option), (c) CC-web offload (later, fire-and-forget only).

## Why it matters

**Security non-negotiable, relevant the moment phase 1 starts:** the daemon has no auth at all today — its only protection is the loopback bind; an exposed daemon that spawns processes is remote code execution for whoever finds the port. The shared token must ship in the same change as the non-loopback bind. Strategically, phase 2 is the first thing the "no database, no real server" stance (#605/#313) cannot express — a decision to make deliberately rather than drift into.

## Source

Imported from GitHub issue [gemstack-land/the-framework#806](https://github.com/gemstack-land/the-framework/issues/806), created 2026-07-19, labels: `priority: low`, `the-framework ♻️`.

### Original description

# Epic: Hosted mode. Run the agent on a server instead of the local machine

> Direction question, not scheduled work. Splits into a small phase 1 and a much bigger phase 2. I mainly want a yes/no on phase 1, and on which credential model phase 2 would use.

## The pain

Install on your machine, run node, add a project by local path. Fine for one dev, but concurrency is capped by the laptop's CPU and the laptop has to stay awake for the whole run.

## Phase 1: connect to your own server (small)

The daemon is already the thing that spawns the agent CLI. Point the client at a remote daemon and runs execute there. The run path itself does not change.

- The dashboard is already client/server (Vike SPA over Telefunc), and `startDashboard` already takes a `host`. It just defaults to `127.0.0.1` and the daemon never overrides it.
- So this is: bind non-loopback, add a shared token, and let the client hold connection profiles (Local / My VPS).
- **This is where #411 fits.** A desktop app is the *client*, and the server becomes swappable. Keep it thin (a window plus connection profiles) so the SPA stays same-origin with its daemon. Bundling the SPA and pointing RPC at an arbitrary origin would drag in CORS and more auth for no gain.
- Credentials are a non-problem here: one user per server means you run `claude` once on your own box, exactly like your laptop today. No stored tokens.
- No accounts, no database, no tenancy, so it does not collide with #605 / #313.

**Non-negotiable:** the daemon has no auth at all today (no token, session, cookie or origin check anywhere). Its security is entirely "it is bound to loopback". An exposed daemon that spawns processes is remote code execution for anyone who finds the port. A shared token is the minimum, and it ships in the same change as the non-loopback bind, not after.

Phase 1 alone removes the CPU ceiling and the lid problem, which is the pain we actually started from.

## Phase 2: one server per org (big)

Many users on one server. Sign in with GitHub and that is the whole setup: repos are there, runs execute on the server, PRs come back to GitHub.

What phase 1 does not give us:

1. **Identity.** GitHub login as a **GitHub App**, which yields the user, the org (our tenancy boundary), repo access, and a token to clone and open PRs. Today all git and PR work rides on the machine's ambient `git` and `gh`.
2. **Projects stop being local paths.** `$HOME/.the-framework.json` is one user on one machine pointing at existing checkouts. Hosted, a project is a repo the server clones. `.the-framework/` stays the source of truth, so git-as-data survives. The server needs only users, org, tokens, project list, run index. SQLite is enough.
3. **Isolation.** A run is `spawn(detached)` inheriting the machine's `~/.claude`. With N users on one box, each run needs its own worktree and sandbox, plus per-user quota.
4. **Per-user auth on every write.** A read-only relay is fine unauthenticated. A multi-user daemon is not.

### The phase 2 blocker: whose subscription

BYOS (#495) works because the CLI runs under your own local login. Fine with one user per server. With many users there is no single login.

- **(a) Per-user token server-side.** User pastes a `claude setup-token` once, we run their agent on their subscription. Keeps BYOS economics. Cost: we hold user credentials.
- **(b) Org API key.** Simplest to run, but pay-per-token, which throws away the reason BYOS exists.
- **(c) Claude Code on the web** (#610). Zero CPU for us too, but the fire API gives no stream and no read-back, so live logs, turn gates and the whole AWAIT layer stop working. A fire-and-forget run mode, not the architecture.

I would do **(a)** by default, **(b)** as an org option, **(c)** later as a per-run offload.

## Related

- **#411** (desktop app) is phase 1's client, not a competing direction.
- **#605** is the right home for the runtime half. It commits to *"no database and no real server are needed"*, and **#313** says the same (`.the-framework/` is the database). Phase 1 respects that. Phase 2 is the first thing that stance cannot express, so it is a decision to make rather than drift into.
- **#607** assumes members and scopes but files no auth mechanism. Phase 2 supplies it. **#606** assumes a user system too.
- **#454** (source of truth) should not be answered separately from phase 2.
- Nothing is filed today for accounts, GitHub login, deployment, authz, tenant isolation, per-user credentials, or billing.

## Ask

1. Build **phase 1**? It is small and standalone.
2. Is **phase 2** the shape of the product (hosted per org, local install as the OSS/dev mode), or is local-first the product and hosted a later paid tier?
3. If phase 2: which credential model, (a), (b) or (c)?
