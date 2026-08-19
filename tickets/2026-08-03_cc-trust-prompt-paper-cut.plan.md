Effort: 2
Uncertainty: 4

# [Plan] Paper cut: "Claude Code has not been trusted in this project"

Proposal to remove the one-time manual trust step for web runs by having the framework write Claude Code's own trust record for the project root before the cloud hand-off, keeping the existing prompt detection as a safety net.

## TLDR

- Today the framework treats folder trust as strictly the user's act: `claude-trust.ts` only *reads* `~/.claude.json` (#1318), the dashboard warns before a doomed web run, and the cloud driver detects the dialog and fails fast with advice (#1314). The ticket (and maintainer stance in #1493: UX > safety for now) reverses that read-only decision.
- Recommended fix: before the `--cloud` hand-off, write `projects[<root>].hasTrustDialogAccepted: true` into `~/.claude.json` for `trustRootOf(cwd)` — the exact record the CLI itself writes when the user accepts the dialog. Run worktrees inherit the root's trust (verified live, see `cloud.ts` `trustRootOf` docstring), so one write covers every agent.
- `--dangerously-skip-permissions` (the flag the maintainer floated) is likely the wrong lever: it governs in-session permission prompts, not the folder-trust onboarding dialog, and its interaction with `--cloud` is unverified. Only worth probing if the config write proves fragile.
- Small change: one new function + tests in `claude-trust.ts`, one call site in `cloud.ts`, dashboard warning removed/downgraded, SPECs updated. Roughly a day including live verification.

## Current state (what the fix touches)

- `packages/the-framework/src/claude-trust.ts` — reads `projects[root].hasTrustDialogAccepted` from `~/.claude.json`; deliberately read-only per its SPEC.
- `packages/the-framework/src/driver/cloud.ts` — `TRUST_PROMPT` detection aborts the pty run and fails with one-time-fix advice; `trustRootOf()` maps an agent worktree to the root where trust must live.
- `packages/the-framework/src/dashboard-rpc/projects.ts` `onClaudeTrust` + `dashboard/components/StartAgentForm.tsx` — the pre-start warning (#1318).

## Problems

1. **Which mechanism grants trust non-interactively?** (uncertainty 5) — several candidates, only one verified end-to-end by us (the config record is what the CLI reads; `readClaudeTrust` already keys on it, and worktree inheritance was verified live per the `cloud.ts` docstring). The others need live probing.
2. **Write race on `~/.claude.json`** (uncertainty 3) — the CLI rewrites that file wholesale (settings, per-project state). A framework write concurrent with a CLI write could be clobbered or clobber. Window is tiny (one read-modify-write just before hand-off) but not zero.
3. **Is silent auto-trust acceptable?** (uncertainty 2) — the maintainer explicitly said UX beats safety for now, so mostly settled; the remaining question is whether to keep any visible trace.

## Solutions

For problem 1, in order of preference:

- **A. Write the trust record (recommended).** Add `writeClaudeTrust(root)` next to `readClaudeTrust`: read `~/.claude.json`, set `projects[root].hasTrustDialogAccepted = true` preserving everything else, write back; create a minimal file when none exists. Call it in `CloudSession.prompt` just before `runPty`, keyed on `trustRootOf(this.cwd)`, best-effort (a failed write falls through to today's detection + advice). Deterministic, version-independent in practice (it is the CLI's own persisted format, already depended on read-side since #1318), and testable without a live CLI.
- **B. `--dangerously-skip-permissions`.** Needs live verification that it suppresses the *trust* dialog at all (it targets permission prompts; recent CLIs show their own one-time bypass confirmation, which would just swap one interactive blocker for another). Also over-broad: it changes the session's permission posture when we only want folder trust. Fall back to probing this only if A breaks on a CLI update.
- **C. Answer the dialog through the pty.** The driver already sees the prompt; it could send the accept keystroke. But the `script`-hosted pty has stdin wired to an empty regular file precisely because there is no interactive channel — this needs node-pty or stdin pre-seeding, and the keystroke depends on dialog layout across CLI versions. Strictly worse than A for the same end state (the CLI writes the same config bit).
- **D. Keep manual, better UX** — already shipped as #1318/#1314; the ticket says it is not enough.

For problem 2: write only when the root is not already trusted (read first — usually a no-op after the first run), keep the read-modify-write in one tick, and treat any failure as non-fatal (notice + existing fail-fast path). No locking; a lost write self-heals on the next run.

For problem 3: emit a one-line driver `notice` the first time trust is written ("Trusted <root> for Claude Code on behalf of this run"), so the act stays visible without blocking anything. Rationale worth recording in the SPEC: starting a web agent on a project is itself a trust decision by the user — the write automates consent already given, it does not invent it.

## Implementation

1. `claude-trust.ts`: add `writeClaudeTrust(root, path?)` (read-modify-write; create file if missing; preserve unknown fields; throw on unparseable existing JSON rather than destroying it). Update module docstring and `claude-trust.SPEC.md` — the read-only stance is explicitly reversed by #1493.
2. `claude-trust.test.ts`: new cases — writes entry into existing config preserving siblings, creates missing file, no-ops when already trusted, refuses to overwrite unparseable JSON.
3. `cloud.ts` `CloudSession.prompt`: before the pty run, `readClaudeTrust(trustRootOf(this.cwd))`; when not trusted, `writeClaudeTrust` + notice; on write failure, notice and continue (existing `TRUST_PROMPT` detection remains as the safety net — keep it and its test).
4. Dashboard: remove the `untrusted` blocker in `StartAgentForm.tsx` (or downgrade to informational "will be trusted automatically"); simplify or drop `onClaudeTrust` accordingly. Update `cloud.SPEC.md` bullet about never answering the trust question.
5. Verify live once: fresh untrusted repo → `framework` web run → cloud session created with no manual step; confirm the CLI does not reject or rewrite the injected record.
6. Close #1493 with a note naming the reversed decision (read-only trust, #1318) and why.
