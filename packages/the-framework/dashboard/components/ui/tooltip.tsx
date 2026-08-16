'use client'
import type { ComponentProps } from 'react'
import { Tooltip as TooltipPrimitive } from '@base-ui-components/react/tooltip'
import { cn } from '../../lib/utils.js'

// A trimmed shadcn-style Tooltip on Base UI (already a dep via animate-ui — no Radix pulled
// in). Per item:
//   <Tooltip><TooltipTrigger render={<Button …/>}>…</TooltipTrigger><TooltipContent>Label</TooltipContent></Tooltip>
const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root

// Tooltips open instantly (#1149). Base UI reads the delay off the trigger, and an explicit
// trigger delay beats any <TooltipProvider>, so this one default governs every tooltip; no
// provider is needed anywhere.
function TooltipTrigger(props: ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger delay={0} {...props} />
}

function TooltipContent({
  className,
  sideOffset = 6,
  side,
  align,
  children,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Popup> & {
  sideOffset?: number
  side?: ComponentProps<typeof TooltipPrimitive.Positioner>['side']
  align?: ComponentProps<typeof TooltipPrimitive.Positioner>['align']
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        sideOffset={sideOffset}
        {...(side ? { side } : {})}
        {...(align ? { align } : {})}
      >
        <TooltipPrimitive.Popup
          // Base UI leaves the popup unlabelled (it treats a tooltip as a supplement to the
          // trigger's own accessible name, which every trigger here has). The role costs nothing
          // and names the popup for assistive tech and for tests, which is how they read it now
          // that no element carries a `title`.
          role="tooltip"
          className={cn(
            'z-50 rounded-md border border-border bg-card px-2 py-1 text-xs text-card-foreground shadow-md',
            className,
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
