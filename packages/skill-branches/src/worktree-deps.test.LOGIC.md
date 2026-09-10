What the tests cover, partly against a real dependency tree on disk:

- **Which dependency trees are found** - the project root's `node_modules` and those of directories up to two levels deep (`packages/a`, `examples/demo`), in sorted order; a `node_modules` whose parent is three levels deep is not found; the scan never enters `node_modules`, `.git` or a dot directory such as `.branches/`.
- **How a tree is mirrored** - each tree becomes a real directory of the checkout's own at the same relative path, holding one link per entry, `.bin` and a scope directory such as `@scope` each as one link.
- **The package manager's private state is left out** - `.pnpm`, `.modules.yaml` and `.pnpm-workspace-state-v1.json` are never linked, while `.bin` and the packages are.
- **An existing tree is left alone** - a checkout that already has a `node_modules` gets no links there.
- **A filesystem that refuses** - a link that cannot be made is skipped and the tree still counts as mirrored; a directory that cannot be made yields no mirrored tree; neither case fails the caller.
- **A working tree for real** - through a pnpm-shaped tree, a package's file is read from the checkout across the chain of links; the checkout's `node_modules` holds no `.pnpm` and no `.modules.yaml`; an install in the checkout replaces the checkout's own entry and leaves the user's tree untouched; a second pass links nothing new.
