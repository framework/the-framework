What the tests cover: what an agent handed to a Claude Code cloud session shows.

The notice itself:

- Before the hand-off names a cloud session, it says one is being started and offers no links.
- Once the cloud session is known, it links through to that session and offers the copyable command that brings the work back to this machine.
- It states that the cloud session opens its own pull request and asks its questions over there, since nothing streams back to the dashboard.
- It shows nothing at all for the other run targets.

The parked question the bridge reports:

- The question, its options, and which option is recommended are shown once the bridge has one, asked for by cloud session id.
- The link out stays available as the manual way to answer.
- With no question parked, nothing extra appears; before the hand-off lands, the bridge is not asked at all.

Answering from the dashboard:

- Picking an option is not enough — the answer is only sent once confirmed, and the confirm control is unavailable until something is picked.
- A queued answer reads as on its way and can still be withdrawn; the question card yields to it, so a second pick cannot race the first.
- A delivered answer reads as answered, with no withdraw offered.
- A failed delivery says what failed and why, and offers the question again.

The mirror at the tail of the log:

- It shows what the cloud session has said, in order, inside one box labelled as a mirror, so a scrape never reads as the agent's own event log.
- Before anything is scraped it shows a connecting placeholder, so a `web` agent never shows dead air.
- Claude's own interface text that the scrape drags in is dropped, while ordinary messages that merely mention a model or arrow keys are left untouched; the gaps left behind are collapsed, and a block that is nothing but interface text scrubs to nothing.
- It renders nothing before the hand-off or for other run targets, and the notice pane does not duplicate it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
