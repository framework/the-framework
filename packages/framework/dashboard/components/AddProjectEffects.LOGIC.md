The text that says what adding a project does to the folder, shown before the user adds it: on the onboarding checklist's first step (`OnboardingChecklist.tsx`) and in the "Add project" modal's trust confirmation (`AddProjectPanel.tsx`). It is one text used in both places, so the two cannot say different things.

## Context

**User story**: a person opens the dashboard for the first time, perhaps in a repository they do not own, and sees a button that adds the folder as a project. Before pressing it they read what it will do there: whether it commits, whether it pushes, what the product keeps in the folder, and that their own files and branch are left alone.

**Problem**: adding a project changes things in the folder that the user cannot see afterwards (hidden directories, a local branch). A user who was not told could not tell what had happened there.

## Business logic — TL;DR

- **The text** - five statements about what adding does: no commit on the user's branch and nothing pushed, what the product keeps in the folder, where the agents' records stay, that the user's files and branch are left alone, and the one case in which a commit is made.

## Business logic

### The text

#### Context

See `## Context`. The statements describe what activation does (`packages/framework/src/install.ts`), what the records branch holds and when it is pushed (the `agent-data` branch), and where an agent works (its own checkout under `.branches/`).

#### Business logic

The text reads:

- "Adding a project lets agents work in its folder. Adding it:"
- a list of three: "makes no commit on your branch and pushes nothing"; "lets OpenAgent keep its own files there, in hidden folders (.openagent, .branches, .agent-runner), and the agents’ records on a local branch agent-data"; "keeps the records on this machine, unless you choose to share them"
- "Agents work in their own copies, on their own branches. Your files and your branch stay as they are."
- in italics: "A folder with no git, or a repository with no commit yet, gets one empty first commit."

The hidden folders and the branch are named as what the product keeps in the folder, not as made at the moment of adding: `.openagent` is made at once, the others when they are first needed.
