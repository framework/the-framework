# TODO_AGENTS.md

The agent queue. Each unchecked entry is worked front to back, highest priority first.

## Priority 7

- [x] [Improve tooltip: show it with no delay, and use it everywhere the browser's tooltip is still used](tickets/2026-07-25_improve-tooltip.md) — only the two items in the ticket's OP. (1) `TooltipProvider` is set to `delay={300}` in `packages/framework-dashboard/components/ProjectActions.tsx:11` and `PreviewBar.tsx:75`; the ticket asks for no delay. (2) Roughly 16 interactive elements still carry a native `title=` attribute (`SessionActionsMenu.tsx:133`, `AgentModelMenu.tsx:65`, `ThemeToggle.tsx:32`, `ConnectionIndicator.tsx:30`, …), which is the slow system tooltip the ticket is complaining about; wrap them in the custom `Tooltip` instead. Leave `title` props on `Section`/`Dialog`/`ConfirmDialog` alone — those are component props, not tooltips. **Out of scope**: the thread's follow-ups (auto-show the dropdown on hover, settings-row redesign, making `Autopilot`/`Open PR` read as labels) are design calls, so the ticket stays open.

## Priority 5

- [x] [Make `Import tickets from GitHub` open the session it just started](tickets/2026-07-25_import-tickets-redirects-wrong-page.md) — `importTickets` in `packages/framework-dashboard/components/OnboardingChecklist.tsx:90-95` starts the run and then calls `onSelectProject(targetProjectId)`, which lands on the project instead of the run doing the import. `TicketsPanel.importFromGithub` (`TicketsPanel.tsx:67-72`) already does the right thing with the same preset — it passes `result.runId` to `onRunStarted` — so mirror that: take the run id back from `useStartRun().start` and navigate to the run.

## Priority 2

- [x] [Let Fable be picked in the model menu](tickets/2026-07-25_bug-cannot-select-fable.md) — `AGENT_UI.claude.models` in `packages/framework-dashboard/components/Composer.tsx:46-51` lists Default, Opus, Sonnet and Haiku, so Fable has no entry to click. Add `{ value: 'fable', label: 'Fable' }`; `claude --help` documents `fable` as a `--model` alias alongside `opus` and `sonnet`, and the value passes straight through to the CLI.
- [ ] [Mark readZip/ZipEntry `@internal`](tickets/2026-07-21_readzip-leaks-onto-public-api.md) — add `@internal` to both in `packages/the-framework/src/driver/actions-zip.ts` (step 1 of the plan recorded on the ticket). Do **not** drop the re-export from `driver/index.ts:28` yet: the ticket assumes nothing has shipped to npm, but `@gemstack/the-framework` is published (latest `1.3.0`, 2026-07-24) and the barrel line predates it, so removal is a breaking change and moves to the next major — which is the branch the ticket itself calls for. Both real callers (`driver/actions.ts`, `driver/actions-zip.test.ts`) import the module directly, so nothing internal depends on the barrel.
