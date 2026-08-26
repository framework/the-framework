The registry: the one per-user file holding the list of projects registered with The Framework, the user's preferences, the daemon token, and the user's third-party credentials — written and read by the daemon so the dashboard never has to keep settings in the browser.

## User story

The user installs The Framework into several repos on their machine and wants the dashboard to know about all of them, remember how they like it set up, and keep that across restarts. Moving to a second machine, they expect to set it up again there — the file is per machine, deliberately, in the same spirit as a shell profile.

## Glossary

- **run-modify-write mutator** - any change to the registry that has to read the current file, edit it, and write it back: registering a project, saving preferences, minting the daemon token, saving a credential.

## Business logic — TL;DR

- **One file per user, in a known place** - the registry lives at `the-framework.json` under the user's config directory, or as the dotted `.the-framework.json` in their home directory when there is no config directory set.
- **A project has a stable id derived from its path** - the same repo path always produces the same id, and two repos with the same folder name still get distinct ids.
- **Registering a project is idempotent** - registering a path already registered returns the existing record untouched, so the date it was first added survives.
- **Reading never fails** - a missing, unreadable, or malformed file reads as an empty registry rather than an error.
- **Everything read or written is validated** - unknown fields are dropped, values outside the sets the dashboard offers are ignored in favour of the default, numbers are clamped to the range the controls allow, and strings are trimmed and length-capped, so neither a hand-edited file nor a hostile client can put junk in the user's home file.
- **A save that names one setting changes only that setting** - preferences are merged key by key, so one dashboard tab writing a stale snapshot cannot silently revert someone else's change.
- **Writes are atomic and owner-only** - the new contents are written beside the real file and renamed over it, with owner-only permissions applied before the rename.
- **Changes to the file never interleave** - every run-modify-write mutator runs strictly one at a time.
- **Secrets are never handed back to a client** - the daemon token and the stored credentials sit outside the preferences, so they can never reach the browser; the dashboard is told only that a credential is present.

## Business logic

### One file per user, in a known place

#### User story

See `## User story`.

#### Business logic

The registry is a single JSON file, not a directory: `the-framework.json` inside the user's configuration directory when one is configured, otherwise `.the-framework.json` in their home directory. It holds the project list, the preferences, the daemon token when one exists, and the credentials block when any credential is saved. Its parent directory is created if missing.

### A project has a stable id derived from its path

#### User story

The dashboard addresses projects by id in its URLs and in stored settings, so the id has to be URL-safe and has to survive restarts.

#### Business logic

A project's id is the repo's folder name, lowercased with anything that is not a letter, digit or dash replaced by a dash, followed by a short hash of the full path. The same path always yields the same id, and two repos that happen to share a folder name still get distinct ids because their full paths differ.

### Registering a project is idempotent

#### Business logic

A project is registered by its absolute path. If that path is already registered, the existing record — including the timestamp of when it was first added — is returned unchanged and nothing is written. Otherwise a new record is appended, carrying the path, its id, and the moment it was added, and the file is written back with the preferences preserved.

When the file lists the same path twice — hand-edited, or written by a version that allowed it — only the first record is kept, comparing paths after resolving them.

### The preferences

#### User story

The dashboard's global options are how the user configures everything: what an agent runs on, how far it publishes its work, when to be notified, whether the daemon may work unattended. They must survive a restart and be visible to the daemon itself, not just the browser.

#### Business logic

Every preference is optional; unless stated otherwise below, absent means off.

Agent setup:

- **model** - which model an agent runs on. Absent means the driver's own default. Blank is treated as no choice; so is the literal word `Default`, which was once a picker's visible label with an empty stored value, and would otherwise be handed to the CLI as a model nobody chose and fail the turn.
- **driver** - which coding-agent CLI drives the agent. Only the known drivers are accepted; absent means Claude Code.
- **run target** - where an agent executes: this device, a GitHub Actions runner, or a Claude Code cloud session. Only the known targets are accepted; absent means this device.
- **handoff** - how far a finished agent publishes itself, along the ladder local, push, pr, merge. Only a rung of the ladder is accepted; **absent means open a PR**. This is the one preference that is on by default: it is what makes handoff zero-configuration. The previous behaviour was a button nobody was obliged to press, so finished work sat on a local branch nobody had been told about. An individual agent can still opt out from its own action bar.
- **vanilla** - drop the built-in system prompt while keeping the session controls.
- **transparent** - run the wrapped coding agent completely raw: no framework prompt, no protocols, no dashboard, no loops. The coarse master off-switch.
- **browser** - give the agent a real browser to drive.
- **on-before-mergeable quality** - when an agent signals ready for merge, queue the quality follow-ups onto the agent queue first.

