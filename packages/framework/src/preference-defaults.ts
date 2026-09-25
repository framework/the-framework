import type { Preferences } from './registry.js'

/**
 * What an unset preference means, and the bounds the controls that write them share.
 *
 * A leaf module (no `node:*`) so `client.ts` can export it and the dashboard reads the same values
 * the daemon acts on.
 *
 * No cycle: `registry.ts` re-exports the bounds from here, and the `Preferences` import going the
 * other way is type-only, so it erases.
 */

/**
 * Notifications have two axes (B5): `notifyBrowser` says whether they reach you in the browser at
 * all, and `notifyHumanIntervention` / `notifyNewActivity` say *what* they are about. A category
 * delivers only while the browser switch is on too.
 */

/** What a notification is about. */
export type NotifyCategory = 'humanIntervention' | 'newActivity'

/** The preference key each category is stored under. */
const CATEGORY_KEYS = {
  humanIntervention: 'notifyHumanIntervention',
  newActivity: 'notifyNewActivity',
} as const satisfies Record<NotifyCategory, keyof Preferences>

/**
 * What each switch means when nobody has said.
 *
 * The polarities are not uniform, and that is the point of writing them down once: browser
 * delivery and the "needs you" category fire unless you turn them off, while plain activity is
 * opt-in.
 */
export const NOTIFICATION_DEFAULTS = {
  browser: true,
  categories: { humanIntervention: true, newActivity: false },
} as const satisfies { browser: boolean; categories: Record<NotifyCategory, boolean> }

/** Whether browser delivery is switched on, with its default applied. */
export function browserNotifyEnabled(preferences: Preferences): boolean {
  return preferences.notifyBrowser ?? NOTIFICATION_DEFAULTS.browser
}

/** Whether a category is switched on, with its default applied. */
export function notifyCategoryEnabled(preferences: Preferences, category: NotifyCategory): boolean {
  return preferences[CATEGORY_KEYS[category]] ?? NOTIFICATION_DEFAULTS.categories[category]
}

/** Whether a category delivers: both browser delivery and the category have to be on. */
export function notifies(preferences: Preferences, category: NotifyCategory): boolean {
  return browserNotifyEnabled(preferences) && notifyCategoryEnabled(preferences, category)
}

/**
 * How far either way the automatic-consumption slider reaches, in percentage points (#960).
 *
 * Here because the browser clamps to it, in the usage panel's slider and in Settings, and the
 * daemon's quota source falls back to the default below: one number both sides import.
 */
export const MAX_SPEND_OFFSET = 50

/**
 * Where the slider sits before anyone has touched it, in percentage points (#960 Edit): half a
 * day's worth of the week's allowance, ahead of the boundary.
 *
 * Landing exactly on the boundary reads as generous on paper but stops unattended work the moment
 * the account is precisely on pace, which is normal jitter rather than overspending. A half-day
 * cushion gives it room to breathe without meaningfully loosening the spend-boundary policy (#879).
 */
export const DEFAULT_SPEND_OFFSET = 100 / (7 * 2)
