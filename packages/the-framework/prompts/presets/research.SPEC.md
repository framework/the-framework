The research preset: measures the "problem variability" of whatever the user named — the launcher asks "what to measure problem variability of" — by listing every problem the code solves, rating how settled each solution is, and letting the user pick which of them deserve a deep dive. It reviews existing code and changes none of it; its output is a review file and queued follow-up research.

## Glossary

- **problem variability** - for one problem the code solves, how much room there is to solve it differently. Rated 0 to 10, where 10 means the code already solves it in an obviously optimal way and 0 means it is highly unclear whether a better solution exists.

## Business logic — TL;DR

- **Every flow is a problem, and every problem gets a rating** - the agent lists all high-level flows the code implements and rates each one's variability from 0 to 10.
- **The ratings are written down** - they land in a review file named after the session, so the follow-up work has something to point at.
- **The user picks what to dig into** - the list is offered as a multi-select gate with the low-rated entries pre-checked, and the agent waits for the picks.
- **Picked problems become follow-up research** - each one is appended to the session's own follow-up file as a deep-dive entry naming the review file.
- **The session names itself from the branch** - the current git branch, sanitized to a slug, or a fresh slug when that branch name is generic.

## Business logic

### Every flow is a problem, and every problem gets a rating

#### User story

The user wants to know where a codebase has settled on the obvious solution and where it has merely settled on *a* solution — because only the second kind is worth spending research on.

#### Business logic

The agent lists all high-level flows the code implements, which is the list of problems the code solves. It rates each from 0 to 10 against one criterion: does the code solve the problem in an obviously optimal way (10), or is it highly unclear whether the problem can be solved in a better way (0)?

### The user picks what to dig into

#### User story

See `## User story` of the ratings above: the user decides which problems are worth reopening.

#### Business logic

The ratings are written to a review file named `REVIEW-PROBLEMS_<session name>.agent.md`. The agent then shows the list to the user as a multi-select gate and stops until they answer, with the low-rated entries starting checked so the default selection is already the interesting one.

For every problem the user selects, the agent appends an entry to the session's own follow-up file `TODO_<session name>.agent.md`, asking for deep-dive research into alternative solutions and pointing at the review file.

### The session names itself from the branch

#### User story

The preset runs against a checkout that may or may not be on a meaningfully named branch.

#### Business logic

The session name used for both file names is derived from the current git branch name, sanitized into a slug. When that branch name is generic — `main`, for instance — the agent invents a succinct slug instead.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
