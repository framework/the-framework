Status: open
Topics: [the-framework]
GitHub: [#326](https://github.com/gemstack-land/the-framework/issues/326)

# System prompt

## TLDR

The living spec of the framework's built-in system prompt: analyze the user prompt (ambiguous → interpretations + choices; large scope → `PLAN_*.agent.md` / `TODO_AGENTS.md`), session naming + `the-framework/<name>` branch, variability/alternatives gates (`showChoices()` + AWAIT), `setReadyForMerge()` — plus a second "on-before-mergeable" prompt that queues maintainability/readability/security-audit TODO entries after a session is ready. The issue OP is the canonical text; the code carries it as a verbatim template.

## Why it matters

This prompt *is* the framework's core behavior control: it decouples what the AI thinks it should do from what gets built (anti-laziness), and wires the human-in-the-loop gates. The thread settled key mechanics — macros interpreted by the AI (no token expansion), AWAIT implemented at turn boundaries via `await-*` blocks (PR #338), prompt split into build + post-merge phases, TODO entries over inline preset runs (more reliable) — and exposed a real failure mode: the shipped template silently drifted from the OP once (code synced 11 Jul, OP rewritten 13 Jul), so OP↔code sync is an ongoing duty. Also noted: the shipped prompt is only ~47% OP text (the rest is AWAIT/SIGNAL protocol wiring), and a "commit at the end" instruction was added after dogfooding caught finished sessions leaving work uncommitted.

## Source

Imported from GitHub issue [gemstack-land/the-framework#326](https://github.com/gemstack-land/the-framework/issues/326), created 2026-07-10, label: `the-framework ♻️`, 30 comments.

### Original description

## System prompt

```md
# System prompt

SHOW_MD: Show it via `showMarkdown()`
SHOW_CHOICES: Show it via `showChoices()`
AWAIT: Stop, await user answer before resuming
SESSION_NAME: the name of the session
TODO_FILE: `TODO_AGENTS.md`
ADD_ANALYSIS_ENTRY: Add entry to the ANALYSIS_RESULT.md list

## Analyze the user prompt

Analyze the user prompt, follow the instructions, create ANALYSIS_RESULT.md that lists the analysis results, and show it via showMarkdownSecondary()

### Ambiguous prompt

If it isn't clear what you should do (e.g. unclear scope, unclear user prompt), make a list of interpretations sorted by plausibility, <SHOW_CHOICES>, <AWAIT>

<ADD_ANALYSIS_ENTRY> whether YES/NO the prompt is ambiguous

### Scope

- If the scope of what you'll work on is *large*, create a `PLAN_<SESSION_NAME>.agent.md` of what you'll work on, <SHOW_MD>, <AWAIT>
- If the scope is potentially *very large* (e.g. spans over many hours/days of work), also create a <TODO_FILE> (backlog of follow-up tasks) and <SHOW_MD>

<ADD_ANALYSIS_ENTRY> whether the scope is small, large, or very large


## Before starting changes

Do the following before applying your first change.

### Session name

1. If the repository has uncommitted changes, create a commit "[The Framework] Uncommited changes"
2. Create a <SESSION_NAME> as a string [a-z0-9-]+ that succinctly represents the intention of the user prompt
3. Create a new branch `the-framework/<SESSION_NAME>` and `$ git checkout` it — do all the work in that branch
4. Call setSessionName(<SESSION_NAME>)


## Before applying changes

Do the following before applying changes — do it again anytime you make new changes.

### Alternatives

Measure "variability":
- List all high-level problems that you're about to solve
- Give a rating to each problem (from 0 to 10) following this criteria: is there an obviously optimal way to solve the problem (10), or is it highly unclear whether the problem can be solved in a better way (0)?
- Explore and suggest alternatives for problems with a low rating
- For each problem that has alternatives: list all alternatives sorted in a sensible order, <SHOW_CHOICES>, <AWAIT>


## After applying changes

After you're done, consider whether <SESSION_NAME> is finished and there isn't any work left to do — if that's the case then call setReadyForMerge()



# User prompt

${{tf.prompt}}
```

> [!NOTE]
> The idea of `showMarkdownSecondary()` is to show the markdown in a less prominent way than `showMarkdown()`. For the MVP, we can make both equivalent.

## On-before-mergeable prompt

```md
TODO_FILE: `TODO_AGENTS.md`

## Maintenance

If the changes introduced by ${{ tf.session_name }} aren't trivial and have refactor potential, add the following to <TODO_FILE>
- `Apply ${{ tf.presets.maintainability.filePath }} with tf.params.what set to "changes introduced by ${{ tf.session_name }}"`
${{ !tf.settings.technical_control ? '' : (`
- `Apply ${{ tf.presets.readability.filePath }} with tf.params.what set to "changes introduced by ${{ tf.session_name }}"`
`.trim() + '\n') }}

If the changes introduced by ${{ tf.session_name }} can potentially lead to security issues, add the following to <TODO_FILE>
- `Apply ${{ tf.presets.security_audit.filePath }} with tf.params.what set to "changes introduced by ${{ tf.session_name }}"`
```

> [!NOTE]
> Same presets as the buttons show in the UI.

> [!NOTE]
> In the future (post-MVP):
> - New user setting `[ ] Eager post-merge maintenance` => the TODO_AGENTS.md entries added by the on-before-mergeable prompts are fired optimistically as soon as `setReadyForMerge()` is fired (even before human review)
> - Otherwise, these TODO_AGENTS.md entries are only fired after actual merge
> 
> Merge conflicts are easy for AI to resolve — parallelizing the maintenance/readability refactor is worth it, I guess.
> 
> MVP shortcuts welcome. For example, we can skip the user setting — or whatever you think can make us move faster.



## See also

- https://github.com/gemstack-land/gemstack/issues/323
- https://github.com/gemstack-land/gemstack/issues/297#issuecomment-4913683778
- https://github.com/gemstack-land/gemstack/issues/331
- https://github.com/gemstack-land/gemstack/issues/361
- https://github.com/gemstack-land/gemstack/issues/360
- https://github.com/gemstack-land/gemstack/issues/461

### Notes from the GitHub thread

- Agent-facing verbs: `showMarkdown()`, `showChoices()` (pick one), `showMultiSelect()` (pick several). Macros are interpreted by the AI directly — no token expansion needed.
- AWAIT mechanics: the driver runs each turn as a black box, so mid-turn pause is impossible; the agent instead ends its turn with a small `await-choices` block, the framework detects it at the turn boundary, gates, and reseeds the next turn with the answer (PR #338, reusing the plan-approval / multi-select gates).
- The prompt was split in two: build phase + post-merge phase fired after `setReadyForMerge()` (new actions: `setReadyForMerge()`, `setSessionName()`; UI shows orange dot while building, green when ready). Post-merge quality work is recorded as TODO entries rather than run inline — judged more reliable, and applied after merge to keep PRs focused and reviewable.
- PR #547 reality check: the shipped every-run prompt is 3,874 chars — 47% from this OP, the rest being `AWAIT_PROTOCOL` (1,415) + `SIGNAL_PROTOCOL` (623); the bootstrap preamble was removed. Personas/skills/memory framing gone (down from 8,852).
- Sync failure mode: the code template (last synced 11 Jul, #355) drifted from the OP (rewritten 13 Jul) despite a "keep byte-identical, change it there first" comment; #551 moves the text into `prompts/*.md` verbatim. `tf.settings.technical_control` didn't exist yet and must be added before the post-merge block can render. `tf.session_name` is set before changes begin, early enough for the post-merge block.
- Dogfooding gap: the prompt told the agent to commit before starting but never at the end, so finished sessions left work uncommitted; an "After you're done, commit your changes" line was agreed (the framework also commits leftovers itself before retiring a worktree, #786).
