Topics: [the-framework]
GitHub: [#460](https://github.com/gemstack-land/the-framework/issues/460)

# Vike error

## TLDR

Running the built framework (`node dist/bin.js`) throws `ERR_MODULE_NOT_FOUND` for `framework-dashboard/dist/server/entry.mjs`. Root-caused: the dashboard is an `ssr:false` + `prerender:true` Vike SPA — its build emits `dist/server/entry.mjs`, uses it to prerender, then deletes the whole `dist/server/` dir, while `@brillout/vite-plugin-server-entry` has already written `autoImporter.js` into node_modules with `status='SET'` pointing at the now-deleted entry. Both copies in the tree (telefunc's 0.7.18 and vike's 0.7.19) get poisoned. Fix owned by @brillout (plugin author) — acknowledged, queued behind framework priorities, "ping if it's a blocker".

## Why it matters

Building the dashboard is what breaks running it — a clean `main` checkout hits this — so anyone exercising the production path (`node dist/bin.js`) is affected until the plugin learns to distinguish "no server entry" from "server entry emitted then cleaned up by prerendering".

## Source

Imported from GitHub issue [gemstack-land/the-framework#460](https://github.com/gemstack-land/the-framework/issues/460), created 2026-07-13, label: `the-framework ♻️`, 4 comments.

### Original description

I'll have a look at it.

```
~/code/gemstack/packages/framework (main|u=) node dist/bin.js
◆ dashboard running: http://127.0.0.1:4200
  Ctrl+C to stop. Server logs stream below.
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/rom/code/gemstack/packages/framework-dashboard/dist/server/entry.mjs' imported from /home/rom/code/gemstack/node_modules/.pnpm/@brillout+vite-plugin-server-entry@0.7.18/node_modules/@brillout/vite-plugin-server-entry/dist/esm/runtime/autoImporter.js
    at finalizeResolution (node:internal/modules/esm/resolve:275:11)
    at moduleResolve (node:internal/modules/esm/resolve:860:10)
    at defaultResolve (node:internal/modules/esm/resolve:984:11)
    at ModuleLoader.defaultResolve (node:internal/modules/esm/loader:685:12)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:634:25)
    at ModuleLoader.resolve (node:internal/modules/esm/loader:617:38)
    at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:273:38)
    at onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:577:36)
    at TracingChannel.tracePromise (node:diagnostics_channel:344:14)
    at ModuleLoader.import (node:internal/modules/esm/loader:576:21)
```

### Notes from the GitHub thread

- Reproduced on `main`; the build itself poisons node_modules: `vite build` logs `dist/server/entry.mjs 4.07 kB`, then the prerender cleanup removes `dist/server/`, leaving the SET pointer dangling. Two plugin copies exist (telefunc@0.2.22 → 0.7.18, vike → 0.7.19) — both get the same poisoned pointer, which explains the differing versions in stack traces.
- The plugin can't currently tell "no server entry" from "emitted then cleaned up by prerendering"; which side should give is the plugin author's call. Maintainer is aware, will fix after current framework priorities.
