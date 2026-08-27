Every prompt The Framework sends an agent lives here as markdown. Nothing agent-facing is written as code, so prompting changes without touching code and a prompt change is reviewed as a readable markdown diff. The markdown is compiled into the package when it is built; it is never read off the user's disk at run time.

## User story

- The user's agents behave the way they do because of what they are told. The person tuning that behavior edits prose, and their change lands as a diff a reviewer can read.
- The user sees the exact prompt an agent will be given before starting it, in the dashboard, including the preset behind each launcher button.

## Business logic — TL;DR

- **Markdown is the only source of truth** - the prompts are compiled into the package at build time and the code uses the compiled copies; a prompt is edited in exactly one place.
- **The built-in system prompt** - the standing instructions every agent starts with: analyze the prompt, park at a gate when the user should decide, name the session before the first change, declare ready for merge only when finished.
- **The file formats** - the shapes agents must follow for tickets and for the agent queue, carried in the agent's own context rather than pointed at.
- **Branch management** - the section after the built-in prompt saying how the agent names its branch: the branch-management package's own skill for an agent in a checkout The Framework created, else the fallback that has it branch with git itself.
- **The data-branch protocol** - where the framework's own data lives and how to read and write it without putting it on a code branch.
- **The protocols** - how an agent signals: awaited choices and ready for merge, plus the sections added only when it has a browser, when it runs hands-off, and when nothing can answer its questions.
- **The presets** - one file per launcher button and per routine prompt.
- **The on-before-mergeable prompt** - the optional extra turn a finished agent gets, queueing quality follow-ups and folding what it learned into the knowledge base.
- **Prompts are reviewed before they land** - a prompt change goes through review like any other change.

## Business logic

### Markdown is the only source of truth

#### User story

See `## User story`: whoever tunes an agent's behavior should be editing prose, and the reviewer should be reading prose.

#### Business logic

Each prompt is one markdown file here, compiled into the package when it is built and used from that compiled form. A file's exact bytes become the prompt, so what a reviewer reads in the diff is what an agent is sent.

#### Rationale

The prompts are compiled in rather than read from disk because the dashboard renders them in the browser to show the user a prompt before an agent starts, and reading files from disk is not something the browser can do.

### What lives here

#### User story

See `## User story`.

#### Business logic

- **The system prompt** — The Framework's built-in standing instructions for every agent, and the slot the user's own prompt is rendered into. The user's own additions live in their repo instead, not here.
- **The file formats** — the ticketing format (how a ticket, its lock and its plan are written) and the agent-queue format (how `TODO_AGENTS.md` is banded by priority). They travel with the agent's context, so the agent has already read the format rather than having to find the file that describes it.
- **The data-branch protocol** — that tickets, the agent queue and the agent archives live on `tf-data`, are read off that branch, and are written straight to it instead of riding a pull request.
- **The triage scope rule** — the one-paragraph rule appended to both triage presets, that a triage only queues work and never implements it.
- **The protocols** — how an agent signals to The Framework, and what this particular agent can do.
- **The presets** — one file per preset: the launcher's buttons and the daemon's routine prompts.
- **The on-before-mergeable prompt** — the extra turn an agent gets when it signals ready for merge, if the user turned that on.

### Prompts are reviewed before they land

#### User story

An agent's behavior is a product decision, so changing it is a decision the team makes deliberately.

#### Business logic

The built-in system prompt is owned as a design document, and every prompt change here gets a review round before it reaches production. Keeping the prompts as markdown in one directory is what makes that review possible: the change is a prose diff rather than a string edit somewhere in the code.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
