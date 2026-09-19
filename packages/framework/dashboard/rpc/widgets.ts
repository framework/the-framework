import type * as impl from '../../src/dashboard-rpc/widgets.js'
import { rpc } from '../lib/rpc.js'

// The types the RPCs speak in, straight from the implementations — erased at build, so importing
// them here pulls no server code into the bundle.
export type * from '../../src/dashboard-rpc/widgets.js'

// Typed stubs for the `widgets` RPCs (#1774): which widgets the registered projects bring, and a
// widget running its own package's command in one project.
export const onWidgets = rpc<typeof impl.onWidgets>('onWidgets')
export const runWidgetCommand = rpc<typeof impl.runWidgetCommand>('runWidgetCommand')
