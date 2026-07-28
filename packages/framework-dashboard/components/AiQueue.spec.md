The Overview's AI Queue card (#1139): every project's open `TODO_AGENTS.md` entries, shown in full, with a play button that starts one agent on one entry.

## TLDR

- Groups `ProjectQueue[]` by project (only projects with `open > 0`), listing every open item — no "+N more": this is the plan, and a collapsed plan is one you cannot read.
- Entry titles and play buttons are different acts: the title OPENS what the entry names — a ticket link (#1164) opens that ticket's page in-app via `onOpenTicket(projectId, file)` (#1144), an external URL is a real `<a target="_blank">`, plain text stays a span — while play STARTS the entry.
- Play posts `workOnEntryPrompt(entry)` via `useStartRun` with `runOptionsFromPreferences(preferences)` plus `unattended: true` (#1279): card-started queue work runs exactly like the drain sweep — gates auto-answer, run ends at settle, armed handoff fires — instead of parking in the stay-open chat loop.
- On success calls `onRunStarted(projectId, prompt, runId?)` (#1191) so the shell lands on the run (or adopts it via poll when no id came back); a failed start shows `role="alert"` and never navigates.
- The project header stays a header: a project name that jumped to the launcher was the odd redirect #1139 called out.

## Facts

- `workOnEntryPrompt(entry)` is exported so the test asserts against the real string; it embeds the RAW `TODO_AGENTS.md` line (not the pretty label) because the agent must find exactly that entry to check it off, and the line's link is how it opens the ticket (#1164).
- The prompt is the drain preset's vocabulary narrowed from "the FIRST open entry" to the one shown entry: "work on this one open entry only, then check it off. Do not start any other entry."
- The in-flight spinner is keyed by `${projectId}\n${entry}` content, not index: the list is polled and can shift under a click.
- `onRunStarted` takes the project-carrying form because the Overview has no project selected — each entry knows its own.
- Row labels come from `queueEntryLabel(item.text)` (`lib/queue-entry.ts`), which classifies an entry as ticket / url / plain; the whole raw line stays as the row's `title` hint.
