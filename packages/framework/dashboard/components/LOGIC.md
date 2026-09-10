The dashboard's [1] view layer: every page the user sees and every control on it. A view renders what the daemon [2] answered and fires the actions the user takes; the state it renders and the rules it applies live in `lib/`, the primitives it is assembled from in `ui/`, and the rich prompt editing in `prompt-editor/`. Each view has a `LOGIC.md` beside it; a `*.test.tsx` file's says what its tests cover.

## Context

**User story**: everything the user does with The Framework happens here — starting an agent [3], watching it, answering the questions it stops at, chatting with it, deciding what becomes of its work, working the tickets and the agent queue [4], seeing what the account has spent, and changing every setting.

## Glossary

[1] the dashboard: the browser app the daemon serves — the product's only user interface.
[2] the daemon: the one foreground process per machine: serves the dashboard, starts agents, runs the sweeps.
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[4] the agent queue: the priority-ordered list of what agents will work on next.
[5] gate: a question with options at which an agent stops and waits for an answer.
[6] handoff: what happens to an agent's work when it ends, as one ladder: keep it local, push the branch, open a pull request, merge it.
[7] preset: a canned prompt the user launches from the dashboard.
[8] routine: a preset the daemon fires on its own on a schedule.
[9] intervention: something that needs a human — an open question, a pull request to review, unpushed commits.
[10] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.

## Business logic — TL;DR

- **The frame around every page** (`AppFrame.tsx`, `DashboardPage.tsx`, `BrandLink.tsx`, `Logo.tsx`, `ConnectionIndicator.tsx`, `ThemeToggle.tsx`, `NotFound.tsx`, `ErrorBoundary.tsx`, `DisclosureToggle.tsx`, `driver-logos.tsx`) - the shell the pages sit in, the mark and the connection state in its corner, the light and dark choice, and what the user is shown when a link outlived its target or a view fails.
- **The cross-project Overview** (`AgentOverview.tsx`, `Agents.tsx`, `OpenQuestions.tsx`, `RoutineWork.tsx`, `HotTickets.tsx`, `OnboardingChecklist.tsx`, `Quota.tsx`) - what is being worked right now, every unanswered question across projects answered in place, the routines [8] with what each would spend, the hottest tickets, the steps a new user still has to take, and the account's quota as one track.
- **A project's own page** (`ProjectHome.tsx`, `ProjectActions.tsx`, `WorkspaceActions.tsx`, `ProjectDocs.tsx`, `ProjectErrorBanner.tsx`, `AddProjectPanel.tsx`, `AiQueue.tsx`, `TicketsPanel.tsx`) - the launcher and everything under it: the project's agent queue [4] and tickets, its surfaced documents, the actions on the project itself, adding one behind a trust confirmation, and the banner that says the project's bookkeeping branch cannot reach its remote.
- **Starting work** (`Composer.tsx`, `PromptEditor.tsx`, `StartAgentForm.tsx`, `StartAgentButton.tsx`, `PresetsMenu.tsx`, `PresetCreatePanel.tsx`, `OptionsMenu.tsx`, `DriverModelMenu.tsx`, `ContextFiles.tsx`, `ContextMenu.tsx`, `PreferredEditorItems.tsx`, `UpdateTicketsButton.tsx`) - the prompt editor with its typed triggers, the presets [7] and the user's own, the options gear, the choice of coding agent, model and location, the files and projects put in an agent's [3] context, and the rule that every button which spends an agent can open the launcher first so its settings are chosen before it runs.
- **Watching one agent** (`AgentView.tsx`, `AgentFeed.tsx`, `EventList.tsx`, `AgentDetails.tsx`, `AgentErrorCount.tsx`, `AgentComposer.tsx`, `ChoicePanel.tsx`, `AnsweredChoice.tsx`, `RightRail.tsx`, `ViewsRail.tsx`, `DocsPanel.tsx`, `AgentHistory.tsx`, `SystemPromptDisclosure.tsx`, `ResolvedOptions.tsx`) - the agent's transcript with its questions rendered as answerable cards where they happened, the chat that continues it, the rails of documents, markdown views and past agents, and the disclosures showing exactly what the agent ran under.
- **What the agent changed, and where it goes** (`AgentChanges.tsx`, `DiffView.tsx`, `FileTree.tsx`, `FilePreview.tsx`, `GitStatusBar.tsx`, `AgentActionBar.tsx`, `AgentHandoff.tsx`, `AgentActionsMenu.tsx`) - the changed files and their diffs, the branch's state, the one-line verdict of what the branch holds, the armed handoff [6] and the single next step offered once the agent has settled, and every action on the agent itself.
- **Agents that run elsewhere** (`CloudAgentNotice.tsx`, `ActionsRunNotice.tsx`, `RemoteAgentNotice.tsx`, `BrowserPanel.tsx`, `InlineBrowser.tsx`) - what a page says about an agent whose work is in a cloud session, on a GitHub Actions runner or on a device [10], and the live view of the browser an agent is driving, handed to the user at a login wall.
- **Settings and what reaches the user** (`SettingsPage.tsx`, `NotificationsMenu.tsx`, `DiscordDialogs.tsx`, `DevicesSettings.tsx`, `AddDeviceDialog.tsx`, `BridgeSettings.tsx`, `BridgeBrowserSettings.tsx`) - every setting with its default, which notifications [9] reach the browser and Discord, the saved devices [10], and turning on the Claude web bridge and the browser that serves it.
- **The tickets** (`TicketsPage.tsx`, `TicketFilterBar.tsx`, `TicketDetailPage.tsx`, `TicketPlanPage.tsx`, `TicketPageShell.tsx`) - the cross-project list with its facets mirrored to the address, one ticket and its plan, and the buttons that put tickets on the agent queue [4] or start an agent on one.
- **Rendering what an agent wrote** (`Markdown.tsx`) - an agent's own markdown shown as elements rather than as markup, so nothing it writes can act on the page.
- **The pieces they are built from** (`ui/`, `prompt-editor/`) - two subdirectories with their own `LOGIC.md`: the dashboard's primitives, and the rich editing behind the composer.
