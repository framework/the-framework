Vendored animate-ui styled file-tree layer (copied from animate-ui.com, `@ts-nocheck`): wraps the base `files` primitives with lucide icons, Tailwind styling and an optional git-status prop.

## TLDR

- Exports `Files` (wraps the primitive in a `FilesHighlight` accent-hover layer), `SubFiles`, `FolderItem`, `FolderTrigger`, `FolderPanel` (indented with a left border rule), `FileItem`.
- `gitStatus?: 'untracked' | 'modified' | 'deleted'` tints rows success/warning/danger and adds a status dot (folders) or U/M/D letter (files) — a local addition on top of the vendored base.
- Consumed by `FileTree.tsx` (the right rail's Files tab); imports resolve via the `@/` alias mapped to the package root in vite/tsconfig.
