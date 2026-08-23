Told to an agent only when it has a real browser attached: that the browser exists, when to reach for it instead of plain page fetching, and to stay in one page so the user can watch.

## Business logic — TL;DR

- **The agent is told it has a browser** - a real Chrome is attached, with tools to open and navigate pages, click, fill forms, snapshot and run scripts; it is the same browser a human can watch and take over.
- **Browser for seeing and acting, fetching for reading** - the browser is for pages that need JavaScript to render, flows to click through, forms to fill and apps to check; plain page fetching stays the better tool when the agent only needs a page's text.
- **Stay in one page** - the agent navigates within a single page rather than opening new ones, so the user can follow along.

## Business logic

### The agent is told it has a browser

#### User story

The user turned the browser on for this agent so it can look at the running app — and so they can watch it, and take over when it gets stuck.

#### Business logic

The prompt states that this agent has a real Chrome attached and names the actions available in it: opening and navigating pages, clicking, filling, taking snapshots, and evaluating scripts. It also states that this is the same browser a human can watch and take over, which is what makes handing it over at a login wall meaningful.

#### Rationale

The browser reaches the agent as tools it would discover on its own, but nothing in that discovery says to prefer them — so without being told, an agent reaches for plain page fetching and the browser, along with the user's view of it, sits unused.

### Browser for seeing and acting, fetching for reading

#### User story

The user does not want turns spent driving a browser to read text that a fetch would have returned outright.

#### Business logic

The agent is told to use the browser for anything it needs to *see* or *act on*: pages that render their content with JavaScript, a flow it has to click through, a form to fill, an app it is checking actually works. When it only needs to read a page, plain page fetching remains the better tool because it is faster and returns the text directly — the browser is for the cases where fetching would come back with nothing useful, such as a page that is blank until its JavaScript runs.

### Stay in one page

#### User story

The user watches the agent's browser streamed into the dashboard. Work scattered across several pages is work they cannot follow.

#### Business logic

The agent is told to prefer navigating within a single page over opening new ones, so the user can more easily watch it navigate.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
