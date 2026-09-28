import type * as impl from '../../src/dashboard-rpc/modules.js'
import { rpc } from '../lib/rpc.js'

// The types the RPCs speak in, straight from the implementations — erased at build, so importing
// them here pulls no server code into the bundle.
export type * from '../../src/dashboard-rpc/modules.js'

// Typed stubs for the `modules` RPCs (#1774): which modules the registered projects bring, and a
// module running its own package's command in one project.
export const onModules = rpc<typeof impl.onModules>('onModules')
export const runModuleCommand = rpc<typeof impl.runModuleCommand>('runModuleCommand')
