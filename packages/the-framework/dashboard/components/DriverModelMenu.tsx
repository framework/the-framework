import type { ReactNode } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '../lib/utils.js'
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

// The run's driver + model as one tree (#650/#656/#658): the top level is the coding drivers, and
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
  /** The models this driver offers; the first is its default. */
  models: ModelOption[]
}

function driverOf(drivers: DriverOption[], value: string): DriverOption | undefined {
  return drivers.find(a => a.value === value) ?? drivers[0]
}

/** The label for the current model within an driver's own list, falling back to its default. */
function modelLabel(driver: DriverOption | undefined, model: string): string {
  if (!driver) return ''
  return (driver.models.find(m => m.value === model) ?? driver.models[0])?.label ?? ''
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
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              type="button"
              disabled={busy}
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
        <TooltipContent>{`Agent: ${current?.label ?? ''} · Model: ${currentModelLabel}`}</TooltipContent>
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
