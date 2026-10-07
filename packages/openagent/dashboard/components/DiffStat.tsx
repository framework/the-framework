import { cn } from '../lib/utils.js'

// A change's size as the `+12 −3` pair, the one way the dashboard says it: in a run's handoff and,
// through `@openagt/dashboard/module`, wherever a module shows a change.

/** Added/removed counts as the `+12 −3` pair. */
export function DiffStat({ added, removed, className }: { added: number; removed: number; className?: string }) {
  return (
    <span className={cn('shrink-0 font-mono text-[10px] tabular-nums', className)}>
      {added > 0 && <span className="text-success">+{added}</span>}
      {added > 0 && removed > 0 && ' '}
      {removed > 0 && <span className="text-danger">−{removed}</span>}
    </span>
  )
}
