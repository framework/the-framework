import type * as impl from '../../src/dashboard-rpc/models.js'
import { rpc } from '../lib/rpc.js'

// The types the RPC speaks in, straight from the implementation — erased at build, so importing
// them here pulls no server code into the bundle.
export type * from '../../src/dashboard/models.js'

// The typed stub for the `models` RPC, checked against the implementation's own signature.

export const onModels = rpc<typeof impl.onModels>('onModels')
