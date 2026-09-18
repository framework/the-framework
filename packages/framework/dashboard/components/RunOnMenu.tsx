import { Check, Laptop, MonitorSmartphone, Plus, X } from 'lucide-react'
import type { ConnectionProfile } from '../lib/profiles.js'
import type { DeviceStatus } from '../lib/use-device-status.js'
import { cn } from '../lib/utils.js'
import { buttonVariants } from './ui/button.js'
import { OptionLabel } from './ui/option-label.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu.js'

/**
 * Where the next run starts (#1052/#1066/#1067): this machine, or a saved device. A device is a
 * run TARGET, selected in place: picking one does not navigate the browser. The local daemon
 * relays the start to it, and the device runs its own project's start hook. A device is not
 * persisted as a preference: its token is this browser's secret.
 */
export type ConnectionControl = {
  /** The saved remote daemons this browser can run on. */
  profiles: ConnectionProfile[]
  /** `window.location.origin`, to mark the daemon the dashboard is on now. */
  currentUrl: string | null
  /** Whether the current origin is loopback (this machine's own daemon). */
  isLocal: boolean
  /** The device selected as the run target (its profile id), or null when this machine is (#1067). */
  selectedDeviceId: string | null
  /** Select a saved device as the run target, with no navigation (#1067). */
  onSelect: (profile: ConnectionProfile) => void
  /** Clear the device selection back to this machine (#1067). */
  onSelectLocal: () => void
  /** Return to this machine's own daemon when currently on a remote one (#1066). */
  onConnectLocal: () => void
  onAddDevice: () => void
  /** Drop a saved device (#1072). The caller clears the selection if this was the run target. */
  onRemove: (profile: ConnectionProfile) => void
  /** Each device's online/offline status (#1072); an id absent from the map is still being checked. */
  status: Record<string, DeviceStatus>
}

/** A small reachability dot on a device row (#1072): green online, muted offline or still unknown. */
function StatusDot({ status }: { status: DeviceStatus | undefined }) {
  return <span aria-hidden className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', status === 'online' ? 'bg-success' : 'bg-muted-foreground/40')} />
}

// One flat "Run on" list (#1066/#1067): this machine, then the saved devices and "Add a device",
// with a single checkmark. When genuinely on a remote daemon (a manual connection), that device
// carries the mark, and "This machine" goes home.
export function RunOnMenu({ connection, busy }: { connection: ConnectionControl; busy: boolean }) {
  // The selected device (#1067), meaningful only on the local daemon; on a remote daemon the
  // connected device is the target instead. An id pointing at a removed device reads as none.
  const selectedDevice =
    connection.isLocal && connection.selectedDeviceId ? connection.profiles.find(p => p.id === connection.selectedDeviceId) : undefined
  const isTargetDevice = (profile: ConnectionProfile): boolean =>
    connection.isLocal ? selectedDevice?.id === profile.id : profile.url === connection.currentUrl
  const summary = !connection.isLocal
    ? (connection.profiles.find(p => p.url === connection.currentUrl)?.label ?? 'A device')
    : (selectedDevice?.label ?? 'This machine')
  const onThisMachine = connection.isLocal && !selectedDevice
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              type="button"
              disabled={busy}
              aria-label="Run on"
              className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'relative h-8 w-8')}
            />
          }
        >
          {onThisMachine ? <Laptop className="h-4 w-4" /> : <MonitorSmartphone className="h-4 w-4" />}
          {!onThisMachine && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--color-primary)]" />}
        </TooltipTrigger>
        <TooltipContent>{`Run on — ${summary}`}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-[19rem] max-w-[22rem]">
        <DropdownMenuItem
          className="items-start"
          onClick={() => (connection.isLocal ? connection.onSelectLocal() : connection.onConnectLocal())}
        >
          <Check className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', onThisMachine ? 'opacity-100' : 'opacity-0')} />
          <OptionLabel label="This machine" description="Start the run here, through this project's start hook." />
        </DropdownMenuItem>
        {/* Saved devices: a click SELECTS the device as the run target (no navigation). The dot
            shows reachability (#1072) and the X removes the saved device. */}
        {connection.profiles.map(profile => {
          const status = connection.status[profile.id]
          const offline = status === 'offline'
          return (
            <DropdownMenuItem key={profile.id} className={cn('items-start gap-2', offline && 'opacity-60')} onClick={() => connection.onSelect(profile)}>
              <Check className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', isTargetDevice(profile) ? 'opacity-100' : 'opacity-0')} />
              <MonitorSmartphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <StatusDot status={status} />
              <OptionLabel label={profile.label} description={offline ? `${profile.url} (offline)` : profile.url} />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={e => {
                        // Remove, not select: keep the row's own click out of it (#1072).
                        e.stopPropagation()
                        connection.onRemove(profile)
                      }}
                      aria-label={`Remove device ${profile.label}`}
                      className="mt-0.5 rounded p-0.5 text-[var(--color-muted-foreground)] hover:text-danger"
                    />
                  }
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </TooltipTrigger>
                <TooltipContent>Remove {profile.label}</TooltipContent>
              </Tooltip>
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuItem className="items-start" disabled={busy} onClick={() => connection.onAddDevice()}>
          <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <OptionLabel label="Add a device…" description="Paste the URL a box prints on its network bind." />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
