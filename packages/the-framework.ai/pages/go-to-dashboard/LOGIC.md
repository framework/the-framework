The "Go to dashboard" page (`/go-to-dashboard`): the answer the public site gives to "where is the dashboard?" — it runs on the visitor's own machine, so the page hands out the commands that start it, in the visitor's package manager, each copied with one click. Nothing on the site links to the page: a public page can neither detect nor open a local dashboard, which is also why the top navigation has no dashboard button.

## Business logic — TL;DR

- **The three commands** (`+Page.tsx`) - "Run" `the-framework` when installed, "Install" a global install, "One-time run" a run without installing; the last two follow the site-wide package manager choice, and every command copies on click.
- **The page title** (`+config.ts`) - "Go to dashboard — The Framework".
