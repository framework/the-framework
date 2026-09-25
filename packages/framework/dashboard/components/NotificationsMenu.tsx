import { Bell, BellOff } from 'lucide-react'
import { useNotificationPermission } from '../lib/notification-permission.js'
import { usePreferences, updatePreferences, notificationsEnabled, newActivityEnabled, humanInterventionEnabled } from '../lib/preferences.js'
import { cn } from '../lib/utils.js'
import { OptionLabel } from './ui/option-label.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from './ui/dropdown-menu.js'

// One "Notifications" bell in the sidebar's utility footer (#676). It makes the model legible:
// the browser is the *delivery method* (where a notification goes), "Human Queue" and "New
// activity" are the *categories* (what it is about). The trigger shows an active state + dot when
// browser delivery is effectively on; the popover groups and labels every toggle. This is purely
// the control that writes the preferences.

export function NotificationsMenu() {
  const preferences = usePreferences()
  const browser = notificationsEnabled(preferences)
  const activity = newActivityEnabled(preferences)
  const needsYou = humanInterventionEnabled(preferences)
  const permission = useNotificationPermission()
  const browserSupported = permission !== 'unsupported'
  const blocked = permission === 'denied'
  // Browser delivery only actually fires once the browser has granted permission. "Active"
  // drives the bell + dot.
  const active = browser && permission === 'granted'

  const toggleBrowser = (next: boolean) => {
    updatePreferences({ notifyBrowser: next })
    // Asking for permission must ride this user gesture (turning it on).
    if (next && permission === 'default') void Notification.requestPermission()
  }

  const browserHint = blocked
    ? 'Blocked in your browser settings'
    : browser && permission === 'default'
      ? 'Click to allow browser notifications'
      : 'Desktop notifications while the dashboard is open'

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              type="button"
              aria-label="Notifications"
              className={cn(
                'relative rounded-md p-1.5 hover:bg-accent',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
            />
          }
        >
          {active ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          {active && (
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />
          )}
        </TooltipTrigger>
        <TooltipContent>{active ? 'Notifications on' : 'Notifications'}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-[16rem]">
        {browserSupported && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Deliver to</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={browser}
                disabled={blocked}
                onCheckedChange={toggleBrowser}
                className="items-start"
              >
                <OptionLabel label="Browser" description={browserHint} />
              </DropdownMenuCheckboxItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Notify me about</DropdownMenuLabel>
          {/* "Needs you" (#627): a run awaiting an answer or a PR ready to review. Defaults on — the
              baseline category — but now a real toggle, so it can be turned off like any other. */}
          <DropdownMenuCheckboxItem
            checked={needsYou}
            onCheckedChange={next => updatePreferences({ notifyHumanIntervention: next })}
            className="items-start"
          >
            <OptionLabel label="Human Queue" description="An agent awaiting you, or a PR to review" />
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={activity}
            onCheckedChange={next => updatePreferences({ notifyNewActivity: next })}
            className="items-start"
          >
            <OptionLabel label="New activity" description="An agent started or finished" />
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
