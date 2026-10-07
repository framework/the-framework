import type { ReactNode } from 'react'

// The look of a chip in the launcher's row above the box: small, bordered, rounded, muted text.
// A class as well as a component, so a menu's button can be drawn as a chip too.
// min-w-0 and overflow-hidden: in a full row a chip gives way, and its label is cut short.
export const chipClass =
  'inline-flex h-6 min-w-0 max-w-full items-center gap-1 overflow-hidden rounded-full border border-[var(--color-border)] px-2 text-xs text-muted-foreground'

/** A plain chip: an icon and a few words that say one thing. Not a button. */
export function Chip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className={chipClass}>
      {icon}
      <span className="truncate">{children}</span>
    </span>
  )
}
