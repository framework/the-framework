Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating. Keep
outdated decisions (no history).

A bullet is a person's pick, and says what it was picked over. What the code does belongs
in LOGIC.md; a choice made while implementing is the implementer's judgment, not a
decision. An AI proposes a bullet and asks; it never adds or rewrites one.

## The session
- One owner for a session, its log and its steering: the driver starts the coding agent,
  streams what it does, writes the log and reads the inbox, and says when the agent asked.
  Every other piece only passes paths or writes lines. Picked over the runner tailing the
  inbox and detecting the question itself (the session's protocol in two packages), and
  over a steering library imported from The Framework (a tool depending on the product).
- Drain, then end. When a turn ends, every line already waiting in the inbox is sent as a
  further prompt of the same session, and the prompt returns when the inbox is empty; a
  line that comes later is for a new session resumed by its id. Picked over a session that
  waits for the next line: a process would idle while nothing happens, hold a runner's
  cap, and need a rule for when waiting is over. Nothing waits, and the question is a fact
  on the record, not a state in a process.

## The question
- The question is the fenced `await-choices` block The Framework's agents already end a
  turn with, now the driver's contract and parsed here alone; the words that teach an
  agent when to ask are the caller's. Picked over a format of the driver's own (a second
  parser and a second thing for agents to learn) and over no format (a question in free
  text has no options, so nobody-there cannot take the recommended one).

## The log
- The log is written in the run record's shape, a card and a diary, as data the driver
  states and the `logs` skill reads, so a runner copies the two files onto its records
  unchanged and a dashboard reads them live with the reader it has for records. Picked
  over the driver's own event shape converted at the end (two shapes, a converter, and a
  live file nobody else reads).
