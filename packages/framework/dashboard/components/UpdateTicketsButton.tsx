import { RefreshCw } from 'lucide-react'
import { presets } from '../../src/client.js'
import { StartAgentButton } from './StartAgentButton.js'

/**
 * The prompt behind "Update from GitHub" (#1208), read from the preset rather than written here:
 * every surface offers the same button under the same label, and one label must mean one
 * instruction wherever it is pressed (#697's lesson, when two surfaces sent different texts behind
 * the same words).
 *
 * The one GitHub sync since #1501: the preset's own empty branch treats a bare `tickets/` as the
 * first import, so the separate import preset could go.
 */
export const UPDATE_TICKETS_PROMPT = presets.updateTickets.render()

/**
 * "Update from GitHub", as one button all three surfaces render: the tickets panel's header and
 * its empty state, and the onboarding checklist. The label, the prompt behind it, and what the
 * tooltip promises were written out per surface, which is the same drift the shared prompt exists
 * to prevent — one wording change and two of the three would still say the old thing.
 */
export function UpdateTicketsButton({
  busy,
  onStart,
  onConfigure,
  lastImportedAt,
  disabled,
  variant,
  size = 'sm',
  className,
}: {
  busy: boolean
  onStart: () => void
  /** Open the launcher with this prompt instead of spending a session on it. */
  onConfigure: () => void
  /** When tickets last came across, so the tooltip can promise the incremental update (#1265). */
  lastImportedAt?: string | undefined
  disabled?: boolean | undefined
  variant?: 'default' | 'outline' | undefined
  size?: 'xs' | 'sm' | undefined
  className?: string | undefined
}) {
  return (
    <StartAgentButton
      {...(variant ? { variant } : {})}
      size={size}
      {...(disabled !== undefined ? { disabled } : {})}
      {...(className ? { className } : {})}
      icon={<RefreshCw className="h-3.5 w-3.5" aria-hidden />}
      label="Update from GitHub"
      menuAriaLabel="Other ways to update from GitHub"
      tooltip={
        lastImportedAt
          ? 'Bring tickets/ up to date with the issues and comments changed since the last import.'
          : 'Bring tickets/ up to date with GitHub. With no import on record, everything open comes across.'
      }
      busy={busy}
      starting={busy}
      onStart={onStart}
      onConfigure={onConfigure}
      prompt={UPDATE_TICKETS_PROMPT}
      configureDescription="Opens the launcher with the update prompt, so you can set the model and where it runs."
    />
  )
}
