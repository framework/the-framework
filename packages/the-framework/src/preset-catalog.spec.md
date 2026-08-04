The preset catalog: every preset is one row in one table — name, prompt template, parameters, label, and behavior flags (17 presets: research, triage, spike-and-plan, drain-queue, maintenance, security audit, UX, ticket import/update, market research, suggestions…).

## Decisions

- The prompt **text** is not here: it ships as prose in `prompts/presets/<stem>.md` and reaches the table through generated constants — a prompt is edited as a readable markdown diff in one place.
- Pure by construction (no `node:*`), so the dashboard renders any preset in the browser before a run.
- Derived surfaces (the launcher's preset list, the stem → template map) are computed from the table; a stem with no catalog row simply vanishes, which an exact key-set test turns into a build failure instead of a silent gap.

## Facts

- Custom presets save to two tiers: the **user** tier (home file — follows the person, stays private) and the **project** tier (in the repo — travels with the code, shared with everyone who clones).

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
