The app's left sidebar, present on every route: brand, global navigation (New, Overview, Tickets, Projects), the recent-agents rail, and the utility footer.

## Flows

- "New" adapts to what exists: no projects prompts to add one, one project starts there, several open a picker; inside a project it starts another agent there.
- The rail lists the selected project's agents — or, on the Overview, every project's pooled newest-first, each row naming its project and jumping into it.
- A row says what its agent is really doing: pulsing while it works, a still "waiting" when parked on the user, "publishing…" while an ended one still pushes or opens its PR, "in cloud" for a web agent continuing elsewhere — plus device/cloud glyphs and the driver's logo.
- Clicking Start immediately seeds a provisional "starting…" row; it retires when the real agent lands, whatever state it lands in, and a deadline stops a start that produced nothing from pretending forever.
- The Overview item carries the Human Queue count — how many items across every project await a person.
- A project the daemon has found something wrong with — its data branch (`tf-data`, where the framework archives its records) cannot reach origin — gets a red dot in the Projects list, naming the error on hover.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
