import { fireEvent, screen } from '@testing-library/react'

/**
 * Hover a tooltip trigger and hand back the tooltip it opens (#1149).
 *
 * Every hint in the dashboard is the custom tooltip now, so a test that used to read a `title`
 * attribute off an element has to hover like a user instead: Base UI opens on `mouseenter` +
 * a move, and portals the popup out of the trigger's subtree.
 */
export async function hoverTooltip(trigger: Element): Promise<HTMLElement> {
  fireEvent.mouseEnter(trigger)
  fireEvent.mouseMove(trigger)
  return await screen.findByRole('tooltip')
}

/** Move off a trigger, so the next {@link hoverTooltip} is the only tooltip open. */
export function unhoverTooltip(trigger: Element): void {
  fireEvent.mouseLeave(trigger)
}
