import type { DriverEvent } from 'agent-driver'

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
 * the pick back. The recommended option is what an agent nobody is watching takes.
 */
export interface ChoiceRequest {
  /** Unique id for this pending choice; the pick is posted back against it. */
  id: string
  /** The question shown above the options (e.g. "Approve this plan?"). */
  title: string
  /** The options to choose between (at least one). */
  options: readonly ChoiceOption[]
  /**
   * The option id pre-selected as the default (taken when nobody is watching). Required
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
  /** The markdown file under approval (e.g. `PLAN_<slug>.agent.md`); the doc sidebar renders it. */
  file?: string
}

/** Normalize a pick (single id or, for a {@link ChoiceRequest.multi} select, a subset) to a list of picked ids. */
export function pickedIds(picked: string | readonly string[]): string[] {
  return Array.isArray(picked) ? [...picked] : picked ? [picked as string] : []
}

/**
 * The single type a run's timeline is read as. The framework emits none of these itself (#1774):
 * a run's tool writes the run's diary, and every line of it is read as one of these so the
 * dashboard and the terminal render one timeline whatever wrote it.
 *
 * What a diary yields is the agent's own progress (`driver`), the session id it reports
 * (`session-update`), the question a turn ended on (`choice`), what it cost (`usage`) and how it
 * ended (`end`).
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
  /** The wrapped agent's own progress, forwarded verbatim (never gated on). */
  | { kind: 'driver'; event: DriverEvent }
  /**
   * Cumulative token + cost usage for the agent so far (#322). Emitted after each
   * agent turn that reports usage, for the dashboard's live spend readout. Nothing
   * gates on it: an agent already running is never cut short over spending, and the
   * account's quota decides what may *start* instead.
   *
   * `costUsd` is absent when the agent reports tokens but no price (#540).
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
   * posts the pick back.
   */
  | ({ kind: 'choice' } & ChoiceRequest)
  /**
   * The agent finished. `ok` is false when it threw. `stopped` marks the common,
   * non-error case where the user interrupted it (the dashboard Stop button /
   * Ctrl+C), so a surface can show "stopped" rather than "failed". `waiting` marks a
   * run that ended on a question and resumes when it is answered.
   */
  | { kind: 'end'; ok: boolean; stopped?: boolean; waiting?: boolean; detail?: string }