Notifications, split into which categories fire and which methods carry them, so a category reaches whichever methods are on:

- **"needs you"** - an agent is awaiting an answer, or a PR is ready to review. **Absent means on**: human-intervention pings are the baseline The Framework leans on, so the user has to turn them off deliberately.
- **new activity** - the plainer feed of an agent starting or finishing. Absent means off; it keeps the user loosely informed while nothing needs them.
- **browser notifications** - **absent means on**.
- **Discord notifications** - absent means off, because Discord reaches the user when no dashboard is open. It only decides *whether* to post; where to post comes from the stored Discord webhook or its environment override.

Autonomy:

- **Auto PM** - let the daemon start work by itself. Absent means off: it spends the user's allowance without being asked.
- **routine opt-out** - the routines Auto PM must not fire, named individually. Absent or empty means every routine runs. It lists exceptions rather than selections so that a routine added in a later version is on for everyone, instead of silently never running for whoever saved the setting before it shipped; and it names routines rather than numbering them so reordering them cannot move which one is switched off. The names are stored as written and are not checked against the known routines, so a name from a newer version survives a downgrade instead of being erased by it.
- **routine concurrency** - how many agents a routine may keep going at once on one project. Absent means the standard default; the value is rounded and floored at one — with no upper bound — because zero is what the Auto PM switch itself already means and a hand-edited zero would otherwise wedge the routine while the switch still read as on. Only the draining routine fans out — it takes work off the agent queue, one pinned entry per agent, so several at once do disjoint work. The routines that invent work each rewrite the queue file, so they stay one agent per tick whatever this says.
- **routine project** - which project the Routine work card's "Run now" button targets. Absent means the first registered project. It is a stored setting rather than card state because the choice decides which repo spends quota and gets branches pushed, and card state forgot it on the most common navigation there is — open an agent, come back — so the next click landed on the user's real project. An id that no longer names a registered project simply falls back.
- **spend offset** - how far the limit for unattended spending sits from the quota boundary, in percentage points. Absent means the standard cushion ahead of the boundary rather than sitting exactly on it. Negative holds unattended work back further; positive lets it borrow into the days still to come. It is an offset rather than an absolute percentage so the limit travels with the boundary as the week goes on, instead of being overtaken by it on the second day. The stored value is rounded and clamped, so a hand-edited file cannot put the limit anywhere the slider could not.

Everything else:

- **editor** - which editor CLI "Open in editor" launches. Absent falls back to the editor environment variable, then to `code`.
- **theme** - the dashboard's colour theme: follow the operating system, light, or dark. Anything else, including absent, means follow the operating system.
- **bridge** - let the Claude web bridge report the question a cloud session is parked on into the dashboard. Absent means off: it opens the daemon's one route reachable from another origin, and turning it on is what mints the bridge token.
- **bridge browser** - let the daemon run its own browser for the Claude web bridge: a Chrome for Testing with the extension installed, signed in once and kept minimized, so web runs stop depending on the user's own Chrome being open. Absent means off: it downloads a browser and keeps a signed-in claude.ai session on disk, neither of which should happen unasked. Needs the bridge.
- **custom presets** - the user's own saved prompts, shown beside the built-in presets.
- **onboarding dismissed** - whether the Overview's onboarding checklist has been dismissed. Absent means show it, so a fresh install is walked through setup; dismissing hides it only on the Overview, and the same checklist stays on the settings page.

### Everything read or written is validated

#### User story

The registry is a plain file in the user's home directory, so it gets hand-edited; and the values reaching it come from a browser, which cannot be trusted to send only what the dashboard offers.

#### Business logic

Validation runs both when reading the file and when writing it, so a bad file is repaired on its next save and a bad write never lands. Fields that are not preferences the product knows about are dropped entirely. A preference whose value is the wrong kind of thing is dropped, which puts it back to its default. Preferences drawn from a fixed set — theme, driver, run target, handoff — accept only members of that set. Numeric preferences are rounded and clamped to the range the dashboard's own controls allow. Free-form strings are trimmed and length-capped, and a blank one is treated as absent.

