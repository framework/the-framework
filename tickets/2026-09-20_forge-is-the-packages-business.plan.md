Effort: 5
Uncertainty: 4

# [Plan] Working with no forge, and with GitLab, Bitbucket or a custom one: the forge is the packages' business

How the framework's last `gh` calls become one more thing the branches package answers, so that "no forge" is an answer the framework can hear and another forge is a swap inside one package.

## TLDR

Three steps, three pull requests.

1. The branches contract gains two commands, `requests` and `forge`. The branches package answers them with the `gh` it already runs. The framework's six forge files-worth of `gh` move onto them, and `dashboard/gh.ts` and `dashboard/github.ts` are deleted. On GitHub nothing changes.
2. "This project has no forge" becomes an answer. `forge` prints none, and the surfaces that assumed a pull request stop assuming one: no pull-request rows on the Human Queue, "Push" as a finished run's last step, `publish` answering a push with no request, and — the one real addition — landing a branch without a request.
3. Inside the branches package, the `gh` calls go behind one forge adapter picked from the origin's host or the project's say. GitLab and Bitbucket adapters are then a ticket each, and a custom forge is a project's own package answering the same contract.

The ticket's decision — one adapter inside one package, or a package per forge — comes out **one adapter inside one package**, for the reason below.

## What is there today

The framework's whole forge surface, and nothing else in it mentions GitHub:

