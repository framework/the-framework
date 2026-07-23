// Re-export shim (#1072): the saved-devices health telefunction lives in @gemstack/the-framework so the
// daemon serves it in-process and does the cookie'd cross-origin ping. Keeping this file at
// `server/devices.telefunc.ts` bakes the RPC key `/server/devices.telefunc.ts` the daemon registers
// under (framework's dashboard-rpc/register.ts). Imported then exported, not re-exported (#1014):
// telefunc's dev transform appends `__decorateTelefunction(<name>, ...)` per export, which an
// `export ... from` gives no local binding for.
import { checkDevices } from '@gemstack/the-framework/dashboard-rpc'

export { checkDevices }
