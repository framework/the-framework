The "New automation" form of the Automations page as data: the draft [3] of an automation [1] while a person types it, what still keeps it from being saved, the words of the command that saves it (`agent-scheduler add`), the sentence its page row [6] would say for when it runs, the words beside its interval, whether anything was typed yet, what trying its check [2] answered (`agent-scheduler try`), what a save answered, and when the saved automation's page row shows. The form itself (`NewAutomation.tsx`) draws what this file says.

## Context

**User story**: on the Automations page the user presses "New automation" and types a name, what the agent is told, and when it runs: every so many minutes, hours, days, weeks or months, by a shell line that prints what is new, or both. Under the fields, one line says what is still missing, and once nothing is, when the automation would run, in the words its page row will use ("Every 15 minutes at most, when someone commented"). "Try it" says whether the shell line would start an agent now. After Save the user reads where the file is and where it has to get to.

**Problem**: a name and a count are typed a key at a time. A half-typed one must not be sent to the command, and must not be said as if it were a time the automation runs.

**Problem**: a prompt may open with a dash, as a list does, and the command line would read such a text as a flag of its own.

**Problem**: the module reads another process's output. An answer that is not what the command promises must not break the form.

**Problem**: the dashboard takes at most 4096 characters in one argument of a command it runs for a module, and the prompt, the check and the plain words each travel as one argument. A longer one would be refused only after Save, in the dashboard's own words.

**Problem**: the page lists what a project's scheduler last recorded, so a saved automation's page row shows only once that scheduler has ticked. Where the scheduler is not running, it does not show at all.

## Glossary

[1] automation: a person's own prompt saved as a command skill of the project (a skill run as the slash command `/<name>`, never picked up by the coding agent on its own): the file `.claude/skills/<name>/SKILL.md`, whose text is the prompt and whose front matter carries the `schedule` the person picked (the key where a skill says when its command is due), an interval [4], a check [2] or both. Written by `agent-scheduler add` or the "New automation" form of the Automations page; from then on a skill like any other, and its command a scheduled command like any other.
[2] check: the shell line a skill's `schedule` gives a scheduled command as `when`: the scheduler runs it in the project, every minute at most, while the command is switched on and the time between two of its starts has passed, when it has one, and starts an agent when it prints something. The form calls it "a shell line".
[3] draft: what the form holds of an automation while a person types it, before anything is saved.
[4] interval: how often at most a scheduled command starts as its skill says it, the `every` of the skill's `schedule`: a count from 1 to 9999 and a unit of minutes, hours, days, weeks or months (`15m`, `1d`).
[5] start point: the commit a scheduled run's checkout starts from: origin's default branch (`origin/main`), or, in a repository with no remote, the commit the person's own checkout is on (`HEAD`). Never the files in a person's own checkout: a skill written there and not committed, or committed and not yet on origin's default branch, is not on the start point.
[6] page row: one line of the Automations page: one scheduled command of one project, with its checkbox and its "Edit".

## Business logic — TL;DR

- **A draft** - a name, a prompt, whether it runs on an interval [4], the interval's count as the text typed and its unit, a check [2], and plain words for what the check waits for; the form opens on no name, no prompt, an interval of 1 day, no check.
- **The draft's interval** - the count and the unit as a skill writes them (`15m`); none while the interval is unticked, or while the count is no whole number from 1 to 9999.
- **What keeps a draft from being saved** - one sentence for the person, the first thing first: no name, a name that is no command's name, a name longer than 64 characters, no prompt, a prompt, a check or plain words longer than 4000 characters, a count that is no number yet, nothing that says when it runs; nothing when it can be saved.
- **The words beside the interval** - "by time alone", "at most, and only when the shell line below prints something", "not on a pace: the shell line below alone says when" or "not on a pace", by whether the interval is ticked and whether there is a check.
- **A draft nothing was typed into** - no name, no prompt, no check and no plain words, whatever the interval holds: closing such a form loses nothing.
- **The command that saves a draft** - `add <name> --prompt=<prompt>`, then `--every=<interval>` when the interval is ticked, `--when=<check>` when there is a check, and `--waits-for=<plain words>` only beside a check; each text one argument together with its flag; none while something keeps the draft from being saved.
- **When a draft would run** - the sentence its page row [6] would say, made by the same rule as every page row's (`schedulers.ts`); none while nothing says when, or while the count is half typed.
- **What a try answered** - what `agent-scheduler try` printed, as the form shows it: what the check printed, the time it was given, and a verdict with its tone: an agent would start, nothing to do, or the line failed and why; an answer that is not what the command promises reads as a line that failed.
- **What a save answered** - what `agent-scheduler add` printed: the file it wrote and where a run's checkout starts; the sentence that says where the file has to get to before its page row [6] can start; and the sentence that says when the page row shows, by whether the project's scheduler is running.

