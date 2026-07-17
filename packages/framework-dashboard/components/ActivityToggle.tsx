import { Activity } from 'lucide-react'
import { usePreferences, updatePreferences, newActivityEnabled } from '../lib/preferences.js'
import { cn } from '../lib/utils.js'

// The "New activity" toggle in the shell header (#627), beside the browser bell and Discord toggle.
// Those two are the *methods* (where a notification goes); this is a *category* (what is worth one).
// Default off: it adds run started/finished pings on top of the always-on "needs you" notifications,
// and rides whichever methods are on — so with the bell on you get them in the browser, and with
// Discord on they reach you there too.
export function ActivityToggle() {
  const preferences = usePreferences()
  const enabled = newActivityEnabled(preferences)
  const title = enabled
    ? 'New-activity notifications on — click to mute (pings when a run starts or finishes)'
    : 'New-activity notifications off — click to turn on (pings when a run starts or finishes)'

  return (
    <button
      type="button"
      onClick={() => updatePreferences({ notifyNewActivity: !enabled })}
      title={title}
      aria-label={title}
      aria-pressed={enabled}
      className={cn('rounded-md p-1.5 hover:bg-accent', enabled ? 'text-foreground' : 'text-muted-foreground')}
    >
      <Activity className="h-4 w-4" />
    </button>
  )
}
