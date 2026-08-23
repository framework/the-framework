What the tests cover: queuing, delivering and withdrawing the answer to a question a cloud session is parked on.

- An answer can only be queued for a cloud session that has a question parked, and only with labels that question offered — any other text is refused with the reason. An ordinary question takes exactly one label: none and several are both refused.
- A question that takes several answers accepts any subset of its labels, the empty one included, and refuses the same label twice.
- What gets typed is composed by the daemon: the wording a local gate resumes with, naming the question and the labels picked, joined together for a multi-select and standing in as a placeholder when nothing was picked.
- Picking an option the agent marked as stopping types the take-over wording instead — the user is taking over and will come back with fresh instructions — while an ordinary pick still says to continue.
- A successful delivery marks the answer sent and drops the parked question; the same question reported again afterwards does not resurface as parked, while a genuinely different question does surface and clears the resolved answer with it.
- A failed delivery keeps the question parked, records the extension's reason, and lets the user queue a new pick that replaces the failed attempt.
- A queued answer can be withdrawn; one already delivered cannot.
- A delivery report that names an older answer is ignored, so a stale report cannot resolve a newer pick or drop the question.
- A pick that was never collected is discarded when the cloud session moves on to a different question, so an answer is never typed into a question nobody asked.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
