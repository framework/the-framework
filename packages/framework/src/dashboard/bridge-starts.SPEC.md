The session start-queue of the Claude web bridge: the cloud sessions a web run wants created by the browser extension, waiting for the extension to claim them and report the session each became.

## User story

A `web`-target agent hands its task to a cloud session on claude.ai. A session created through claude.ai's own repository picker is bound to that repository, so it can push its work and open a pull request. So the run asks the daemon for an extension-created session, the extension in the user's own browser creates it, and the run learns where its work went.

## Business logic — TL;DR

- **A request names the repository, the branch and the prompt** - the repository as `owner/name` the way the picker lists it, the branch the run pushed its starting point to, and the whole hand-off prompt; a malformed repository or branch, an empty prompt, or an absurdly long one is refused.
- **A request names the model when the run has one** - the model the run was started with, for the extension to pick on claude.ai; a blank model counts as none, an absurdly long one is refused.
- **A request is claimed in the same step that serves it** - two polling tabs must never be handed the same request, because a duplicate is a second cloud session on the user's account.
- **A claim nobody reports on expires** - after ninety seconds the request is offered again, so a browser that quit mid-creation retries instead of stranding the run.
- **Success without a session is a failure** - a run pointing nowhere is not a usable outcome.
- **A report on a request nobody holds is ignored** - a tab that died after its claim expired cannot overwrite the retry that replaced it.
- **Nothing survives a daemon restart** - the queue is held in memory; the run's own timeout is the backstop.

## Business logic

### The request

#### User story

See `## User story`.

#### Business logic

A request carries three things: the repository as `owner/name`, the branch, and the prompt — and, when the run was started with one, the model, kept trimmed: a blank model is as good as none, and one over a hundred characters is refused. The repository must be exactly two path segments of ordinary characters, neither of which is only dots; the branch must be a plausible git branch name; the prompt must be non-empty and under the cap. The cap is generous, because the hand-off prompt carries the whole framing The Framework injects — the system prompt, the file formats, the protocols — and not only the user's task. A queued request is stamped with when it was queued and starts as queued.

### Claiming and reporting

#### User story

The extension's background half polls the daemon; there may be more than one browser, and a browser may quit half-way through creating a session.

#### Business logic

Claiming hands out the oldest request that nobody holds and marks it claimed in that same step. A claimed request whose claim is older than ninety seconds counts as unheld and is handed out again. The extension's report on a claimed request settles it: created, with the session's id and the session URL derived from it, or failed, with the extension's note of what it could not find. A report of success that names no session is recorded as a failure. A report on a request that is not currently claimed is ignored.

#### Rationale

The whole design is about never creating two cloud sessions for one run. Taking the request off the queue as it is served, expiring a silent claim rather than a reported one, and ignoring reports from expired claims are the three halves of that one rule.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
