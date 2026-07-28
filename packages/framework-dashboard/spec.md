The Framework's web dashboard: a Vike SPA (React + Tailwind v4 + shadcn + Telefunc) that is a pure projection of the same `.the-framework` files the daemon writes — prerendered to a static shell the daemon serves, with all wire traffic (read-model RPCs + the live-event SSE Channel) going through Telefunc.

## TLDR

- `pages/` — Vike tree: global config (`ssr:false`, `prerender:true`, `/logo.svg` favicon), IBM Plex fonts head, and the single catch-all page whose `+Page.tsx` is the entire app shell (the URL is the selection, #784).
- `components/` — the React component library: shell rails, run/session views, settings, tickets, charts, and the shadcn-style `ui/` primitives (covered by its own specs).
- `lib/` — client-side hooks and pure helpers: routing, live-event channel state, polling, preferences, notifications, run/status/labels formatting (covered by its own specs).
- `server/` — telefunc shim files whose paths bake the RPC keys (`/server/<name>.telefunc.ts`); implementations live in `@gemstack/the-framework/dashboard-rpc` and the daemon serves them in-process.
- `layouts/` — root layout (theme `.dark` toggling, ErrorBoundary) + `tailwind.css`, the Everforest token stylesheet shared in identity with the-framework.ai (#1118).
- `hooks/` — `useControlledState`, the controlled/uncontrolled prop pattern.
- `design/` — static design-gallery build (`pnpm design:build` → `design/out/**`, uploaded by DesignSync); real components rendered in both themes.
- `public/` — `logo.svg` (favicon carrying its own dark ramp, #757) and `logo-animated.svg`.
- Root: `vite.config.ts` (dev-daemon proxy + telefunc dev URL fix), `vitest.config.ts`/`vitest.setup.ts`/`test-utils.ts` (jsdom unit testing), `tsconfig.json` (`@/*` → package root).

## Decisions

- No custom HTTP endpoints: reads are Telefunc RPCs, the live feed is a Telefunc Channel tailing the selected project's `.the-framework/events.jsonl` — serialization, validation, and reconnect come from Telefunc.
- Dashboard logic that needs the daemon lives in the framework package, not here; this package is UI plus key-pinning shims, which is why it builds to static files the daemon can serve with no Vike runtime.
- Started as the #405/#406 de-risking spike side-by-side with the old `page.ts` MVP dashboard; the README still frames it that way.

## Facts

- Package `@gemstack/framework-dashboard`, private, ESM, Node >= 22.12; depends on `@gemstack/the-framework` (workspace) for types, the registry, and `dashboard-rpc`.
- Scripts: `dev` (pure UI harness on port 4300 — starting runs is disabled, prefs unpersisted), `dev:daemon` (`FRAMEWORK_DEV_DAEMON=1`: boots/reuses the real daemon and proxies `/_telefunc` to it), `build` (prerendered static bundle), `design:build`, `test` (vitest), `typecheck`.
- Theming is the `.dark` class toggled by the layout from a Telefunc-loaded preference — not the OS media query; the token vocabulary (incl. exactly four status colors) lives in `layouts/tailwind.css`.
- Notable stack pieces: Base UI + shadcn-style primitives, tiptap (prompt editor, #470), lucide icons, motion.
