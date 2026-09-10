The landing page of https://the-framework.ai and the pieces every page of the site is built from. The page is one scroll that makes the product's argument in order: the pitch and how to run it, why babysitting a coding agent [1] is the problem, what runs without a human, the two building blocks behind that, the features, what the visitor keeps control of, and where to join. `styles.css` holds the site's stylesheet and carries no business logic.

## Context

**User story**: someone hears about The Framework and opens the site. In one screen they get the pitch and the one command that runs it; scrolling, they learn what the product claims and where to try it, join the community, or read the code.

## Glossary

[1] coding agent: the CLI doing the actual work: Claude Code or Codex.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, handed off when it ends.
[3] the agent queue: the priority-ordered list of what agents will work on next.

## Business logic — TL;DR

- **The page's order** (`+Page.tsx`) - the sections are assembled top to bottom in the order the argument is made, and the order is the page's meaning: pitch, problem, autonomy, mechanism, features, control, invitation.
- **The pitch and the command** (`Hero.tsx`) - "Babysit AI" crossed out for "Autonomous AI", the tagline, the badges, and a "Try:" box carrying the one-shot command, so the fastest path to running the product is on the first screen.
- **Navigating the chapters** (`SectionNav.tsx`) - a bar of links to the five chapters that sticks to the top while scrolling, highlights the chapter being read, and keeps the address bar's fragment in step so a link can be copied mid-page.
- **The problem** (`StopBabysitting.tsx`) - the site's core argument: five ways a coding agent [1] lets its user down, the bad fix people try, and The Framework's solution for each.
- **What runs without a human** (`AutonomousAi.tsx`) - the claims about what AI does on its own under The Framework, followed by the reassurances that bound them.
- **The two building blocks** (`HowItWorks.tsx`, `EnhancedSystemPrompt.tsx`, `Queues.tsx`, `Prompts.tsx`) - the enhanced system prompt and the queues, side by side, closed by the note that the prompts are open source and can be replaced with the visitor's own.
- **The features** (`Features.tsx`) - eight cards, each a claim with a one-sentence explanation, marked "Coming soon" where the feature is not shipped.
- **What the visitor keeps** (`YourFramework.tsx`) - the promises that it is the visitor's framework: only the features they pick, and nothing forced.
- **The invitation** (`Cta.tsx`, `TopNav.tsx`, `Footer.tsx`) - the closing call to join the Discord server or star the repository, and the navigation and footer that carry the same three addresses on every page of the site.
- **The shared vocabulary** (`ui.tsx`, `icons.tsx`, `copy.ts`) - the visual pieces the sections are drawn from and the three addresses the whole site links to, the Discord, GitHub and npm logos, and the click-to-copy behavior behind every command chip and the hero's "Try:" box.
