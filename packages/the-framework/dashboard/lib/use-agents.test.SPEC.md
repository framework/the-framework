What the tests cover: no agents are read until a project is selected; the selected project's agents refresh every two seconds; an explicit refresh shows a just-started agent without waiting for the next tick; switching project immediately empties the list rather than leaving the previous project's agents on screen, and a read still in flight against the previous project can never write its agents into the new one once it lands late; and a read that fails — a restarted daemon, say — keeps the last known agents instead of emptying the list.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