The list of routine opt-outs is trimmed, de-duplicated, and bounded in both the length of each name and the number of names.

Custom presets are kept only when each has a non-empty identifier, label and prompt; labels and prompt text are trimmed and length-capped, entries reusing an identifier already taken are dropped, and the list as a whole is capped. A malformed entry is skipped rather than failing the whole read.

Credentials are kept only as non-empty trimmed strings within a length cap, and any key that is not a credential the product knows about is dropped, so the block cannot become a scratch space for whatever a caller passes.

#### Rationale

The set of boolean preferences is enforced against the preference list itself, in both directions: a preference that exists but is missing from the validation list would be silently discarded on every save — the write-then-vanish failure that a settings file must never have — and a name in the list that is not a real preference is equally caught.

### A save that names one setting changes only that setting

#### User story

The user has the dashboard open in two tabs, or changes a setting from one machine while another is watching. A tab that has been open a while holds a stale copy of every setting.

#### Business logic

Preferences can be saved in two ways: replacing the whole block, or merging in only the keys the caller names. Merging is the preferred way. Replacing from a client's full snapshot replays every value that client happens to hold, so a tab opened before someone else's change silently reverted it on the tab's next write, whatever setting that write was actually about. Merging makes a write touch only what it names.

Clearing a setting needs no special value: validation already treats a blank string and an empty list as absent, so merging in a blank value is how the dashboard clears a setting.

After a save lands, the daemon's own services are told **which keys the write named** — not the merged result — so a listener can tell "this write switched the setting on" from "it was already on and something else changed". Notification happens only after the write has landed, and a listener that fails does not turn a successful save into a failed one.

### Writes are atomic and owner-only

#### User story

The registry holds every registered project and every preference. Losing it to a crash mid-write is a silent catastrophe, because a damaged file reads as an empty registry.

#### Business logic

The new contents are written to a temporary file beside the real one and then renamed over it, so a crash, a kill, or a full disk can only ever damage the temporary file. The temporary file is left behind on failure rather than cleaned up; one stray file is the cheaper half of that trade. Where the platform cannot rename atomically, the file is written directly.

The file is made readable and writable only by its owner, because it carries the daemon token and the user's credentials — with a default permission mask in a shared home directory they would otherwise be readable by every other account on the machine. The permissions are applied to the temporary file before the rename, since narrowing them afterwards would leave a window where the real path was readable. This is best-effort: a filesystem that cannot express permissions still gets its write.

### Changes to the file never interleave

#### User story

One daemon does several of these at once: startup registering a project while the dashboard saves a preference, or two binds each wanting a daemon token.

#### Business logic

Every mutator that reads the registry, edits it and writes it back runs strictly one at a time, machine-wide for the process. Without it, the later write would be computed from a read taken before the earlier one landed, and would silently drop it. A mutator that fails does not block the ones queued behind it, and each caller still receives its own outcome.

### The daemon token

#### User story

A daemon bound to something other than the loopback interface is reachable from the network, so every request to it has to be authenticated.

#### Business logic

The daemon token is generated the first time the daemon binds to a non-loopback address and reused from then on; a machine that only ever binds to loopback never grows one. Generating it is serialized with every other change, so two concurrent binds cannot each mint a different token. It is URL-safe, so it can be dropped straight into a link without further encoding. Reading the token is a separate, purely read-only operation, so a process that only wants to print the reachable URL never causes one to be generated.

The token is stored outside the preferences, so it can never be shipped to the browser bundle along with them.

### Secrets are never handed back to a client

#### User story

The user pastes a Discord webhook into the dashboard so the daemon can post notifications. From then on the dashboard should only ever tell them that one is set — never show it again, and never send it back to the browser.

#### Business logic

Credentials live at the top level of the registry, alongside the daemon token and outside the preferences, so neither the browser bundle nor any per-project override can carry them. Only daemon-side services that actually need the value read them; what the dashboard is told is presence, never content.

Saving credentials is a merge, not a whole-object write, because the dashboard's dialog edits one field at a time and must not clear another by not knowing it. A key that is not mentioned is left exactly as it was; a key set to an explicitly empty value is cleared — that is the Clear button. Clearing the last credential removes the credentials block from the file entirely.

#### Rationale

Keeping credentials in the registry rather than in a second file is deliberate: the registry already holds the daemon token that authenticates every request to a network-reachable daemon, so it is already a secret store. A second file would only spread the same exposure across two paths that both need locking down.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
