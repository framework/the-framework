The Framework's built-in system prompt: the standing instructions every agent starts with, telling it to size up the user's prompt before touching code, to park at a gate whenever the user should decide instead of the agent, to move onto its own branch before the first change, and to declare itself ready for merge only when nothing is left.

## User story

- The user types a one-line prompt and walks away. An agent that guessed wrong on an ambiguous prompt burns a whole task on work nobody wanted, so the agent first asks which reading was meant.
- The user wants to keep the important decisions. The prompt makes the agent surface the decisions worth making — which interpretation, which plan, which of several viable approaches — as choices, and hand them back.
- The user reviews finished work as a pull request. That only works if the work sits on its own branch from the first change, under a name that says what it was about.

## Glossary

- **macro** - a shorthand the prompt defines for itself at the top (`<SHOW_MD>`, `<SHOW_CHOICES>`, `<AWAIT>`, `<SESSION_NAME>`, `<TODO_FILE>`) and then uses throughout, so one instruction is written once and referenced everywhere. The agent expands them itself; nothing in The Framework substitutes them.

## Business logic — TL;DR

- **Analyze the prompt before working** - an unclear prompt becomes a plausibility-ranked list of interpretations offered as a choice, and the agent waits for the answer.
- **Large scope gets approved first** - large work is written up as a plan file shown to the user and awaits approval; very large work also seeds follow-up entries onto the agent queue.
- **Name the session** - before the first change the agent names the session through `branch-management name`, and uses the name the command prints.
- **Rate variability, offer alternatives** - each problem about to be solved is scored on how obviously optimal its solution is; low scorers are explored and their alternatives offered as a choice.
- **Ready for merge is explicit** - the agent signals it only when the task is finished; otherwise it states what remains.
- **The user's prompt is the last section** - the built-in instructions frame the system channel, and the user's own prompt is delivered as its own half.

## Business logic

### Analyze the prompt before working

#### User story

See `## User story`: a prompt whose scope or intent is unclear.

#### Business logic

The agent's first act is to analyze the user's prompt. If what to do is not clear — unclear scope, unclear intent — the agent lists the possible interpretations sorted by plausibility, offers them as a choice, and stops until the user picks one.

### Large scope gets approved first

#### User story

The user asks for something that turns out to be days of work. Reviewing the direction up front costs one answer; reviewing it afterwards costs the whole task.

#### Business logic

When the scope of the work is *large*, the agent writes a plan file named `PLAN_<session name>.agent.md` describing what it will work on, shows it to the user as a markdown view, and stops until the user approves.

When the scope is *potentially very large* — spanning many hours or days — the agent additionally considers appending follow-up tasks to the agent queue (`TODO_AGENTS.md`) and showing the new entries as a markdown view, so the overflow becomes queued work rather than being lost.

### Name the session

#### User story

See `## User story`: work must be reviewable as a pull request on a branch named after what it does.

#### Business logic

Before applying its first change the agent picks a session name — an `[a-z0-9-]+` string that succinctly captures the intent of the user's prompt — and runs `branch-management name <session name>`. The command renames the agent's branch to `tf-<session name>` and prints the name the branch got; when that differs (the name was taken), the printed name is the session name from then on. The prompt points the agent at the branch-management skill, appended right after it, for everything else about its checkout: the workspace boundary, committing as it goes, and the clean tree it must leave.

#### Rationale

Naming before the first change, rather than after the work is done, means there is never a moment where changes sit on a branch that says nothing about them. The workspace rules that used to live here are the skill's: they describe the checkout the branch-management package created, so they ship with that package.

### Rate variability, offer alternatives

#### User story

Some problems have one obviously right solution and some have several defensible ones. The user wants to decide the second kind and wants the agent not to bother them with the first.

#### Business logic

Before applying changes — and again whenever it is about to make further changes — the agent measures "variability": it lists every high-level problem it is about to solve and rates each from 0 to 10, where 10 means there is an obviously optimal way to solve it and 0 means it is highly unclear whether a better solution exists. For the low-rated problems the agent explores and proposes alternatives; where a problem has alternatives it lists them in a sensible order, offers them as a choice, and stops until the user answers.

### Ready for merge is explicit

#### User story

The user wants finished work merged automatically and unfinished work left alone.

#### Business logic

After applying changes the agent decides whether the session is finished with no work left. If it is, the agent calls `setReadyForMerge()` — the prompt states outright that the work is never merged without it. If it is not, the agent withholds the signal and instead states what remains.

### The user's prompt is the last section

#### User story

The dashboard shows the user the exact prompt an agent will receive, split into the framework's standing instructions and the user's own request.

#### Business logic

The prompt file carries both halves: everything above the `# User prompt` heading is the built-in instructions that frame the agent's system channel, and everything below it is the slot the user's typed prompt is rendered into. The two are delivered separately — the first as the system channel, the second as the agent's actual request.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