## Business logic

### A draft

#### Context

See `## Context`.

#### Business logic

A draft [3] holds:

- The name: the command's name, without its slash.
- The prompt: what the agent is told.
- Whether the automation runs on an interval [4], and that interval as a count, kept as the text typed, and a unit (minutes, hours, days, weeks or months).
- The check [2]: empty for none.
- Plain words for what the check waits for, which the page row [6] will say.

The form opens on an empty name and an empty prompt, the interval ticked with a count of 1 and days, no check and no plain words: once a day.

The draft's interval, as a skill writes one, is the count and the unit read by the tool's own rule (`../src/pace.ts`): `15m` for 15 and minutes, spaces around the count ignored. It has none while the interval is unticked, and none while the count is not a whole number from 1 to 9999 written in digits alone (empty, `0`, `1.5`).

### What keeps a draft from being saved

#### Context

See the first **Problem** in `## Context`.

#### Business logic

One sentence for the person typing, the first of these that holds; spaces around the name are ignored:

1. The name is empty: "Give it a name. It becomes the command, like /answer-comments."
2. The name is not lower-case letters, digits and dashes, starting with a letter or a digit, with no three dashes in a row (`../src/names.ts`; `Answer comments`, `a---b`): "A name is lower-case letters, digits and dashes, never three dashes in a row, like answer-comments."
3. The name is longer than 64 characters (`../src/names.ts`): "A name is 64 characters at most."
4. The prompt is empty or only whitespace: "Write what the agent is told."
5. The prompt, its surrounding whitespace removed, is longer than 4000 characters: "What the agent is told is <N> characters, and this form takes 4000 at most. Save a shorter one, then write the rest into the file."
6. The check, its surrounding whitespace removed, is longer than 4000 characters: "The shell line is <N> characters, and this form takes 4000 at most."
7. There is a check, and the plain words for what it waits for, their surrounding whitespace removed, are longer than 4000 characters: "What the line waits for is <N> characters, and this form takes 4000 at most." Plain words beside no check are never sent, so their length does not count.
8. The interval is ticked and the draft has no interval yet (above): "Type a whole number, from 1 to 9999."
9. The interval is unticked and there is no check: "Say when it runs: on a pace, by a shell line, or both."

A draft none of these holds for can be saved, and has nothing to tell. A count left half typed does not count once the interval is unticked and a check says when. The two rules for a name are the ones the command itself refuses by (`../src/automation.ts`). The 4000 characters are the form's own limit, under the 4096 the dashboard takes in one argument with the flag before the text: the command line itself takes a longer prompt, which is why the sentence says to write the rest into the file.

### The words beside the interval

#### Context

**Problem**: an interval and a check decide together when an automation runs, and what the interval means changes with the check: alone it is a clock, beside a check it is only a limit. A person who unticks the interval must also see that the count and the unit left in the form no longer count.

#### Business logic

The words the form shows beside the interval's count and unit:

- The interval ticked, no check: "by time alone".
- The interval ticked, a check: "at most, and only when the shell line below prints something".
- The interval unticked, a check: "not on a pace: the shell line below alone says when".
- The interval unticked, no check: "not on a pace".

A check of whitespace alone is no check.

