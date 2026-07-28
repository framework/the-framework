Tests for `message-scroller.tsx` — pins that `MessageScrollerViewport` asks for the local scrollbar utilities and that every one it asks for is actually defined in the stylesheet.

## Facts

- Regression guard for #914: the port originally dropped upstream's viewport styling because those utilities came from a plugin the repo doesn't have — an undefined class is silently nothing, so the pairing (class asked ↔ `@utility` defined in `layouts/tailwind.css`) is what's asserted.
- Reads `layouts/tailwind.css` relative to the package root (vitest's cwd) because `import.meta.url` is not a file URL under jsdom.
- Also pins `data-autoscrolling:scrollbar-quiet` — the bar goes quiet while the log chases the live edge.
