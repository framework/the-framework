The section added to an agent's [1] system channel only when the agent has a real browser attached, the "Browser" option of the launcher: it tells the agent that a real Chrome is reachable through the `chrome-devtools` tools, when to use it instead of fetching a page as text, and how to browse so the user can watch. Without this section an agent that has the browser reaches for text fetching by habit and the browser sits unused. The composition rule in `src/system-prompt.ts` places it with the protocols, ahead of the await protocol, so a vanilla [2] agent gets it too; handing the browser over to a human at a login wall or a captcha is the rule in `protocols/await.md`.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] vanilla: an agent started without the built-in system prompt but with the signal protocols kept.

## Business logic — TL;DR

- **A real browser a human can watch** - the agent is told it has a real Chrome, through the `chrome-devtools` tools (`new_page`, `navigate_page`, `click`, `fill`, `take_snapshot`, `evaluate_script`), the same browser the user can watch and take over, to be used for anything it needs to see or act on: pages rendered by JavaScript, a flow to click through, a form to fill, an app to check actually works.
- **Fetch text when reading is enough** - when it only needs to read a page, `WebFetch` is the better tool, faster and handing back the text directly; the browser is for pages that would come back with nothing useful, such as one blank until its JavaScript runs.
- **Navigate in one page** - the agent prefers navigating within a single page over opening new ones, so the user can more easily watch it.
