What the tests cover: how each kind of event reads as a line in the terminal, and how an answered gate and a session link are interpreted.

- A pick normalises to a list of chosen option ids whether the gate was single-select (one id) or multi-select (a subset), and an empty answer yields nothing chosen.
- A session link template with the session-id placeholder is recognised as a template, has every occurrence of the placeholder filled with the real session id, and a link that is already a plain URL is left untouched.
- A single-select gate prints its question with the recommended option marked; a multi-select gate prints as a checklist with the pre-checked options ticked. A resolved gate names what was chosen and who chose it, and says "(none)" when nothing was picked.
- The armed-handoff line promises exactly what will happen, merge included: a merge-armed agent says it will open a PR and merge it rather than advertising a draft PR; without the merge half — including on older records that predate it — it stays "draft PR"; and merge without a PR is never promised, since it cannot happen.
- Ending is distinguished three ways: finished, stopped, and failed with its detail.
- Spend is shown as a cost over a turn count, with the turn count singular or plural; when the driver reports tokens but no price, the line shows token counts and says no price was reported rather than displaying a zero cost that would read as free.
- Quota lines are phrased by how much the quota state matters — allowed, running low, exhausted — always naming the window and its reset time, and an unrecognised state still renders instead of vanishing.
- A turn's prompt is previewed in the feed rather than announced as "prompt sent", truncated to one line for long prompts. The system prompt is reported by its length, and a session update shows the session id with its link when there is one.
- The post-merge quality step renders each of its outcomes, and every decline names its reason in the reader's terms.
- The merge half of a handoff always gets its own line — merged, auto-merge armed, failed, or withheld with its reason — because after arming a merge, silence about it reads as "it merged". A handoff with no merge half keeps its plain line. A handoff skipped because the branch's pull request already landed the work says so, rather than reporting the work as blocked by an existing pull request.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
