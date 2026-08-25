# Bug analysis: packages/framework/src/cloud-scratch-refs.ts

## Business logic (high-level)

The daemon sweep (#1547) that deletes from origin the two dead refs each `web`-target hand-off
leaves: the driver's slash-free `cloud-<counter>-<8hex>` clone ref and the pushed run branch
(`tf-agent-<id>`, legacy `the-framework/agent-<id>`). Checked clause by clause against
`cloud-scratch-refs.SPEC.md` and MEMORY.md's "only remove what has been pushed to the remote /
every removal recoverable":

- **Only two naming shapes are candidates** — `CLOUD_SCRATCH_REF` is tightly anchored
  (`^cloud-\d+-[0-9a-f]{8}$`), run branches must carry a parseable start time
  (`startedAtFromAgentId` validates the full `YYYY-MM-DDTHH-MM-SS-mmmZ` shape); everything else —
  default branch, `claude/*`, `tf-<session>`, a user's `cloud-experiments` — is never listed.
  Holds (pinned by the "never even a candidate" test).
- **Four gates** — age, holds-no-work, no-open-PR, not-busy — all clear before a deletion; every
  unprovable case keeps the ref, and the sweep never throws (`ls-remote` failure returns the empty
  result; a refused delete lands in `failed` and its first-seen entry is kept so the retry does
  not restart the day). Holds.
- **Age is proven, not guessed** — run branches age from the timestamp in their name; `cloud-*`
  refs age from this machine's own first-sight record in `.the-framework/cloud-refs.json`
  (rebuilt each sweep from what origin actually has, so entries for refs anyone deleted fall
  away). A hand-edited/unparseable timestamp restarts the day (conservative). Because each
  machine only deletes what it has itself watched for a day, another machine's fresh push is safe
  by construction. Holds.
- **Work gate first, and never wrong** — `landed()` proves the tip reachable from origin's
  default branch, trying the remote's own tip sha first, then the local `origin/<default>`
  tracking ref (sound: reachable-from-stale ⊆ reachable-from-fresh, except after a force-pushed
  default branch — noted below). Failing that, `emptyTipOnLandedParent()` recognizes the #1601
  anchor: tree equals parent's tree and the parent landed, fetching the ref's object when it is
  not local; any failure reads "holds work". A ref failing the work gate is spent no PR lookup
  (pinned). Holds.
- **PR gate fails toward deletion** (`.catch(() => [])` and `ghPrsForBranch` resolving `[]`
  unauthenticated) — explicitly accepted by the SPEC's rationale because the work gate already
  proved the ref holds nothing; worst case is a closed PR losing its branch pointer. Matches SPEC.
- **Busy gate** — `deps.busy` (agent ids the daemon still owns) protects run branches regardless
  of age. `cloud-*` refs have no agent id and rely on the 24h watch window alone, which is the
  SPEC's own design (provisioning is minutes, the window a day). Holds.
- **Quiet service** — `startCloudScratchSweep` has no timer (the daemon's clock ticks it), logs
  only deletions and failures, joins overlapping ticks on one in-flight promise, per-project and
  per-tick errors swallowed, `stop()` makes later ticks no-ops and breaks mid-iteration. Holds.

Residual risks weighed and accepted as conservative-by-design, not bugs:

- A force-pushed (history-rewritten) default branch could make the stale-tracking-ref fallback in
  `landed()` claim reachability the fresh remote no longer has, deleting a ref whose commits are
  then only in local reflogs. Requires rewriting the default branch — outside anything this
  system does, and the first loop iteration (the fresh remote tip) usually answers first.
- A `tf-agent-<digits-in-range-shape>` branch whose digits form an invalid date
  (`2026-99-99T…`) parses to `NaN`, and `now - NaN < ageMs` is false → it becomes a candidate
  rather than being kept "young"; it must still clear the work and PR gates. No caller mints such
  a name (ids come from real `toISOString()` clocks), so this is unreachable in practice; noted
  as a reliance.
- The result doc says refs "matching neither naming" are never listed, while a run-prefixed
  branch with an unparseable id is also silently unlisted (L272 `continue`) — the SPEC's "an
  agent branch whose age is unknowable keeps the ref" is honored; only the listing comment is
  slightly narrower than reality. Cosmetic.

## Functions (low-level)

- **`SCRATCH_REF_SAFE_AGE_MS`** — 24h. Correct.
- **`CLOUD_SCRATCH_REF`** — anchored, exact charset; no `i` flag so an uppercase-hex tag would
  not match (the driver mints lowercase). Correct.
- **`RUN_BRANCH_PREFIXES`** — `tf-agent-` and legacy `the-framework/agent-` (verified against
  `branch-names.ts`). Correct.
- **`cloudRefsStatePath` / `readState` / `writeState`** — path under `.the-framework/`;
  `readState` tolerates absent/unreadable/malformed and filters non-string values; a JSON
  `__proto__` key assigned via bracket notation on a plain object is a silent no-op (no
  pollution, entry dropped) — harmless. `writeState` mkdirs first; its caller catches, so an
  unwritable state only delays deletions. Correct.
- **`parseLsRemote`** — symref regex matches `ref: refs/heads/<name>\tHEAD` (slashes in the
  default's name fine via `\S+`); head regex requires `refs/heads/`, so the bare `HEAD` line is
  ignored; sha length `{40,64}` covers SHA-1/SHA-256 (loose in between, harmless); fallback
  default `main`/`master` only when present among heads, else undefined → work gate unprovable →
  everything kept. Correct.
- **`landed`** — undefined default → false; tries remote tip then tracking ref with
  `merge-base --is-ancestor`, both failures → false. Correct (see force-push caveat above).
- **`emptyTipOnLandedParent`** — object presence probe, fetch-on-miss (a fetch that succeeds but
  still lacks the object falls into the catch), tree/parent/parent-tree reads, `tree !==
  parentTree` → false, else parent must have landed. First-parent `sha^` is right: anchors are
  single-parent empty commits. Correct.
- **`sweepCloudScratchRefs`** — the orchestration walked above. Details: first sight records
  `now` and keeps `young`; boundary is `< ageMs` keeps, `>= ageMs` candidate (tests pin the
  exact boundary as deletable); `delete firstSeen[ref]` after a successful push-delete; the
  state file is rewritten only when the serialized map changed (key-order differences cause a
  spurious rewrite at worst). Correct.
- **`startCloudScratchSweep`** — default per-call `busy()` snapshot; `inflight ??=` joins
  concurrent ticks and clears in `finally`; log wording distinguishes deletion from failure.
  One nuance: a tick that arrives mid-sweep returns the *running* sweep's promise and does not
  schedule a fresh pass — fine for a periodic clock, and exactly what the comment promises.
  Correct.

## Bugs found

None found.
