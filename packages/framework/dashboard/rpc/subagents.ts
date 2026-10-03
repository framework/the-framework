import type * as impl from '../../src/dashboard-rpc/subagents.js'
import { rpc } from '../lib/rpc.js'

// The types the RPCs speak in, straight from the implementations — erased at build, so importing
// them here pulls no server code into the bundle.
export type * from '../../src/dashboard/subagent-settings.js'

// The typed stubs for the subagent settings RPCs, checked against the implementations' own signatures.

export const onSubagentSettings = rpc<typeof impl.onSubagentSettings>('onSubagentSettings')
export const sendSubagentSettings = rpc<typeof impl.sendSubagentSettings>('sendSubagentSettings')
