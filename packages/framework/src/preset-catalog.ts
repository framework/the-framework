import { definePreset, type PresetDef } from './preset-prompt.js'
import {
  PRESETS_MAINTAINABILITY,
  PRESETS_MAINTENANCE,
  PRESETS_MARKET_RESEARCH,
  PRESETS_PLAN_TICKETS,
  PRESETS_READABILITY,
  PRESETS_RESEARCH,
  PRESETS_SECURITY_AUDIT,
  PRESETS_SUGGEST_NEW_FEATURES,
  PRESETS_SUGGEST_NEW_TICKETS,
  PRESETS_SUGGEST_TICKETS_TO_WORK_ON,
  PRESETS_TRIAGE_CONSENSUAL,
  PRESETS_TRIAGE_QUICK,
  PRESETS_UPDATE_TICKETS,
  PRESETS_UX,
  TRIAGE_SCOPE,
} from './prompts.generated.js'

/**
 * Every preset, in one table.
 *
 * Each of these used to be a file of its own whose whole body was one `definePreset` call (or a
 * hand-rolled equivalent) plus four alias exports — 56 exported names for 14 objects, with the
 * same four doc comments copied down the directory. What actually varies between them is two or
 * three values, which is what a row is.
 *
 * The prompt text itself is not here: it ships in `prompts/presets/<stem>.md` and reaches this
 * table through the generated constants, so a prompt is edited as prose in one place.
 *
 * Pure by construction (no `node:*`), so the dashboard can render any preset in the browser (#520).
 */
/** A triage prompt, with the queue-only rule the pair shares (#1641) at the end. */
const triage = (template: string): string => `${template}\n\n${TRIAGE_SCOPE}`

