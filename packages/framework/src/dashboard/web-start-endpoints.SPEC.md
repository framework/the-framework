The run-facing side of the Claude web bridge's session start-queue: how a web run asks its daemon for a cloud session created by the browser extension, and learns what it became.

## User story

A `web`-target agent is a process the daemon spawned, not a part of the daemon, so it cannot reach the daemon's queue directly. It reaches these routes at the address the daemon put in its environment when it spawned it, presenting the daemon token it reads from the registry — and gets an answer it can act on at once: queued, or nobody here to create it.

## Business logic — TL;DR

- **The run presents the daemon token** - the same secret the extension holds; a missing or wrong token is refused before anything is read.
- **No extension around means no waiting** - when nothing has spoken to the bridge recently, the request is refused on the spot with that reason, so the run stops naming it instead of timing out.
- **A request is validated as the queue validates it** - repository, branch and prompt must be strings, and the queue's own rules decide the rest.
- **The run polls the request by its id** - and reads queued, claimed, created with the session and its URL, or failed with the extension's note.
- **Off with the bridge** - when the browser bridge is off, these routes do not exist either.

## Business logic

### Asking for a session

#### User story

See `## User story`.

#### Business logic

A run posts the repository, the branch and the prompt. With the bridge off the route is not found; without the daemon token it is refused; when no extension has been let through the bridge within the presence window it is refused as a conflict naming that reason; a malformed request is refused with the queue's reason. Otherwise the request is queued and the run is handed its id.

#### Rationale

Refusing at once when no extension is around is what lets the run tell the user what is missing in one round trip, rather than after a two-minute wait.

### Following the request

#### User story

The run has nothing to do but wait for the session; it must know the moment the session exists, and must fail with a reason when the extension gave up.

#### Business logic

A run reads its request by id and gets its state, plus the session id and URL once created, or the extension's note once failed. An unknown id, or one that does not look like an id at all, is not found.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
