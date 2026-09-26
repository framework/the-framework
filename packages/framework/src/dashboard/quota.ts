import { QuotaPoller } from '../quota-poller.js'
import { quotaBoundaryStatus, type QuotaBoundaryStatus } from '../quota-boundary.js'
import { ClaudeCodeDriver } from '@agent-driver/claude'
import type { DriverQuotaUnavailableReason, DriverQuotaWindow } from 'agent-driver'
import { DEFAULT_SPEND_OFFSET } from '../preference-defaults.js'

/**
 * Everything the dashboard needs to draw the usage panel (#533): the account's
 * own windows, and where they stand against the quota boundary (#879).
 */
export interface QuotaView {
  /**
   * The account's quota windows as the agent reported them (session, week, and
   * a week per model). Empty when we have no reading at all — check
   * {@link unavailable} before reading that as "nothing used".
   */
  windows: DriverQuotaWindow[]
  /** When the reading was taken, epoch ms. Absent when there has never been one. */
  readAt?: number
  /**
   * Why there is no reading, when there isn't one. Present alongside stale
   * `windows` too: the last good reading is kept through a blip, and this says
   * the newest attempt failed, so the UI can mark it stale rather than blank it.
   */
  unavailable?: DriverQuotaUnavailableReason
  /**
   * Where the account stands against its boundary (#879). Absent when there is no
   * reading, or when the week's reset could not be placed — which is "we don't
   * know", not "nothing is allowed".
   */
  boundary?: QuotaBoundaryStatus
}

/** Where a dashboard reads the quota from. */
export interface QuotaSource {
  read(): Promise<QuotaView>
  /** Stop any polling behind it. */
  stop(): void
}

/**
 * A {@link QuotaSource} backed by a live poller.
 *
 * The boundary is measured per read rather than captured: it moves with the clock, so a cached
 * one would be stale the moment the week's day rolls over. A read costs no reading of the
 * account: the poller's last good windows are measured again.
 *
 * The panel's boundary names no model on purpose: the bar is about the account (#879/#1619).
 */
export function pollerQuotaSource(
  poller: QuotaPoller,
  now: () => number = () => Date.now(),
  /** The slider's position, read per call so moving it shows without a restart (#960). */
  limitOffset: () => number | Promise<number> = () => DEFAULT_SPEND_OFFSET,
): QuotaSource {
  const measure = async () => {
    const windows = poller.current().lastGood?.windows ?? []
    return quotaBoundaryStatus({ windows, now: now(), limitOffset: await limitOffset() })
  }
  return {
    stop: () => poller.stop(),
    read: async () => {
      const envelope = poller.current()
      const windows = envelope.lastGood?.windows ?? []
      const boundary = await measure()
      const view: QuotaView = {
        windows,
        ...(boundary ? { boundary } : {}),
        ...(envelope.lastGoodAt !== undefined ? { readAt: envelope.lastGoodAt } : {}),
        ...(envelope.latest && !envelope.latest.available ? { unavailable: envelope.latest.reason } : {}),
      }
      return view
    },
  }
}

/**
 * The daemon's own quota source: it polls for the whole life of the dashboard,
 * not just during an agent, because the panel has to show where the account stands
 * even when nothing is running.
 *
 * Separate from the reading an agent takes for itself: that one dies with the agent, and
 * nothing stops a running agent over quota anyway. This one exists to draw the bar and the line
 * unattended work stops at. That line is the schedulers' own spend offset, which `spendOffset`
 * reads off their state files (#960): the scheduler is what obeys it, so the bar draws what it
 * obeys. None named, or none readable, is the default cushion, which is the schedulers' default too.
 */
export function defaultQuotaSource(spendOffset: () => Promise<number | undefined>): QuotaSource {
  const driver = new ClaudeCodeDriver()
  const poller = new QuotaPoller({ read: () => driver.readQuota() })
  poller.start()
  return pollerQuotaSource(poller, undefined, async () => (await spendOffset().catch(() => undefined)) ?? DEFAULT_SPEND_OFFSET)
}
