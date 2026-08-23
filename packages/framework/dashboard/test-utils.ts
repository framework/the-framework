import { fireEvent, screen, waitFor } from '@testing-library/react'

/**
 * Hover a tooltip trigger and hand back the tooltip it opens (#1149).
 *
 * Every hint in the dashboard is the custom tooltip now, so a test that used to read a `title`
 * attribute off an element has to hover like a user instead: Base UI opens on `mouseenter` +
 * a move, and portals the popup out of the trigger's subtree.
 */
export async function hoverTooltip(trigger: Element): Promise<HTMLElement> {
  // Re-fire the hover pair on every retry rather than once up front (#1398): a pair dispatched
  // before the trigger's listeners are attached opens nothing, and a single findByRole then
  // waits out its timeout on a tooltip that will never come ("Unable to find role=tooltip" on a
  // loaded CI runner, fine locally). Repeating the events is idempotent for a hover.
  return await waitFor(
    () => {
      fireEvent.mouseEnter(trigger)
      fireEvent.mouseMove(trigger)
      return screen.getByRole('tooltip')
    },
    { timeout: 5000 },
  )
}

/** Move off a trigger, so the next {@link hoverTooltip} is the only tooltip open. */
export function unhoverTooltip(trigger: Element): void {
  fireEvent.mouseLeave(trigger)
}
