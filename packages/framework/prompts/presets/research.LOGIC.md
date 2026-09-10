The "Research" preset of the launcher: a review of how well a piece of code solves each problem it solves, ending in a gate [2] where the user picks the problems worth researching alternatives for. The agent [1] lists the high-level flows the target implements, rates each from 0 to 10 for how obviously optimal its solution is, writes the ratings to a review file in the checkout, shows the list as a multi-select with the low-rated problems pre-checked, and turns every problem the user picks into a follow-up entry in a per-session to-do file. The target is the preset's one parameter, "What to measure problem variability of"; left blank, it is the name the agent the preset was launched from gave its work, or the "entire codebase" when there is none.

## Context

**User story**: from a project's launcher the user clicks "Research", optionally naming what to review, and later gets a card listing every problem the code solves with a rating, the doubtful ones already ticked; whatever the user ticks becomes a written follow-up asking for a deep-dive into alternative solutions.

**Business logic story**: the preset is one prompt agent [3], so the built-in system prompt's own steps apply to it as well. Its parameter is filled by the rule in `src/preset-prompt.ts`. The multi-select is emitted as the `await-choices` block of `protocols/await.md`, which is how the dashboard shows it and how the pick [4] gets back to the agent.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent. When nobody can answer, the recommended option is taken.
[3] build agent / prompt agent: the two kinds of agent: a build works the agent queue after its opening exchange; a prompt agent runs one prompt and stops there.
[4] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[5] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.

## Business logic — TL;DR

- **Rate every problem the code solves** - list all high-level flows the target implements, rate each from 0 (highly unclear whether it could be solved better) to 10 (obviously optimal), and write the ratings to `REVIEW-PROBLEMS_<SESSION_NAME>.agent.md`.
- **Let the user pick which to research** - show the list as a multi-select and stop, with the low-rated problems checked by default.
- **Queue a deep-dive per picked problem** - for each problem the user picked, add "Deep-dive research for alternative solutions, see <the review file>" to `TODO_<SESSION_NAME>.agent.md`.

## Business logic

### Rate every problem the code solves

#### Context

See `## Context`.

#### Business logic

The agent [1] measures what the prompt calls "problem variability" of the target: it lists all high-level flows the code implements, that is, all the "problems" the code solves, and rates each from 0 to 10 by one criterion: does the code solve the problem in an obviously optimal way (10), or is it highly unclear whether the problem can be solved in a better way (0)? It writes the ratings to a new file `REVIEW-PROBLEMS_<SESSION_NAME>.agent.md` in its checkout [5].

The prompt's "SESSION_NAME" is the name of the current git branch, sanitized into a slug; when the branch name is generic, such as `main`, the agent makes up a succinct slug instead.

### Let the user pick which to research

#### Context

See `## Context`.

#### Business logic

The agent [1] shows the list to the user as a multi-select and stops at a gate [2] for the answer. Entries with a low rating start checked; the others do not. The agent does not decide for the user which problems are worth a deeper look.

### Queue a deep-dive per picked problem

#### Context

**Problem**: the research itself is the expensive part; splitting it into one follow-up per problem the user chose keeps this agent [1] short and lets each deep-dive be worked, or dropped, on its own.

#### Business logic

For every problem the user picked [4], the agent [1] adds one entry to `TODO_<SESSION_NAME>.agent.md` in its checkout [5], reading "Deep-dive research for alternative solutions, see `REVIEW-PROBLEMS_<SESSION_NAME>.agent.md`". This to-do file is the prompt's own, not the agent queue.
