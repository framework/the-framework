The selected project's agents — both the live ones and the archived ones — refreshed every two seconds. The dashboard shell reads this list once and shares it, so the agent list and the main pane beside it always show the same set, and a refresh triggered by an action can never write a previous project's agents into the newly selected one. The shell also knows whether the first read has answered yet, which is what lets it tell an agent that is genuinely gone apart from one it simply has not read yet: a bookmarked link to an agent must not flash "gone" while the first read is still out.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
