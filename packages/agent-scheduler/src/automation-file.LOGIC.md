The file of a person's own automation [1], written and read back: what an automation is made of as a person fills it in, the skill file it becomes, the same for a shared automation and for one kept on this machine, how a file is read back as an automation, which it is only when it reads as the tool writes one, whether a skill's folder in the project is what saving a shared automation makes, and whether a path is a file and no link. The save, the save again and the removal of an automation (`automation.ts`) and the reader of the schedule (`schedule.ts`) both go through here.

## Context

**User story**: a person saved an automation named `answer-comments`. Weeks later they want other words in its prompt. They press "Edit prompt" on the Automations page, or run `agent-scheduler show answer-comments` and then `agent-scheduler edit answer-comments --prompt …`: the tool reads the file back into the name, the prompt, the interval [4] and the check [2] they typed, and writes the file anew with the change. When they no longer want it, "Remove" or `agent-scheduler remove answer-comments` deletes it.

**User story**: a teammate wrote a skill by hand that schedules itself, with a script beside its `SKILL.md`. Another skill of the project comes from a package and is a link. And the person opened the file of their own automation in an editor and added `agents: 3` to its `schedule` [3]. None of the three has "Edit prompt" or "Remove", and `show`, `edit` and `remove` refuse each of them: they are edited and removed by hand. Another person changed, in an editor, the words of the prompt in the file of their automation, its first line too: that file still reads as the tool writes one, and they keep "Edit prompt" and "Remove".

**Business logic story**: the tool names no command of its own: a scheduled command is read from a file, and when it is due from the `schedule` [3] in that file's front matter (`schedule.ts`). So an automation is saved as a skill's file, and nothing but that file says it is an automation: the tool keeps no list of the automations it saved. Whether the tool shows, rewrites or deletes a file is therefore decided from the file alone, every time: the file is an automation while it reads as the tool writes one ("Reading a file back as an automation", below).

**Problem**: saving an automation again writes its whole file anew, from a name, a prompt, an interval, a check and one plain line. A file that holds anything else (a key the tool does not write, a description a person wrote their own way, a comment) would lose it. And a skill a person or a package wrote must never be rewritten or deleted because its front matter happens to hold a `schedule`.

## Glossary