export const presets = {
  /**
   * [Research] (#331): the problem-variability review, shipped as a direct prompt (see
   * `runPrompt`) rather than a build agent — research reviews existing code, so it skips the
   * scope -> build scaffolding. `showMultiSelect()` + `<AWAIT>` becomes a live turn-boundary
   * gate (#339/#340) the dashboard resolves.
   */
  research: definePreset({ name: 'research', template: PRESETS_RESEARCH, what: 'What to measure problem variability of', label: 'Research' }),

  /**
   * [Maintainability] (#361): deliberately minimal, so its performance can be judged before a
   * more explicit prompt is written. Keep it in sync with the issue rather than growing it here.
   */
  maintainability: definePreset({ name: 'maintainability', template: PRESETS_MAINTAINABILITY, what: 'What to refactor for maintainability', label: 'Maintainability' }),

  /** [Readability] (#360): the reader's-eye pass — seams, altitude, and one commit per refactor. */
  readability: definePreset({ name: 'readability', template: PRESETS_READABILITY, what: 'What to refactor for readability', label: 'Readability' }),

  /** [Security audit] (#461). */
  securityAudit: definePreset({ name: 'security-audit', template: PRESETS_SECURITY_AUDIT, what: 'What to security-audit', label: 'Security audit' }),

  /**
   * [UX (auto)] (#962, replacing #472's gated prompt): rate every UI flow, then fix the low
   * scorers. Unattended by design — it ends in work rather than in `<AWAIT>`, so an agent started
   * from it finishes on its own. A gated sibling that offers its ratings as choices is #962's
   * stated follow-up and belongs beside this row, not inside it.
   */
  ux: definePreset({ name: 'ux', template: PRESETS_UX, what: 'What to review the UX of', label: 'UX (auto)' }),

  /**
   * [Maintenance] (#881/#882): the periodic codebase sweep. Note `${{ }}` fragments cannot nest (the
   * scanner stops at the first `}}`), which is why its target is a plain blank.
   */
  maintenance: definePreset({ name: 'maintenance', template: PRESETS_MAINTENANCE, what: 'What to analyze for refactor opportunities', label: 'Maintenance', tooltip: 'Queue maintainability + security work per codebase subset (TODO_AGENTS.md)' }),

  // ---- Paramless: each of these scopes itself to the repo's own tickets, plans or queue, so
  // there is no blank for a user to fill.

  /**
   * [Market research] (#694). Its prompt defines `<SESSION_NAME>` itself rather than reading
   * `${{ tf.session_name }}`: it is launched from the launcher, where no session exists yet.
   */
  marketResearch: definePreset({ name: 'market-research', template: PRESETS_MARKET_RESEARCH, label: 'Market research' }),

  /**
   * [Update from GitHub] (#1208, #1501): the one GitHub sync. It resumes from the
   * `lastImportedAt` in `tickets/meta.json` and reconciles rather than refilling — an existing
   * ticket is edited in place, keeping the `.plan.md` written against it, and a
   * closed issue's ticket goes. An empty `tickets/` is its first-import branch: every open issue
   * comes across, which is why the separate import preset could go (#1501).
   *
   * The timestamp is read by the agent out of the repo rather than rendered into the prompt: the
   * file travels in the same commit as the tickets it describes, so an agent whose work never landed
   * cannot leave behind a stamp claiming those issues were imported.
   *
   * Marked {@link PresetSpec.newAgent}: syncing is repo work, not a reply, so it opens its own
   * session rather than appending to whichever one the user happens to be reading.
   */
  updateTickets: definePreset({ name: 'update-tickets', template: PRESETS_UPDATE_TICKETS, label: 'Update from GitHub', newAgent: true, tooltip: 'Bring `tickets/` up to date with the GitHub issues. An empty `tickets/` gets a full first import.' }),

  /** [Plan tickets] (#685): turn tickets into costed plans. */
  planTickets: definePreset({ name: 'plan-tickets', template: PRESETS_PLAN_TICKETS, label: 'Plan tickets (aka spike)', tooltip: 'Turn `tickets/*.md` into costed plans (`tickets/*.plan.md`)' }),

  /** [Suggest new tickets] (#462/#683): the dashboard prefills this one line and the user edits it freely. */
  suggestNewTickets: definePreset({ name: 'suggest-new-tickets', template: PRESETS_SUGGEST_NEW_TICKETS, label: 'Suggest new tickets' }),

  /**
   * [Suggest new features] (#1109): the product-inward, generative corner of the PM cluster. It
   * studies what the product does today and proposes net-new features as tickets in `tickets/`.
   * Distinct from its neighbours: `suggestNewTickets` echoes a line the human types,
   * `marketResearch` looks outward at the market, and `suggestTicketsToWorkOn` picks from tickets
   * that already exist. Autonomous rather than gated — a proposal is a reviewable ticket, so the
   * human triages later instead of approving mid-run, which also keeps it usable unattended.
   */
  suggestNewFeatures: definePreset({ name: 'suggest-new-features', template: PRESETS_SUGGEST_NEW_FEATURES, label: 'Suggest new features', tooltip: 'Propose net-new features as tickets in `tickets/`' }),

  /**
   * [Suggest tickets to work on] (#698): the gated sibling of the triage pair. It ends in
   * `<AWAIT>`, so it must not be fired unattended — that would wedge an agent against a human
   * who is not there.
   */
  suggestTicketsToWorkOn: definePreset({ name: 'suggest-tickets-to-work-on', template: PRESETS_SUGGEST_TICKETS_TO_WORK_ON, label: 'Suggest tickets to work on', tooltip: 'Add tickets to queue (TODO_AGENTS.md)' }),

  /**
   * [Do quick-win work] (#891) and [Do consensual work] (#892): read `tickets/*.md`, pick the ones
   * matching one filter, and append them to `TODO_AGENTS.md` — how the queue refills itself from
   * the ticket backlog. The pair splits on cost, and the split is the point: both are consensual
   * (zero open questions, zero variability), so neither needs a human, and they differ only in
   * whether the work is cheap. Keeping them apart lets a person queue the cheap batch and the
   * significant batch separately rather than in one indiscriminate sweep.
   *
   * Each prompt pins its own `<SESSION_NAME>`, so a triage always lands on the same branch and is
   * recognizable there.
   *
   * Both end with the same rule (#1641): a triage only writes `TODO_AGENTS.md`, never a ticket's
   * code. It is one file, `prompts/triage_scope.md`, appended here rather than pasted into each
   * preset, so the pair cannot drift apart on it.
   */
  triageQuick: definePreset({ name: 'triage-quick', template: triage(PRESETS_TRIAGE_QUICK), label: 'Add quick-win work to AI Queue', tooltip: 'Add `tickets/*.md` to queue (TODO_AGENTS.md), only quick-win and consensual tickets' }),
  triageConsensual: definePreset({ name: 'triage-consensual', template: triage(PRESETS_TRIAGE_CONSENSUAL), label: 'Add consensual work to AI Queue', tooltip: 'Add `tickets/*.md` to queue (TODO_AGENTS.md), only significant (no quick-wins) and consensual tickets' }),
} as const satisfies Record<string, PresetDef>

/** The presets by key, e.g. `planTickets`. */
export type PresetKey = keyof typeof presets

/**
 * The presets the launcher offers, in the order it shows them.
 *
 * One list rather than a `launcher: true` flag on each row: membership and order are the same
 * decision, and a flag would have stated half of it while the order lived somewhere else. Every
 * preset is on it: working the agent queue is a skill file (#1774), not a preset.
 */
export const LAUNCHER_PRESETS: readonly PresetDef[] = [
  presets.research,
  presets.readability,
  presets.maintainability,
  presets.securityAudit,
  presets.ux,
  presets.suggestNewTickets,
  presets.suggestNewFeatures,
  presets.suggestTicketsToWorkOn,
  presets.planTickets,
  presets.marketResearch,
  presets.updateTickets,
  presets.maintenance,
  presets.triageQuick,
  presets.triageConsensual,
]
