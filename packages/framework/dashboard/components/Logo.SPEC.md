The Framework's brand mark, a six-strand hexknot, which doubles as the dashboard's at-a-glance signal of whether any agent is currently working.

## Business logic — TL;DR

- **Idle mark** - at rest the six strands are painted in the brand's neutral ramp, in values chosen per theme so the mark stays legible on both a light and a dark background.
- **Working mark** - while an agent is running, the same strands are painted with the brand's six hues sweeping along them in a continuous six-second cycle. The shape never moves; only its colour says the AI is at work.
- **It says which state it is in** - hovering the mark reads "AI is working for you 🚀" or "AI isn't working for you 💤"; the same sentence without the emoji is what a screen reader announces, since reading out "rocket" helps nobody.

## Business logic

### The mark tells the user whether the AI is working

#### User story

The user leaves the dashboard open in a background tab and wants to know, from the tab alone, whether their agents are working for them right now.

#### Business logic

The mark takes one fact — is any agent running — and paints itself accordingly: neutral when nothing is running, cycling through the brand's six hues when something is. It is also the tab's icon and the source of the tab's tooltip, so the answer is available without switching to the dashboard.

#### Rationale

The idle strands carry per-theme brand values rather than a single fixed ramp because the shipped ramp runs from near-black to mid-grey, and its leading strands would sink into a dark background. They are opaque flat fills rather than one colour at varying transparency because a knot's over-and-under crossings are real overlaps: any strand painted below full opacity would show the strand beneath it through the crossing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
