import type { ReactNode } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '../lib/utils.js'
import { NO_MODEL_PINNED } from '../lib/agent-settings.js'
import { buttonVariants } from './ui/button.js'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.js'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from './ui/dropdown-menu.js'

// The agent's driver + model as one tree (#650/#656/#658): the top level is the coding drivers, and
// each driver's submenu holds only its own models. Picking a model sets both the driver and the
// model together, so an incompatible pair (e.g. Codex + a Claude model) can't be chosen. The
// trigger shows the current driver's logo then the model.

export interface ModelOption {
  value: string
  label: string
}

export interface DriverOption {
  value: string
  label: string
  /** The driver's logo, shown on the trigger and beside its name (#656). */
  icon?: ReactNode
  /** The models this driver offers. Every entry is a real model id — none of them means "unset". */
  models: ModelOption[]
  /** Why {@link models} is empty, said in its place: the agent is still being asked, or could not say. */
  modelsNote?: string
}

function driverOf(drivers: DriverOption[], value: string): DriverOption | undefined {
  return drivers.find(a => a.value === value) ?? drivers[0]
}

/**
 * The label for the current model: its name in the driver's own list, the id itself for a model
 * the list does not hold (the run is still given it, so the trigger says what is sent), or
 * `undefined` when nothing is pinned.
 *
 * Deliberately *not* falling back to the first model (#1143). The list used to open with a
 * "Default" entry storing an empty value, and the fallback made that entry's label the answer to
 * "which model is this". Dropping the entry without dropping the fallback would be worse than
 * either: the trigger would name a model the agent does not actually pass.
 */
function modelLabel(driver: DriverOption | undefined, model: string): string | undefined {
  if (!model) return undefined
  return driver?.models.find(m => m.value === model)?.label ?? model
}

export function DriverModelMenu({
  drivers,
  driver,
  model,
  onChange,
  busy,
}: {
  drivers: DriverOption[]
  driver: string
  model: string
  /** Set the driver and model together (a model is always picked within its driver). */
  onChange: (driver: string, model: string) => void
  busy: boolean
}) {
  const current = driverOf(drivers, driver)
  const currentModelLabel = modelLabel(current, model)
  // Spelled out rather than left to the rendered text (#1143): with no model pinned the trigger is
  // a logo and a chevron, which names nothing at all to a screen reader. It used to read as the
  // model label by accident, and that label was "Default".
  const said = `Driver: ${current?.label ?? ''} · Model: ${currentModelLabel ?? NO_MODEL_PINNED}`
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              type="button"
              disabled={busy}
              aria-label={said}
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5 px-2 font-normal')}
            />
          }
        >
          {current?.icon ? (
            <span className="flex h-4 w-4 items-center justify-center">{current.icon}</span>
          ) : (
            current?.label
          )}
          {currentModelLabel}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </TooltipTrigger>
        <TooltipContent>{said}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        {drivers.map(a => (
          <DropdownMenuSub key={a.value}>
            <DropdownMenuSubTrigger>
              <Check className={cn('h-3.5 w-3.5 shrink-0', a.value === driver ? 'opacity-100' : 'opacity-0')} />
              {a.icon && <span className="flex h-4 w-4 items-center justify-center">{a.icon}</span>}
              <span className="flex-1">{a.label}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {a.models.length === 0 && a.modelsNote && <DropdownMenuItem disabled>{a.modelsNote}</DropdownMenuItem>}
              {a.models.map(m => (
                <DropdownMenuItem key={m.value} onClick={() => onChange(a.value, m.value)}>
                  <Check
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      a.value === driver && m.value === model ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {m.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
