import type { DriverEvent } from './driver/index.js'

/** One selectable option in an interactive {@link ChoiceRequest} (#304). */
export interface ChoiceOption {
  /** Stable id posted back when this option is picked. */
  id: string
  /** The option shown to the user. */
  label: string
  /** Optional one-line detail under the label (e.g. why an alternative lost). */
  detail?: string
  /** In a multi-select ({@link ChoiceRequest.multi}), whether this option starts checked. Ignored for single-select. */
  default?: boolean
}

/**
 * An interactive choice the agent pauses on until a pick arrives (#304). Emitted as
 * a `choice` {@link FrameworkEvent}; the dashboard renders it in a panel and posts
 * the pick back. The recommended option is the default the autopilot auto-accepts.
 */
export interface ChoiceRequest {
  /** Unique id for this pending choice; the pick is posted back against it. */
  id: string
  /** The question shown above the options (e.g. "Approve this plan?"). */
  title: string
  /** The options to choose between (at least one). */
  options: readonly ChoiceOption[]
  /**
   * The option id pre-selected as the default (autopilot auto-accepts it). Required
   * for a single-select; omitted for a {@link multi} select, where each option's own
   * {@link ChoiceOption.default} drives the pre-checked set instead.
   */
  recommended?: string
  /**
   * Render as a multi-select checklist (#332): each option is a checkbox pre-checked
   * per its {@link ChoiceOption.default}, and the pick resolves to the selected
   * *subset* of ids rather than one. Absent = the single-select gate (#304).
   */
  multi?: boolean
  /** Auto-accept the recommended option after this many ms when autopilot is on. Default 10000. */
  autoAcceptMs?: number
  /** The markdown file under approval (e.g. `PLAN_<slug>.agent.md`); the doc sidebar renders it. */
  file?: string
}

/**
 * Why the post-merge (#326) cleanup step declined to run (#835). Every decline carries one,
 * so "I turned it on and nothing happened" has an answer in the log.
 */
export type OnBeforeMergeableSkip =
  /** The agent never signalled `setReadyForMerge()`, so there is nothing to clean up after. */
  | 'not-ready-for-merge'
  /** The agent was stopped (Stop button, Ctrl+C, budget cap) rather than finished. */
  | 'run-stopped'
  /** A fake/offline run: no agent to hand the follow-up prompt to. */
  | 'fake-run'
  /** The agent never called `setSessionName()`, which every line of the prompt names. */
  | 'no-session-name'
  /** `process.argv[1]` was empty, so there is no binary to spawn the follow-up with. */
  | 'no-bin-path'

/**
 * Why the end-of-session handoff (#1102) did nothing. Every one of these is a normal end rather
 * than a fault, and each is reported so that "it was ticked and nothing happened" has an answer.
 *
 * Lives here beside {@link OnBeforeMergeableSkip} rather than with the handoff logic, because the
 * event union is a leaf: the module that decides these imports the type, not the other way round.
 */
export type AutoHandoffSkip =
  /** Neither box was ticked, so there was nothing to do. */
  | 'not-armed'
  /** The branch no longer exists (deleted, or never created). */
  | 'branch-gone'
  /** The session committed nothing the base branch does not already have. */
  | 'no-commits'
  /**
   * The session's pending work could not be committed (#1376), so publishing would hand off a
   * branch missing its last edits. The work stays in the checkout; teardown retries the commit.
   */
  | 'commit-failed'
  /** The repo has no remote to push to. */
  | 'no-remote'
  /** The branch already has a PR: opening a second one is the one mistake this must not make. */
  | 'already-open'
  /**
   * The branch's PR is merged or closed and its head is still the branch tip (#1512): everything
   * the session did already reached the human, so there is nothing left to publish. Only that
   * exact case — a session that kept committing after its PR merged gets a fresh PR instead.
   */
  | 'already-landed'
  /** The branch is already on the remote at this commit, and only the push was asked for. */
  | 'already-pushed'
  /** The agent was stopped (Stop button, Ctrl+C, budget cap) rather than finished. */
  | 'run-stopped'
  /** A fake/offline run: nothing real to publish. */
  | 'fake-run'

/**
 * Why an armed merge did not run (#1363). The agent's config arms the merge; the authorization is
 * the agent's, not the config's (rule settled on #1390): the agent must have declared the work
 * done, and the framework must not already know of work pending in this session. The global
 * `TODO_AGENTS.md` queue never withholds a merge — it is decoupled from sessions.
 */
