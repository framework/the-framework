Vendored animate-ui component tree (copied from animate-ui.com, all files `@ts-nocheck` — not authored against this repo's `exactOptionalPropertyTypes`), providing the animated file-tree used by `FileTree.tsx`.

## TLDR

- `components/` — styled layer: the Tailwind/lucide-skinned file tree (`components/base/files`) built on the primitives, with a local `gitStatus` addition.
- `primitives/` — unstyled behavior: Base UI accordion with motion animations (`primitives/base/accordion`), the Files/Folder slot components (`primitives/base/files`), and the gliding hover-highlight effect (`primitives/effects/highlight`).

## Facts

- Internal imports use the `@/` alias (`@/components/animate-ui/...`, `@/lib/utils`), mapped to the package root in `vite.config.ts` and tsconfig `paths` specifically for these copied-in files.
- Dependency chain: styled files → primitives/base/files → primitives/base/accordion + primitives/effects/highlight; motion/react and `@base-ui-components/react` enter the dashboard's dependency tree here (Base UI is then reused by the app's own `ui/` components — no Radix).
