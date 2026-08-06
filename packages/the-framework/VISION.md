# Now/soon

## Foundational features

- SDD
  - SPEC.md
- Memory
  - MEM.md
- Autonomous AI
  - Quick-win & low-uncertainty tickets
  - Automatic bug fixing
    - GitHub CI red
    - Sentry red
    - Production errors (e.g. Cloudflare logs)
  - Plan tickets (aka spike)
    - Agents can access tickets
    - Bonus: tickets dashboard
  - Refactoring
    - Bug fixing?
    - Maintenance
    - Human readability
    - Security
- Improved system prompt
  - No implicit decisions
  - No laziness

## Niceties

- High-quality prompts & loops
  - Advanced planning
  - Market research
  - Bootstrap
  - ...
- Notifications
- Bring your own prompts
- Discord bot
  - Auto record team conversations
  - Auto create tickets from conversations
  - Directives
- Swarm of local machines

# MVP

## MVP - YC

- Fix blocking bugs
- Dogfood TF
- Showcase 20 quick-wins being worked concurrently (CC web) and autonomously

## MVP - users

- Fix major UX paper cuts
- Make each feature opt-outable


# Candidates

## Foundational features

- "Programs" => mix of skills/loops/on-going-work
  - Codebase health
    - Show a "health progress bar"?
    - Dogfood on TF?
    - Checks
      - Code quality?
        - Architecural split?
        - Dead code elmination?
        - Simplicity?
      - Proper tests?

## Niceties

- `Auto`-model chooser (use cheap model to analyze prompt and select the right model)
- 10x better better PR descriptions: one-sentence description, TLDR, problems, solutions, flows (business logic), details
- Maintenance
  - Root `MAINTENANCE.md`: lists all files (the file structure)
  - A `.maintenance.md` per file: lists all functions
  - Three ratings: maintainability, human readability, security
  - High-quality prompts:
    - [Highly-effective code refactoring prompt](https://gist.github.com/brillout/8abfd310bad5df422ae56c5c9066ffc5)
      - Let's break this prompt in two: one for maintainability (e.g. DRY), and a second one for readability (so that humans can easily read the code)
        - Try the readability prompt on brand-the-framework (it has lots of potential for top-down code structure refactoring)
    - Security audit (TODO: develop scurity audit prompt)


# Postponed

## Foundational features

- Autonomous PM
  - Autonomous feature suggestions after autonomous:
    - Market research
    - Competitor research
    - Reading of user feedback
  - Business memory such as `PROJECT_GOAL.md` or `BRAINSTORMING.md`

## features

- Mobile app
- Scaling
  - For large codebases: `CODEBASE_OVERVIEW.md`
- Sandbox
  - Complex implementation?
    - Not sure how secrets (e.g. production env vars) can sandboxed from AI
    - Ideally sandboxing happens on a directory-level (spanning over multiple repositories), so that AI can access multiple repos at once.
- TLDR thinking out loud
  - VALUE-MEDIUM
  - Show TLDR of the model's thinking (=> nice overview of all the thinking done during this session)
  - Also show live thinking (same thinking-out-loud as Claude Code => just forward the Claude Code CLI output)
  - Show nice lists of used skills, opened URLs, commands ran
