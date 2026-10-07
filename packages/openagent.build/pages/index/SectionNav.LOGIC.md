The landing page's section navigation: a bar of links to the page's five chapters that sticks to the top of the screen as the visitor scrolls, highlights the chapter being read, keeps the address bar's fragment in step with it so the address can be copied mid-page, and offers a back-to-top logo once it is stuck. On screens narrower than 860 pixels the bar, and the "On this page" label above it, are not shown at all (the rule lives in `styles.css`).

## Context

**User story**: a visitor scrolling the landing page always sees where they are, jumps to any chapter in one click, and can share the address of the chapter they are reading.

## Business logic — TL;DR

- **Five chapters** - "Stop babysitting", "Autonomous AI", "How it works", "Features" and "Your framework", each link scrolling smoothly to its chapter, which lands just under the bar.
- **The chapter being read is highlighted** - the last chapter whose top has passed a line a little above the middle of the screen; nothing is highlighted at the very bottom of the page.
- **The address follows the chapter** - the URL's fragment is replaced with the highlighted chapter's, without adding browser history, and cleared when none is highlighted.
- **The bar sticks, then shows a way back up** - the bar stays at the top of the screen once scrolled past, turning translucent, and only then shows the logo as a back-to-top link.

## Business logic

### Five chapters

#### Context

See `## Context`.

#### Business logic

Below the hero, a label "On this page" introduces the bar. The bar lists, in page order, "Stop babysitting", "Autonomous AI", "How it works", "Features" and "Your framework" (with "Your" in italics), each a link to the chapter's fragment: `#stop-babysitting`, `#autonomous-ai`, `#how-it-works`, `#features`, `#your-framework`. Clicking one scrolls smoothly to the chapter, which comes to rest 76 pixels below the top of the screen, that is, just under the stuck bar rather than hidden behind it (the smooth scrolling and the landing offset live in `styles.css`). The closing call to action and the footer have no entry.

### The chapter being read is highlighted

#### Context

See `## Context`.

#### Business logic

On every scroll, and once when the page loads, the highlighted chapter is recomputed: it is the last chapter in page order whose top edge is at or above the spy line, a line 55% of the screen height down from the top and never higher than 130 pixels from it. A chapter thus claims the highlight as soon as its content crosses just below the middle of the screen, and a chapter link that has just been clicked is highlighted by the time the scroll lands. When the visitor is within 120 pixels of the bottom of the page, where the closing call to action is, no chapter is highlighted. Above the first chapter, none is highlighted either.

### The address follows the chapter

#### Context

**User story**: a visitor copies the address from the address bar while reading "Features", and the person they send it to lands on "Features".

#### Business logic

Whenever the highlighted chapter changes, the URL's fragment is replaced with that chapter's fragment, and removed altogether when no chapter is highlighted. The replacement never adds an entry to the browser's history, so the Back button is not filled with chapters. A chapter link clicked by the visitor navigates normally, which adds one history entry for the click itself.

### The bar sticks, then shows a way back up

#### Context

**User story**: having scrolled deep into the page, the visitor returns to the top in one click.

#### Business logic

The bar sticks to the top edge of the screen once the page has scrolled past it; while stuck it turns translucent over the content behind it and drops its top border. Only while stuck does the logo at the bar's left fade in as a link titled "Back to top": when the bar is in its resting place the logo is invisible, cannot be clicked, is skipped by keyboard navigation and is hidden from screen readers, and its slot is kept so that the chapter links never shift. Clicking the logo scrolls smoothly to the top of the page without changing the address; as the top is reached, no chapter is highlighted and the fragment is removed.