export type MergeWithheldReason =
  /** The agent never called setReadyForMerge(): the work was never declared done. */
  | 'not-ready-for-merge'
  /** The session's own `TODO_<SESSION_NAME>.agent.md` still has open entries. */
  | 'session-todo-open'

/**
 * How the merge half of a handoff went (#1216), when the agent was armed for it. Lives here beside
 * {@link AutoHandoffSkip} for the same leaf-module reason.
 *
 * `auto-armed` is the preferred outcome: GitHub's own auto-merge takes the PR, so it lands when
 * its checks pass rather than before them. `merged` is the fallback where the repo does not allow
 * auto-merge and the PR was merged directly. `watched` (#1418) is the auto path's answer where
 * GitHub cannot arm the merge and the PR's checks have not passed yet: merging directly there is
 * exactly the lands-before-CI hazard (#1406), so the daemon's CI watch takes the PR instead and
 * merges it once its checks go green. `failed` never fails the handoff — the PR exists either
 * way, a human can still merge it by hand. `withheld` means the merge never ran at all (#1363):
 * it was armed but not authorized, and the PR opened as a draft for a human instead.
 */
export type AutoMergeOutcome =
  | { outcome: 'auto-armed' | 'merged' | 'watched' }
  | { outcome: 'withheld'; reason: MergeWithheldReason }
  | { outcome: 'failed'; error: string }

/** Who resolved a {@link ChoiceRequest}: a human, the autopilot countdown, or a headless auto-accept. */
export type ChoiceBy = 'user' | 'autopilot' | 'auto'

/** What a {@link import('./agent.js').RunFrameworkOptions.requestChoice} handler resolves with. */
export interface ChoicePick {
  /** The picked option id, or (for a {@link ChoiceRequest.multi} select) the selected subset of ids. */
  picked: string | readonly string[]
  /** Who picked it. Default `'user'`. */
  by?: ChoiceBy
}

/** Normalize a {@link ChoicePick} (single id or subset) to a list of picked ids. */
export function pickedIds(picked: string | readonly string[]): string[] {
  return Array.isArray(picked) ? [...picked] : picked ? [picked as string] : []
}

/**
 * The single event type the whole agent streams over. It unifies three sources so
 * the dashboard (and terminal) render one timeline: the session's own narration
 * (the moat: checklist verdicts, deploy), the wrapped
 * agent's own black-box progress, and framework-level status. We own this stream
 * (guardrail #2, #165) rather than surfacing the agent's transport directly.
 */