[1] automation: a person's own prompt saved as a scheduled command, with the `schedule` [3] the person picked, an interval [4], a check [2] or both. Written by `agent-scheduler add` or the "New automation" form of the Automations page, as one of two kinds, the person's choice. While its file reads as the tool writes one, the tool shows it, saves it again under its name and removes it (`agent-scheduler show`, `edit` and `remove`, or "Edit prompt" and "Remove" on the Automations page); an automation whose file was changed by hand into something the tool does not write is edited and removed by hand. A shared automation is a command skill of the project (a skill run as the slash command `/<name>`, never picked up by the coding agent on its own): the file `.claude/skills/<name>/SKILL.md`, whose text is the prompt and whose front matter carries that `schedule`; the person commits it, and from then on it is a skill like any other, and its command a scheduled command like any other. An automation kept on this machine is one file written the same way, `.agent-scheduler/automations/<name>.md`, in the tool's own folder, which is hidden from git: nothing is to commit and nobody else gets its command, though its text is in the record of each of its runs, which is shared where the project shares its records. It is no skill and no slash command: its command is listed, switched and started like any other scheduled command, a run of it has the automation's name as its prompt, with no slash, and is handed the file's text with it, its runs are counted on this machine alone (where a command's runs in flight or its last start are said to be counted on any machine, for it that is this machine's), and what is said of a command's skill (the interval and the check its skill gives, its skill's number of agents, what its skill says it does) is, for it, said of that file.
[2] check: the shell command line a skill's `schedule` [3] gives a command as `when`, run at the repository root on every tick of the scheduler; its output says whether the command is due. It may read `$LAST_RUN`: the time of its command's last start, or the time the command was switched on on this machine when that is later.
[3] the skill's `schedule`: the key `schedule` in the front matter of a skill's `SKILL.md`, where the skill says which commands it schedules and when each is due.
[4] interval: the `every` key of a skill's `schedule` [3]: the least time since the command's last start before it may start again, on a machine where no person set another pace.

## Business logic — TL;DR

- **What an automation is made of** - a name, a prompt, and at least one of an interval [4] and a check [2], with one optional plain line saying what the check waits for.
- **The skill file of an automation** - the same file for a shared automation and for one kept on this machine: the front matter, then the prompt: `name`, `description` (the prompt's first line, cut at 150 whole characters), `disable-model-invocation: true`, and a `schedule` [3] of one row with `every`, `waits-for` and `when`, each only when given. Every text the person typed is written as a quoted value in which whatever could end the value, the line or the front matter is an escape, three dashes in a row among them. The check alone stands as a block, line for line as typed, where a block holds it as typed; otherwise it is quoted too.
- **Reading a file back as an automation** - given a name and a file's text: the interval, the check and the plain line are read from the `schedule` in the front matter, and the prompt is the text after it; the skill file of that automation is then written again and compared with the file, each without its `description` line. The file reads as the tool writes one, and is that automation, when its third line is a `description` of one quoted text with nothing after it and everything else is the same, character for character; any other file is none: a skill somebody wrote, or an automation changed by hand into something the tool does not write. What the description says does not count: it is the prompt's first line, written anew with every save.
- **A skill folder that stands alone** - `.claude/skills/<name>` is a folder and no link, its `SKILL.md` is a file and no link, and the folder holds nothing else but what a file manager leaves behind, a `.DS_Store`: what saving a shared automation makes. A skill that is a link, and a skill with a script beside its file, do not stand alone, whatever the file says.
- **A plain file** - a path that is a file itself and no link to one; anything else, and a path that cannot be looked at, is none.

## Business logic

### What an automation is made of

#### Context

See `## Context`.

#### Business logic

An automation [1], as a person fills it in, is:

- A name: the command's name without its slash. It is also the name of the skill's folder for a shared automation, and of the file for one kept on this machine.
- A prompt: what the agent is told, the skill's whole text.
- An interval [4], optional, as a skill writes it (`15m`, `1d`).
- A check [2], optional: a shell line.
- One plain line saying what the check waits for (`when someone commented`), optional.

It has no word after its name and no number of agents at once: its file schedules one command, named as the automation, that one agent runs at a time until a person sets another number for their machine.

Whether it is shared with the project or kept on this machine is no part of the automation as filled in: it is said when the automation is saved (`automation.ts`), and the file written is the same.

### The skill file of an automation

#### Context

**Problem**: the front matter is read twice, by two readers. The tick reads it as YAML. A coding agent's harness finds it more loosely: for it the front matter ends at the first three dashes in a row it meets anywhere, even in the middle of a line. A person types free text into it: a prompt's first line, plain words, a shell line with quotes, colons, pipes and sometimes several lines. Written as typed, such a text could end the front matter early for the agent, add or change another key (`disable-model-invocation: false`, `allowed-tools: …`), or read back as something else than was typed.

**Problem**: the Automations page says beside each command what its skill says it does, which is the `description` of the skill's front matter. A person who typed only a prompt gave none.

#### Business logic

The file is the same for both kinds of automation [1]; only where it is saved differs (`automation.ts`). It is the front matter between two `---` lines, an empty line, the prompt with its surrounding whitespace removed, and a final line break. The front matter holds, in this order:

- `name`: the automation's name, as it is.
- `description`: the first line of the prompt, surrounding whitespace removed, written quoted (below). A first line longer than 150 characters is cut to its first 149 and "…". The cut counts whole characters, so it never goes through an emoji. Only the description is cut: the prompt below is whole.
- `disable-model-invocation: true`, which makes the skill a command: the coding agent runs it only when told `/<name>`. In the file of an automation kept on this machine the line changes nothing: that file is in no folder a coding agent reads.
- `schedule`, one row with these keys, each only when the automation has it:
  - `every`: the interval [4]. One of the tool's own shape, digits and a unit (`15m`), stands as it is; anything else typed there (`often`) is written quoted, and the reader then says what is wrong with it.
  - `waits-for`: the plain line, surrounding whitespace removed, written quoted.
  - `when`: the check [2], surrounding whitespace removed, as a block or quoted (below).
  
  An automation with none of the three is written `schedule: {}`, an empty row, which the reader of the schedule refuses in its own words (`automation.ts`).

A quoted value is the text between double quotes on one line, with every character that could end the value, the line or the front matter written as an escape: a double quote, a backslash, a line end, a tab and every other control character, the two Unicode line ends, the byte order mark. Three dashes in a row are written as two dashes and, in place of the third, its escape (a backslash, the letter `u` and the digits `002d`), so no three dashes stand in the value. A quoted value reads back as exactly the text. So a description of "Review open PRs --- only mine" keeps its dashes for whoever reads the value, and the agent's reader still sees the whole front matter.

The check stands as a block (`when: |-` and the check's lines under it, indented, an empty line left empty) where a block holds it line for line as typed, the way the skills write theirs: it holds no character a quoted value would escape but plain line ends (no tab, no other control character, neither Unicode line end, no byte order mark), its first line does not open with a blank, no line ends in a blank, and it holds no three dashes in a row. A check with a tab, a line ending in a blank or `echo "---"` is written quoted on one line instead. Either way it reads back through `schedule.ts` as the check that was typed.

Half of a broken character pair (half an emoji, which no file holds as text) is replaced by the replacement character, in the prompt, the description, the plain line and the check.

The prompt is not quoted: it is the skill's text, after the front matter, and a `---` line of its own there is kept as it is.

### Reading a file back as an automation

#### Context

See the business logic story and the **Problem** in `## Context`.

#### Business logic

Reading takes a name and a file's text. The name is the one the file is saved under, the skill's folder for a shared automation and the file's own name for one kept on this machine; the `name` inside the front matter is not what names it.

The text is read in three steps, and the file is no automation as soon as one fails:

1. The text opens with a `---` line and holds a second `---` line further down, each ended by a plain line break. What stands between the two is the front matter.
2. The front matter is YAML, a map of keys, and its `schedule` [3] is a map of keys too: one row, not a list of rows.
3. From that row are taken `every`, whatever it holds, as text; `when`, when it is text; and `waits-for`, when it is text. The prompt is everything after the second `---` line, its surrounding whitespace removed. With the name, these are an automation as a person fills one in ("What an automation is made of", above).

Then the skill file of that automation is written again, by the rule above, and the two texts are compared, each without its third line. The third line is where the tool writes the `description`, after the opening `---` line and the `name`. The file reads as the tool writes one, and is that automation, when both hold:

- The file's third line is a `description` written as the tool writes it: `description: `, then one quoted value, whole, and nothing after it. What follows the closing quote, a comment, is a person's writing, and the file is then none.
- Every other line of the file is the same as in the skill file written again, character for character.

When either fails, the file is none.

What the description says is not compared. The tool writes it from the prompt's first line on every save, so a person who changed that first line in the file by hand has a description a line behind and still has an automation: the next save writes the description anew from the prompt. A description written any other way, unquoted, over several lines or with a comment after it, and a file with none, are a person's own writing: such a file is a skill of theirs and no automation.

So a file that was saved from here reads back as the automation that was typed, and so does one whose prompt, interval, check or plain line a person changed by hand in the way the tool would write the new value. And none of these is an automation, though each may be a scheduled command the tick runs:

- A skill a person or a package wrote: its front matter has no `schedule`, or other keys, or its keys in another order, or a `description` that is not one quoted text, alone on the third line.
- An automation changed by hand into something the tool does not write, however little: one more key in its `schedule` (`agents: 3`), a comment, another way of quoting a value, a blank line more, Windows line ends, no `description`.
- A file saved under another name than the `name` in its front matter.

What is read back, written again, is the file itself but for what its description says. So saving an automation again loses nothing a person wrote: only a description that fell behind the prompt is brought up to it.

### A skill folder that stands alone

#### Context

**Problem**: a skill's file can read exactly as an automation's and still be no file the tool may delete. A skill that comes from a package is a link to the package's folder: deleting through it would delete a file of the package. And a skill with scripts beside its `SKILL.md` is more than its file: removing the file would leave the rest behind as a broken skill.

#### Business logic

Given the project and a name, the skill's folder `.claude/skills/<name>` at the repository root stands alone when all three hold:

- The folder is a folder itself, not a link to one.
- `SKILL.md` in it is a plain file (below): a file itself, not a link to one.
- The folder holds nothing but `SKILL.md` and, when there is one, `.DS_Store`: the file a file manager leaves in a folder a person only looked at, which is no part of a skill.

A folder or a file that is missing, or that cannot be looked at, does not stand alone. A folder that holds anything else, a script or a second text, does not either. Only the skill's own folder and its file are held to being no link: the skills folder itself, `.claude/skills`, may be a link to another folder (a project that keeps its skills under `.agents/skills` and links `.claude/skills` to it), and a skill's folder in it stands alone all the same.

That is what saving a shared automation makes (`automation.ts`): a new folder holding one new file. A shared automation is one the tool shows, saves again and removes only while its folder stands alone and its file reads back as an automation (above), which `schedule.ts` asks when it reads the schedule.

### A plain file

#### Context

**Problem**: a link reads like the file it leads to. Writing a file anew through a link, or deleting through it, would reach a file kept somewhere else, outside what the tool saved.

#### Business logic

A path is a plain file when it is a file itself and not a link to one. A folder, a link, whatever it leads to, a path that does not exist and a path that cannot be looked at are none. `schedule.ts` asks it of the file of an automation kept on this machine: that automation is one file in the tool's own folder, with no folder of its own, so its file being a plain file and reading back as an automation (above) is all that decides whether the tool shows it, saves it again and removes it.
