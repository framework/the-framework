import http from 'node:http'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { telefunc } from 'telefunc/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin, type UserConfig } from 'vite'

// Opt-in (`pnpm dev:daemon`, i.e. FRAMEWORK_DEV_DAEMON=1): let the dev server actually start runs.
//
// `pnpm dev` alone is the Vite dev server with no Telefunc context, so `sendStart` reports "starting
// a session is not enabled on this server" (same gap that leaves preferences unpersisted in dev).
// Only the daemon has the `startRun` handler. This plugin brings that daemon up *inside the dev
// server's own process* and proxies `/_telefunc` (RPCs and the SSE Channel) to it, so the
// live-reload UI gets the full backend, run-starting included.
//
// In-process, not spawned: the CLI is foreground-only, so there is no detached daemon to reuse and
// nothing to leave behind — Ctrl-C on the dev server takes the daemon with it. `runDaemon` blocks
// until shutdown, so it is left unawaited and `onListening` reports the port it bound.
//
// The proxy middleware is registered synchronously so it lands ahead of Telefunc's own middleware;
// it holds requests until the daemon is up. Left out by default so the plain dev server stays a
// pure UI harness with no backend behind it.
function frameworkDevDaemon(): Plugin {
  return {
    name: 'framework:dev-daemon',
    apply: 'serve',
    configureServer(server) {
      if (!process.env.FRAMEWORK_DEV_DAEMON) return
      let target: { hostname: string; port: string } | null = null
      const ready = (async () => {
        const { runDaemon } = await import('../dist/index.js')
        const cwd = process.env.FRAMEWORK_DEV_DAEMON_CWD || process.cwd()
        // Ephemeral port: the dev server owns the address the browser talks to, and binding 4200
        // would collide with a `framework` the developer is running in another terminal.
        const url = await new Promise<string>((resolvePromise, rejectPromise) => {
          void runDaemon(cwd, { port: 0, onListening: state => resolvePromise(state.url) }).then(
            () => rejectPromise(new Error('the dev daemon exited before it bound')),
            rejectPromise,
          )
        })
        const bound = new URL(url)
        target = { hostname: bound.hostname, port: bound.port || '4200' }
        server.config.logger.info(`\n[framework] dev daemon started at ${url} — starting runs is enabled\n`)
      })().catch((err: unknown) => {
        server.config.logger.error(
          `[framework] dev daemon did not start (${err instanceof Error ? err.message : String(err)}); ` +
            `reads still work, but starting a run stays disabled`,
        )
      })

      // Registered up front (not after the await) so it sits ahead of Telefunc's middleware; the
      // request waits on `ready` when it arrives before the daemon has come up.
      server.middlewares.use((req, res, next) => {
        const url = req.originalUrl ?? req.url ?? ''
        if (!url.startsWith('/_telefunc')) return next()
        const forward = (dest: { hostname: string; port: string }): void => {
          // Host header left as the browser sent it (localhost:<devport>), so the daemon's same-origin
          // guard passes; the SSE Channel just rides the piped response.
          const proxyReq = http.request(
            { hostname: dest.hostname, port: dest.port, method: req.method, path: url, headers: req.headers },
            proxyRes => {
              res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
              proxyRes.pipe(res)
            },
          )
          proxyReq.on('error', () => {
            if (!res.headersSent) {
              res.statusCode = 502
              res.end('framework dev daemon proxy error')
            }
          })
          req.pipe(proxyReq)
        }
        if (target) return forward(target)
        // Daemon still coming up, or it failed: once `ready` settles, proxy if it is up, otherwise
        // fall through to Vite's own telefunc handling so reads keep working (sendStart just reports
        // it is not enabled there) instead of erroring every request.
        void ready.then(() => (target ? forward(target) : next()))
      })
    },
  }
}

// `pnpm dev` only. Telefunc's client marks every request URL with its kind
// (`/_telefunc?_telefunc=txt`, `sse` for a Channel) and may append an advisory `session`, but its
// dev middleware matches with `url !== '/_telefunc'`, so it declines its own requests — and the
// SPA fallback then answers them with `index.html`, so every read failed on `Unexpected token '<'`
// and the UI sat behind the daemon-down banner. Dropping the query restores the exact match: the
// request kind and the session both ride headers too, and Telefunc's own docs call the URL param
// advisory. Registered from configureServer directly so it lands ahead of the middleware Telefunc
// adds from its returned post-hook. The daemon is unaffected: it matches on the parsed pathname.
function telefuncDevUrlFix(): Plugin {
  return {
    name: 'framework:telefunc-dev-url-fix',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.originalUrl ?? req.url
        if (url?.startsWith('/_telefunc?')) {
          req.url = '/_telefunc'
          req.originalUrl = '/_telefunc'
        }
        next()
      })
    },
  }
}

// Dashboard (#405): a plain Vite SPA — React + Tailwind v4 + shadcn, with Telefunc for
// everything over the wire (the read-model RPCs plus the live event stream, which is a Telefunc
// Channel, server/events.telefunc.ts). `index.html` beside this file is the whole entry; the
// daemon serves the built output as static files with an SPA fallback.
export default defineConfig({
  // The dashboard is a directory inside @gemstack/the-framework rather than a package of its own
  // (A7), so `root` is pinned to this file's directory instead of inherited from the cwd — the
  // scripts that run it live one level up. It is also what keeps the baked Telefunc keys
  // (`/server/reads.telefunc.ts`) the paths they have always been.
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [frameworkDevDaemon(), telefuncDevUrlFix(), react(), telefunc(), tailwindcss()],
  build: {
    // Straight into the package's own dist, where the daemon serves it from. There used to be a
    // copy step between the two — a whole turbo task — because the bundle was built in a
    // different package.
    outDir: fileURLToPath(new URL('../dist/dashboard-bundle', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    port: 4300,
  },
} as UserConfig)
