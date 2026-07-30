/**
 * Loopback-address helpers, shared by the daemon (deciding whether a bind gates behind the
 * token, #1051) and the Telefunc mount (rejecting a rebound `Host`). A leaf module on purpose:
 * `daemon.ts` imports the dashboard, so the mount cannot import these back out of it.
 */

/**
 * True when `host` is a loopback address the browser reaches without leaving the machine (#1051).
 * A bind-all (`0.0.0.0`, `::`) or a routable address is not, and gates behind the shared token.
 */
export function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '::1' || host === '[::1]' || host.startsWith('127.')
}

/**
 * The hostname a `Host` header names, with the port dropped. Keeps the bracketed IPv6 form
 * (`[::1]:4200` → `[::1]`), which splitting on the first colon would mangle.
 */
export function hostnameFromHostHeader(header: string): string {
  if (header.startsWith('[')) {
    const close = header.indexOf(']')
    return close === -1 ? header : header.slice(0, close + 1)
  }
  const colon = header.indexOf(':')
  return colon === -1 ? header : header.slice(0, colon)
}
