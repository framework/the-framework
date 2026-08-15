import type { Preferences } from './registry.js'

/**
 * Which preference keys a project may override, and what an unset notification preference means.
 *
 * A leaf module (no `node:*`) so `client.ts` can export it and the dashboard reads the same values
 * the daemon acts on. Both were previously written on both sides of the package boundary with
 * nothing tying them together:
 *
 * - the key list was a second `Set<string>` in the dashboard, which erased the type link — adding a
 *   key here type-checked clean while the dashboard silently routed it to the global tier;
 * - the notification defaults were named predicates in the dashboard and open-coded at each daemon
 *   call site, in three different spellings, with a comment warning the reader not to copy the
 *   sibling's polarity. That warning is what a default with one home does not need.
 *
 * No cycle: `registry.ts` re-exports the key list from here, and the `Preferences` import going the
 * other way is type-only, so it erases.
 */

/**
 * The preference keys a project may override (#840).
 *
 * These are the *user's* per-project choices, not the repo's: they live in the user's home file
 * rather than the committed `the-framework.yml` because `model` and `agent` name what this machine
 * runs, which is not something to impose on everyone who clones the repo.
 */
export const PROJECT_PREFERENCE_KEYS = [
  'vanilla',
  'onBeforeMergeableQuality',
  'browser',
  // Per-project by nature (#1102): whether a session should publish itself is a fact about the
  // repo, not about the machine. A scratch repo wants it on; someone else's repo you have push
  // rights to may well not.
  'autoPushBranch',
  'autoOpenPr',
  // Per-project for the same #1102 reason, and then some (#1216): whether a repo lets sessions
  // land their own PRs is the sharpest per-repo call there is.
  'autoMerge',
  'transparent',
  'model',
  'agent',
  'target',
] as const

/** What one project overrides: a subset of {@link Preferences}, storing only the keys it sets. */
export type ProjectPreferences = Pick<Preferences, (typeof PROJECT_PREFERENCE_KEYS)[number]>

/**
 * Notifications are a 2×2, and naming the axes is the point (B5).
 *
 * There are four preference keys and they are not four settings: `notifyBrowser` and
 * `notifyDiscord` say *how* a notification reaches you, `notifyHumanIntervention` and
 * `notifyNewActivity` say *what it is about*. Nothing in the names said which axis a key belonged
 * to, and the composition ("deliver this category by this method") was open-coded per call site —
 * which is how one of them got the category's polarity wrong by copying its sibling. The axes are
 * named here so a caller asks the one question it actually has.
 *
 * The stored keys are unchanged: a settings file written before this still reads.
 */

/** How a notification reaches you. */
export type NotifyMethod = 'browser' | 'discord'

/** What a notification is about. */
export type NotifyCategory = 'humanIntervention' | 'newActivity'

/** The preference key each axis value is stored under. */
const METHOD_KEYS = { browser: 'notifyBrowser', discord: 'notifyDiscord' } as const satisfies Record<NotifyMethod, keyof Preferences>
const CATEGORY_KEYS = {
  humanIntervention: 'notifyHumanIntervention',
  newActivity: 'notifyNewActivity',
} as const satisfies Record<NotifyCategory, keyof Preferences>

/**
 * What each cell means when nobody has said.
 *
 * The polarities are not uniform, and that is the point of writing them down once: the browser
 * bell and the "needs you" baseline fire unless you turn them off, while everything that reaches
 * outward (Discord) or is loosely informative (plain activity) is opt-in.
 */
export const NOTIFICATION_DEFAULTS = {
  methods: { browser: true, discord: false },
  categories: { humanIntervention: true, newActivity: false },
} as const satisfies { methods: Record<NotifyMethod, boolean>; categories: Record<NotifyCategory, boolean> }

/** Whether a delivery method is switched on, with its default applied. */
export function notifyMethodEnabled(preferences: Preferences, method: NotifyMethod): boolean {
  return preferences[METHOD_KEYS[method]] ?? NOTIFICATION_DEFAULTS.methods[method]
}

/** Whether a category is switched on, with its default applied. */
export function notifyCategoryEnabled(preferences: Preferences, category: NotifyCategory): boolean {
  return preferences[CATEGORY_KEYS[category]] ?? NOTIFICATION_DEFAULTS.categories[category]
}

/**
 * Whether this cell of the 2×2 delivers: both the method and the category have to be on.
 *
 * One function rather than an `&&` at each call site — that open-coding is exactly what let a
 * category's polarity be wrong in one place and right in another.
 */
export function notifies(preferences: Preferences, method: NotifyMethod, category: NotifyCategory): boolean {
  return notifyMethodEnabled(preferences, method) && notifyCategoryEnabled(preferences, category)
}

/**
 * How far either way the automatic-consumption slider reaches, in percentage points (#960).
 *
 * Here rather than in `registry.ts` for the reason this module exists: the slider that writes the
 * value is in the browser and the sanitizer that clamps it is in the daemon, so the bound has to
 * be one number both can import.
 */
export const MAX_SPEND_OFFSET = 50

/**
 * Where the slider sits before anyone has touched it, in percentage points (#960 Edit): half a
 * day's worth of the week's allowance, ahead of the boundary.
 *
 * Landing exactly on the boundary reads as generous on paper but stops unattended work the moment
 * the account is precisely on pace, which is normal jitter rather than overspending. A half-day
 * cushion gives it room to breathe without meaningfully loosening the #879 policy.
 */
export const DEFAULT_SPEND_OFFSET = 100 / (7 * 2)

/**
 * How many agents the routine keeps going at once when `autoPmConcurrency` is unset (#1204).
 *
 * Two, not one: the point of the setting is that the routine may overlap work, and a default of
 * one would leave the feature invisible until someone finds the control. Two is the smallest
 * number that shows it while staying conservative about quota.
 */
export const DEFAULT_AUTO_PM_CONCURRENCY = 2

/**
 * The most agents the routine may be asked to keep going at once (#1204). Like
 * {@link MAX_SPEND_OFFSET}, the control that writes the value is in the browser and the sanitizer
 * that clamps it is in the daemon, so the bound has to be one number both can import.
 */
export const MAX_AUTO_PM_CONCURRENCY = 10
