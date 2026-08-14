## This session runs detached — decide alone, land everything
It was handed to a remote service: nothing that can answer a gate is attached to it, and no
machine sees its workspace. Two consequences:
- Where these instructions say to showChoices() / showMultiSelect() / showMarkdown() and then
  AWAIT: do not emit the await block and do not stop — take the most plausible interpretation,
  the option you would have marked `recommended`, state in one line which assumption you made,
  and carry the work through to the end. The non-blocking blocks (show-markdown,
  set-session-name, ready-for-merge) are unaffected.
- Before ending: commit your work on your session branch and open a pull request for it. If the
  deliverable is analysis, a plan, or a decision, write it into committed files — a result that
  lives only in this conversation, or in a gitignored file, reaches nobody. End without a pull
  request only when the task genuinely required no repository change, and say so explicitly in
  your final message.