export type FrameworkEvent =
  /**
   * Emitted once at start: which agent is wrapped, the workspace, and a link. `model` is the
   * model id the driver was started with (#1438), recorded per leg — a continuation (#762) emits
   * its own `session` event and may run a different model, so readers fold the latest rather
   * than pinning the first. Absent when the agent left the agent on its own default.
   */
  | { kind: 'session'; driver: string; workspace: string; fake: boolean; sessionLink?: string; model?: string }
  /**
   * Emitted once the wrapped agent reports its real session id (not known at
   * start). Carries the live id and, when a link template was supplied, the
   * resolved URL to jump into that session (#165). Re-emitted if the id changes
   * (each Claude Code prompt is a fresh session), keeping the link current.
   */
  | { kind: 'session-update'; sessionId: string; sessionLink?: string }
  /**
   * The full system prompt sent to the wrapped agent for this agent (#343): the
   * #326 block plus any personas / skills / memory framing, exactly as passed to
   * the driver's system channel. Emitted once at session start so the dashboard
   * can show the normally-hidden prompt (the per-turn user prompts arrive as
   * `driver` `start` events, which already carry their text). Transparency, never
   * gated on.
   */
  | { kind: 'system-prompt'; text: string }
  /** What this session was asked for, emitted once as it opens (#211). */
  | { kind: 'intent'; text: string }
  /** The wrapped agent's own progress, forwarded verbatim (never gated on). */
  | { kind: 'driver'; event: DriverEvent }
  /**
   * The generated app is booted and serving. Emitted after a successful agent when
   * a serve config is set: the app is kept running so the user can open it, and
   * the dashboard shows a live preview link (torn down on Ctrl+C).
   */
  | { kind: 'preview'; url: string; command: string }
  /**
   * The agent's browser preview is up and listening on this loopback port (#813).
   *
   * Only the port travels. The dashboard reaches the stream through the daemon, which proxies
   * to this port, so the agent's bridge stays same-origin-invisible and unreachable from the web.
   * Frames themselves never enter the log: someone will type a password into that pane.
   */
  | { kind: 'browser-stream'; port: number }
  /**
   * The agent's browser is showing this page (#1455 item 6b): emitted for the first real
   * (http/https) page and again on every change of page, so the transcript can host the live
   * preview at its point of use rather than only in the rail. Only the URL travels — frames
   * never enter the log, same rule as `browser-stream`. Re-emitted after each `session` so the
   * row survives the dashboard's last-session slice (#829); readers fold repeats of the same
   * URL in place rather than stacking duplicates, like `view` re-shows.
   */
  | { kind: 'browser'; url: string }
  /** A framework-level log line. */
  | { kind: 'log'; message: string }
  /**
   * Something went wrong that only the user can fix (#1500), reported by the agent itself
   * through an `error` block rather than left in prose the reader has to notice. The headline
   * is the first line, the detail is the rest.
   *
   * An event, not a status: it says what happened at this point in the run and stays in the log
   * as history — nothing clears it, because nothing can un-happen it. The project-level errors a
   * background job finds between runs are the other half (project-errors.ts): those are
   * conditions that are true *now*, and clear themselves when the condition is gone.
   */
  | { kind: 'error'; headline: string; detail?: string }
  /**
   * An ad-hoc markdown view the agent pushed to show the user (#441), e.g. a plan,
   * a summary, or a diff writeup. Non-blocking (unlike a `choice`): the dashboard
   * renders it as a view in the right rail. `id` is stable per title, so re-showing
   * the same view updates it in place rather than stacking a duplicate.
   */
  | { kind: 'view'; id: string; title: string; markdown: string }
  /**
   * The agent named the session (#326): the `[a-z0-9-]` slug it chose (also its
   * `tf-<name>` branch), from a `setSessionName()` signal. Non-blocking;
   * the dashboard shows it as the agent's label. Re-emitted on a rename.
   */
  | { kind: 'session-name'; name: string }
  /**
   * The agent signalled `setReadyForMerge()` (#326): it believes the work is complete
   * and ready for human review. Non-blocking — it flips the agent's dashboard status from
   * building (orange) to ready (green); the on-before-mergeable quality prompts hang off it.
   */
  | { kind: 'ready-for-merge' }
  /**
   * The pull request the agent asked for (#1567/#1618), via an `open-pr` block: how an agent
   * opens a PR *through* the framework instead of running `gh pr create` itself, so the ticket's
   * issue reference and recording the number still apply. The title is the agent's name for the
   * work and the description is what changed; either may be absent when the agent wrote only the
   * other. Non-blocking; the end-of-agent handoff uses the latest one.
   */
  | { kind: 'open-pr'; title?: string; description?: string }
  /**
   * The #326 post-merge cleanup step settled (#835): it queued the quality follow-ups,
   * queued them but did not finish cleanly, or declined with a {@link OnBeforeMergeableSkip}.
   *
   * An event rather than stdout because the surfaces that need it cannot read stdout: a
   * dashboard-started run is spawned with `stdio: 'ignore'`. Emitted only when the option
   * was on, so an agent that never asked for the step stays quiet.
   */
  | { kind: 'on-before-mergeable'; outcome: 'queued' | 'incomplete' }
  | { kind: 'on-before-mergeable'; outcome: 'skipped'; reason: OnBeforeMergeableSkip }
  /**
   * What the end-of-session handoff is armed to do (#1102), emitted at the start and again
   * whenever the dashboard's checkboxes change it.
   *
   * This is what makes the boxes survive a reload: the control channel carries the instruction,
   * but only an event reaches the agent's meta, which is the one thing a tab opened later can read.
   *
   * `merge` carries the auto-merge arming (#1216) so the armed line can say the most consequential
   * half of the plan (#1382): without it a merge-armed agent advertised "open a draft PR" and then
   * merged to main. Optional because journals written before #1382 lack it; absent reads as off,
   * the conservative display. It has no checkbox and never changes mid-run, so re-emits repeat it.
   */
  | { kind: 'handoff-armed'; push: boolean; pr: boolean; merge?: boolean }
  /**
   * The ticket this agent was started to implement (#1117), as a repo-relative `tickets/<file>.md`.
   *
   * Emitted once at start, and only when the framework itself chose the ticket — today that is the
   * [Drain queue] run, whose queue entry links back to the ticket it was queued from (#1164). An
   * event rather than a start argument for the usual reason: only an event reaches the agent's meta,
   * and the meta is what a dashboard tab opened mid-run reads. Absent means nobody knows what this
   * run is implementing, which is every hand-written prompt.
   */
  | { kind: 'ticket'; path: string }
  /**
   * The pull request this session's work is on (E6), the moment one is opened for it.
   *
   * An event for the same reason `ticket` and `branch` are: only an event reaches the agent's meta,
   * and the meta is what every later surface reads. Before this, each of them re-resolved the PR
   * live from the branch — trying the recorded branch, then the session-name branch, then the
   * run-id branch, and filtering the results by whether the PR predated the session — which is a
   * three-way guess plus a timestamp heuristic standing in for one integer nobody had written down.
   */
  | { kind: 'pull-request'; number: number; url: string }
  /**
   * The branch the agent's work is on (#1277), observed off the checkout rather than guessed:
   * emitted at start with the branch the agent actually begins on, and again when the framework
   * renames the run-id branch after the agent names the session. Folded to `AgentMeta.branch`,
   * which every surface resolves first — before this event the branch was stamped only at
   * teardown (#799), so any read before that guessed between three naming schemes.
   */
  | { kind: 'branch'; branch: string }
  /**
   * The hand-off anchor a cloud run pushed for its session to clone at (#1601): an empty commit
   * unique to this run, so the branch the session actually works on — a `claude/*` name of the
   * cloud's own choosing, never the designated run branch — is recognizable later by plain
   * ancestry. Folded to `AgentMeta.cloudAnchor`, which the daemon's adoption pass matches
   * against origin's `claude/*` heads once the session has pushed its work.
   */
  | { kind: 'cloud-anchor'; sha: string }
  /**
   * What the end-of-session handoff actually did (#1102): pushed and/or opened a draft PR,
   * declined for a reason that is not a fault, or failed at one of the two steps.
   *
   * Same reason as on-before-mergeable above: a dashboard-started agent has no stdout anyone reads,
   * so an outcome that is not an event is an outcome nobody learns.
   */
  | { kind: 'handoff'; outcome: 'skipped'; reason: AutoHandoffSkip; merge?: AutoMergeOutcome }
  | { kind: 'handoff'; outcome: 'done'; pushed: boolean; url?: string; number?: number; merge?: AutoMergeOutcome }
  | { kind: 'handoff'; outcome: 'failed'; step: 'push' | 'pr'; error: string }
  /**
   * The work has settled and the agent is parked on the user (#785): it stays open as a
   * conversation (#714), so its process is still alive and it still takes messages, but
   * the agent is not doing anything until you say something.
   *
   * Emitted each time the agent parks, and undone by the next `driver` `start` — so "is it
   * working or waiting for me" is answerable from the event log rather than inferred from
   * a status that only changes when the agent ends.
   */
  | { kind: 'settled' }
  /**
   * Cumulative token + cost usage for the agent so far (#322). Emitted after each
   * agent turn that reports usage; the dashboard renders a live spend readout and
   * the agent stops itself once `costUsd` reaches the budget cap, if one is set.
   *
   * `costUsd` is absent when the agent reports tokens but no price (#540), which
   * is also when no budget cap can fire.
   */
  | {
      kind: 'usage'
      costUsd?: number
      inputTokens: number
      outputTokens: number
      cacheReadTokens: number
      cacheCreationTokens: number
      turns: number
    }
  /**
   * The agent paused on an interactive choice (#304) and is awaiting a pick. The
   * dashboard renders the options with the recommended default pre-selected and
   * posts the pick back; a headless agent auto-accepts the recommended option.
   */
  | ({ kind: 'choice' } & ChoiceRequest)
  /** A pending {@link ChoiceRequest} was resolved — the agent continues on `picked` (one id, or the selected subset). */
  | { kind: 'choice-resolved'; id: string; picked: string | readonly string[]; by: ChoiceBy }
  /**
   * The agent finished. `ok` is false when it threw. `stopped` marks the common,
   * non-error case where the user interrupted it (the dashboard Stop button /
   * Ctrl+C), so a surface can show "stopped" rather than "failed".
   */
  | { kind: 'end'; ok: boolean; stopped?: boolean; detail?: string }