### A draft nothing was typed into

#### Context

**Problem**: Escape is pressed by a slip of a key. Closing a form that holds a prompt would lose it; closing one that holds nothing loses nothing.

#### Business logic

Nothing was typed into a draft when its name, its prompt, its check and its plain words are all empty, exactly: one blank typed counts as typed. The interval does not count: a draft with the interval unticked, or with another count and unit, and no text is still one nothing was typed into. The form lets Escape close only such a draft (`NewAutomation.tsx`).

### The command that saves a draft

#### Context

See the second **Problem** in `## Context`.

#### Business logic

The words after `agent-scheduler`, for a draft that can be saved: `add`, the name, `--prompt=<the prompt>`, then `--every=<the draft's interval>` when the interval is ticked, `--when=<the check>` when there is a check, and `--waits-for=<the plain words>` when there are plain words and a check. The name, the prompt, the check and the plain words each go with their surrounding whitespace removed. Each text is one argument together with its flag, so a prompt that opens with a dash stays the flag's own text. Plain words typed for a check that was then cleared are left out: they say what a check waits for, and there is none. A draft that cannot be saved yet has no such words.

So the form's opening draft with a name and a prompt saves as `add answer-comments --prompt=<prompt> --every=1d`, and one with the interval unticked and a check as `add answer-comments --prompt=<prompt> --when=<check>`.

### When a draft would run

#### Context

**User story**: before saving, the user reads when the automation would run, said the way its page row [6] will say it, so nothing reads differently once it is listed.

#### Business logic

The sentence is the one `schedulers.ts` makes for a scheduled command at its skill's own pace: the draft's interval and its check, with the plain words when there are both plain words and a check. So:

- An interval alone: "Every 1 day".
- An interval and a check: "Every 15 minutes at most, when its check finds work", or with plain words "Every 15 minutes at most, when someone commented".
- A check alone: "When its check finds work", or with plain words "When someone commented".

There is no sentence while the draft has neither an interval nor a check, and none while the interval is ticked and its count is no number yet, also beside a check. The sentence does not name the command, so it is there before a name is typed.

### What a try answered

#### Context

See the third **Problem** in `## Context`.

#### Business logic

What `agent-scheduler try` printed (`../src/cli.ts`) is read into what the form shows:

- The time the check [2] was given as `$LAST_RUN`, when the answer holds one as text.
- What the check printed, when the answer holds it as text, else nothing.
- A verdict and its tone, by the first that holds:
  1. The answer does not say the check ran: "The line failed: <the error>" when the answer holds an error that is not empty, else "The line failed."; the tone is failed.
  2. The answer says an agent would start: "It printed something: an agent would start now."; the tone is start.
  3. Otherwise: "It printed nothing to do: no agent would start."; the tone is quiet.

The reading is forgiving: an answer that is no object, or whose fields are not what the command promises (a `ran` that is a word, a `printed` that is a number), reads as "The line failed." with nothing printed.

### What a save answered

#### Context

**Problem**: saving writes a file into the person's own checkout, and a scheduled run's checkout is made from the start point [5]. A person who is not told would switch the new page row on and wait for an agent that cannot start.

See also the last **Problem** in `## Context`.

#### Business logic

What `agent-scheduler add` printed (`../src/cli.ts`) is read as the file it wrote, as a path from the repository root, and where a run's checkout starts, the start point [5] by name. An answer without the file reads as "a skill file", and one without the start point's name as `HEAD`.

The sentence that says where the file has to get to follows that name: "Its row cannot start before the file is on <start point>: commit it and bring it there." ("Its row cannot start before the file is on origin/main: commit it and bring it there."), or, for `HEAD`, as in a repository with no remote, "Its row cannot start before you commit the file."

The sentence that says when the saved automation's page row [6] shows follows whether the project's scheduler is running, which the page tells the form: "Its row shows here once the scheduler has looked, within a minute. It starts switched off." where it is; "The scheduler is not running in this project, so its row does not show yet: it shows once the scheduler runs. It starts switched off." where it is not.