- `packages/framework/src/dashboard/gh.ts` — the `gh` runner (`readGh`, 8s), `ghPrView`/`cachedPrView`, `ghPrsForBranch`/`ghPrsForBranchOrThrow`/`cachedPrsForBranch`, `ghPrList`, `pickAgentPr`, the `LinkedPr` and `OpenPr` shapes, the cache keys and their `forgetPr`/`forgetBranchPrs`.
- Its five callers: `dashboard/interventions.ts:95` (the Human Queue's open requests), `dashboard/agent-handoff.ts:119,189,257` (a run's request, and forgetting it after an action), `dashboard/git-status.ts:61-67` (the project bar's request), `cloud-work.ts:157` (cloud-run adoption, whose listing must throw), `cloud-scratch-refs.ts:230` (the scratch-ref sweep).
- `packages/framework/src/dashboard/github.ts` — `githubUrlFromRemote`/`githubUrlFor`, read by `dashboard-rpc/reads.ts:353` as `onGithubUrl` for the project panel's "Open on GitHub".
- The branches package's own `gh`: `skill-branches/src/publish.ts:31` (`nodeGhRunner`), `pr create` (`:142`), `pr view`/`pr ready` (`:184,192`), the held-merge body edits (`:203,242`), `pr merge --squash [--auto]` (`:256,262`), `pr list --head` (`:279`), and `merge-watch.ts:58,106` (`pr view --json statusCheckRollup`, `pr merge`).
- The scheduler's own: `agent-scheduler/src/pr.ts` (`prOfBranch`, its own `nodeGhRunner`), called at `run.ts:399`; and `scheduler.ts:83-87`, which warns on every run when `gh` is missing or unauthed.

The contract to extend is `packages/framework/src/store/branches.ts` (`list`, `show`, `publish`, `merge`, `remove`), declared by `skill-branches/package.json:26` as `"framework": { "branches": "branches" }` and found by `project-widgets.ts:145`.

## Problems

- **One capability or two** (uncertainty 5). The forge reads could be a second provided kind (`"requests"`) or more commands on the existing `branches` kind. Genuinely open: a second kind is what would let a git-only branches package sit beside a separate forge package.
- **Where the request reads are cached** (uncertainty 3). The branches source caches `list`/`show` for 5s (`branches.ts` `CACHE_MS`); the `gh` reads use a different cache (`dashboard/cache.ts`) whose `pending` flag the panels read to tell "not known yet" from "no request". Two caches, one new read.
- **What `publish` answers with no forge** (uncertainty 4). `PublishOutcome` is a request or an error, and `branches.ts` turns a missing `pr` into the error "opened no pull request". A push that was all there was to do is neither.
- **Whether landing without a forge exists at all, and how** (uncertainty 6). `merge` is addressed by request number. Without a forge there is no number, and a project with no forge has no way to land from the dashboard.
- **How the forge is picked, and what a forge on an unknown host is** (uncertainty 5). Host-matching makes a GitHub Enterprise project read as "no forge", silently.
- **The state strings** (uncertainty 2). Five places compare `gh`'s uppercase `OPEN`/`MERGED`/`CLOSED`. Another forge spells them otherwise.

## Solutions

### One capability or two

**Recommended: more commands on the `branches` kind.** `publish` and `merge` — the two writes that need a forge — are already there, so a second kind would put "open a request" and "read the requests" in different packages, and nothing would stop a project declaring a mismatched pair: a branches package opening GitHub requests beside a requests package reading GitLab's. One kind cannot be mismatched, and `readProvidedCommand` takes the *first* declaring dependency, so a second kind is also a second silent-precedence rule.

Rejected: a `"requests"` kind. It buys the git-only-branches-plus-forge-package combination, which nothing asks for today, at the cost of a pairing the framework cannot check.

The two commands added to the contract:

```
<command> requests [--branch <b>] [--state open|all] [--limit <n>]
                                 the project's requests, or one branch's, newest first, as an array
                                 of Request; exits 1 when the forge could not be asked
<command> forge                  what this project's forge is: {"forge":"github","url":"https://…"},
                                 or {"forge":null} when it has none. A local read, no network.
```

`Request`, owned by `store/branches.ts` beside `Checkout` and `BranchState`, is today's `LinkedPr` and `OpenPr` merged and normalised:

```
{ number, url, state: 'open'|'merged'|'closed', title, branch, draft, createdAt?, headSha? }
```

`headSha` is `headRefOid` renamed; `branch` is `headRefName`. The provider normalises the state, so the forge's own spelling never reaches the framework. Nothing is backwards compatible here and nothing needs to be: the project has no external users.

`pickAgentPr` stays in the framework — it is a judgment about which request belongs to a run, not a fact about a forge.

### Where the request reads are cached

Keep `dashboard/cache.ts` around the provider call, not the branches source's 5s map. The request read is the only one that costs the network (~600ms against ~10ms for the git reads), the panels depend on its `pending`, and `forgetPr`/`forgetBranchPrs` must keep invalidating it after an action. So: a new `store/requests.ts` calling `runPackageCommand` through the branches command, wrapped in `cachedRead` with today's keys; `branches.ts`'s own cache and its `drop()` stay untouched.

The two failure policies survive the move for free. `runPackageCommand` answers `{ ok: false, error }`, so `store/requests.ts` exposes both a forgiving read (resolves `[]`, for the sweep and the panels) and a throwing one (for `interventions.ts` and `cloud-work.ts`, where "could not look" must not read as "none" — #1623, #1601). That is strictly better than today's `ghJson`, which swallows.

### What `publish` answers with no forge

`PublishOutcome` gains a third form:

```
{ ok: true; pushed: true }            pushed; this project has no forge, so there is no request
{ ok: true; pr: …; existing: … }      unchanged
{ ok: false; error: … }               unchanged
```

`branches.ts`'s "opened no pull request" error then applies only where a forge was expected. `openAgentPullRequest` (`agent-handoff.ts:299`) returns the pushed form up to `sendOpenPullRequest`, and `AgentHandoff.tsx:118` labels its button from the project's `forge`: "Open PR" with one, "Push" without — beside the "No remote to push to." reason it already has at `:106`, which is a different fact and stays.

### Landing without a forge

**Recommended: include it, as `merge --branch <b>`.** Without it a no-forge project can start runs and push them and then must leave the dashboard to land anything, which makes the case half-supported. `MergeOutcome` gains `'landed'`.

The package's implementation needs no checkout and no merge commit: fetch, confirm the branch's tip has the base as an ancestor, and `git push origin <sha>:<base>`. A branch behind its base is refused with "rebase it first" rather than merged — a merge the framework performs unattended on someone's default branch is not a thing to do quietly.

Shortcut, if this is wanted smaller: leave `merge` number-only and let a no-forge project land by hand. The rest of the plan does not depend on it.

### How the forge is picked

One adapter inside `skill-branches` (`src/forge/`), an interface of what the request half needs — `create`, `view`, `list`, `ready`, `editBody`, `merge`, `checks`, `home` — with `github.ts` as the first implementation, wrapping exactly today's `gh` calls.

Picked by, in order: the project's own say, then the origin's host, then none. The project's say is what stops a GitHub Enterprise or self-hosted GitLab host reading as "no forge": `"framework": { "forge": "github" }` in the project's package.json, read the same way the provider is. Without a remote at all, the answer is none regardless.

Rejected: a package per forge. The git half — checkouts, worktrees, push, reclaim, the branch-name rules, the merge hold — is identical across forges and is most of the package; per-forge packages would fork all of it to vary `pr create`. And since `readProvidedCommand` takes the first declaring dependency, two installed forge packages would resolve by package.json order, silently.

A custom forge stays a project's own package declaring `"branches"`, answering the same command lines. That is the module model as built, and it needs no new mechanism.

### The state strings

Normalise in the provider (`'open' | 'merged' | 'closed'`) and update the five comparisons: `pickAgentPr` (`gh.ts:181`), `mergeAgentPr`'s `pr.state !== 'OPEN'` and its message (`agent-handoff.ts:181`), `movedPastPr`, `resolveAgentPr`'s synthesised `'UNKNOWN'`, and the scratch sweep's `open-pr` reason. A missed one compares against a string that can no longer occur and silently reads as "not open" — worth a test per site rather than a careful read.

## Considerations

- **The reads are branch-addressed, from the project root.** Today's callers pass a `cwd` that may be a run's worktree; a provided command runs in the project root (`runPackageCommand`). Same trap `show` already has, and the same fix: pass the project root and name the branch. `cloud-scratch-refs.ts` passes a ref name as a branch, which the provider must be allowed to answer nothing for.
- **No forge must not read as "could not look".** `buildInterventions` marks a project read whole only when every source answered (#1623). A project with no forge contributes no request rows *and is still whole* — otherwise the notification watcher keeps no baseline for it and announces its backlog the first time it does get a forge.
- **The scheduler's `gh` goes the same way.** It already imports `@gemstack/skill-branches` directly (`run.ts:6`), so `pr.ts` becomes a call to the package's requests read and the file's own `nodeGhRunner` goes. `readyToRun` (`scheduler.ts:83-87`) must stop warning "`gh` not found" on a project that has no forge: the readiness question becomes the forge's, asked of the package, and a no-forge project answers that there is nothing to install.
- **The merge hold is forge-shaped.** `merge-hold.ts` writes its note into the request's body and `publish.ts:203,242` edits it there. With no forge there is no body to hold the note; the hold has to be recorded on the checkout alone, which it already half is (`heldMergeRecorded`).
- **The merge watcher needs the forge's checks.** `merge-watch.ts:58` reads `statusCheckRollup`. Behind the adapter this is "the request's checks, as pending / passing / failing" — the rollup's shape is GitHub's, and mapping it is the adapter's job, not the watcher's.
- **`update-tickets` and the issue import stay GitHub's,** as the ticket says, along with the tickets' `GitHub:` line and the `Closes #<n>` convention. Another forge brings its own import. Out of scope here.
- **Cloud-run adoption** (`cloud-work.ts`) is about runs that pushed a branch to the remote; with no forge its armed-draft step has nothing to open and should record the branch and stop, which is already what it does for a run not armed for a request.
- **Every touched file has a `LOGIC.md`** — read the `logic-driven-development` skill before editing them, and the `branches.ts` contract comment is itself the specification of the command lines, so it is the first thing that changes.
- **`FEATURES-SPEC.md`** is required by `AGENTS.md` for a user-facing feature, and does not exist on `main` today. "Works with a project that has no forge" and "works with another forge" belong in it; whoever implements step 2 either starts the file or the rule is stale and should be raised.

## Implementation

### PR 1 — the framework loses `gh`

No behaviour change on a GitHub project; it should be provable by the existing tests.

1. `store/branches.ts`: add `Request`, `requests(...)` and `forge()` to `BranchesSource`, and the two command lines to the contract comment, with their parsers beside `parseCheckouts`/`parseBranchStates`.
2. `skill-branches`: implement `requests` and `forge` in `cli.ts` over the `gh` calls `publish.ts:279` already makes, plus a `pr list --state open` for the project-wide form and the remote-URL derivation moved from the framework's `github.ts`.
3. `store/requests.ts`: the cached reads (forgiving and throwing), the cache keys and `forgetPr`/`forgetBranchPrs`, `pickAgentPr` moved across.
4. Move the five callers and `onGithubUrl` (which becomes `onForgeUrl`, sourced from `forge`), then delete `dashboard/gh.ts`, `dashboard/github.ts` and their tests, and the re-exports at `dashboard/index.ts:20` and `dashboard-rpc/index.ts:5`.
5. `store/test-branches.ts` gains `requests`/`forge`; the callers' tests keep their injected seams and change type only.

### PR 2 — no forge, first-class

1. `forge` answers `{"forge":null}` with no remote or no adapter; the framework carries it into the handoff read and the project summary.
2. `PublishOutcome`'s pushed form, through `openAgentPullRequest` and `sendOpenPullRequest` to `AgentHandoff.tsx`'s button label.
3. `buildInterventions` skips the requests read and still counts the project whole.
4. `readyToRun`'s `gh` warning becomes the forge's readiness.
5. `merge --branch` and `MergeOutcome`'s `'landed'`, if taken.
6. An end-to-end test on a bare repo with no remote: start a run, commit, push refused for want of a remote; and with a remote but no forge: publish pushes, the handoff says pushed, the Human Queue stays empty and whole.

### PR 3 — the adapter

1. `skill-branches/src/forge/index.ts` (the interface and the pick) and `forge/github.ts` (every `gh` call from `publish.ts`, `merge-watch.ts` and `merge-hold.ts`, unchanged in behaviour).
2. The project's `"framework": { "forge": … }` say, and its precedence over the host.
3. GitLab and Bitbucket adapters: a ticket each, written against the interface this PR fixes. Not here.
