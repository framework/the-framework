A main agent's [1] plan [2] and the person's approval of it: where the plan's file sits, the question that names one plan and no other, and how the approval is read off the main agent's log.

## Context

**User story**: the user talks to one agent about a piece of work; the agent writes a plan of small tasks and asks "Start the subagents on plan 3f9a1c2b?"; the user reads the plan and picks Approve, or says what to change. No subagent [3] starts before that, and a plan changed after the user's yes needs a new yes.

**Business logic story**: `subagents.ts` saves the plan, shows it, and refuses to start a subagent until this file says the plan is approved. The person's answer reaches a run as a prompt the runner (`agent-runner`) words with `agent-driver`'s continuation prompt [5], and every prompt a run gets is a `start` line in its diary [4].

**Problem**: a start spends money, and an instruction to ask first is one an agent can skip; an approval that named no plan would cover whatever the agent saves afterwards; and the same diary holds prompts that are not the person's answer: a subagent's end, sent by the runner, quotes that subagent's last words.

## Glossary

[1] main agent: the run whose agent calls the command: the run named by `AGENT_ID` in the caller's environment, which the runner sets for every agent it starts.
[2] plan: the main agent's list of tasks for its subagents, one markdown file, `<run id>.plan.md`, beside the main agent's run record on the `agent-data` branch.
[3] subagent: a run started for a main agent: a run of its own, in its own checkout, on its own branch started from the main agent's, with the main agent as its parent on its record.
[4] diary: the lines a run's session logs while the agent works, kept in the run's checkout under `.openagent/` and copied to the run record when the run ends; a continued run's earlier lines are written back into its checkout first.
[5] continuation prompt: the prompt a run gets when the person answered its question: `You paused to ask: "<question>". The user chose: <answer>. Continue with that decision.`
[6] mark: the first eight hexadecimal digits of the SHA-256 of the plan's text.

## Business logic — TL;DR

- **Where the plan sits** - `agents/<who>/<run id>.plan.md` on the `agent-data` branch: in the directory that holds the run's card, else the one that already holds its plan, else the directory of the person the repository commits as; saved as one commit, "orchestration: plan of run <id>".
- **The plan's question** - `Start the subagents on plan <mark>?`, the mark [6] made from the plan's text, so each text has its own question.
- **Approved** - the main agent's diary [4] in its checkout holds a prompt that begins with the continuation prompt [5] of that question with the answer `Approve`.

## Business logic

### Where the plan sits

#### Context

**Problem**: a main agent's first record may still be on its way to the branch when it saves its plan, and the logs skill deletes a run by removing every file named after its id from the directory of its card.

#### Business logic

The plan [2] is the file `<run id>.plan.md` under `agents/` on the `agent-data` branch. On a save, each person's directory is looked at in turn: the first that holds the run's card or already holds its plan gets the file; when none does, the file goes under the directory of the person the repository commits as, which is where the runner writes that run's card. The save is one commit with the message "orchestration: plan of run <id>", through the branch's write cycle, pushed like any write there; a save that could not be committed at all is an error, one committed but not pushed stands. A save replaces the plan the run had. Reading looks through every person's directory for the file and answers its text, or nothing when the run has no plan.

### The plan's question

#### Context

See `## Context`.

#### Business logic

The question is `Start the subagents on plan <mark>?`, where the mark [6] is made from the plan's exact text. Two plans that differ by one character have different questions; the same text saved again has the same question.

### Approved

#### Context

See `## Context`.

#### Business logic

A plan is approved when the main agent's [1] diary [4], read from its checkout (`.branches/agent-<run id>` under the project), holds a `start` line whose prompt begins with the continuation prompt [5] of the plan's question with the answer `Approve`, word for word. Anything after it on the same prompt (a line the runner adds) does not matter. Nothing else approves: another answer to the question; the person's own typed words, even the word Approve; the answer to another plan's question; a prompt that only contains the sentence further in, as a subagent's [3] end quoting its last words does. An approval stays for as long as the saved plan's text is the one approved.
