The dashboard's view layer: every page and panel the user sees. The pages: the cross-project Overview (working now, routine work, hot tickets, interventions, activity), a project's home and launcher, one agent's view (its feed of events, changes, gates, chat composer, handoff), the tickets pages, and Settings. Around them: the rails and menus that navigate, the dialogs that configure (devices, Discord, presets), and the notices that explain special agents (cloud, GitHub Actions, remote devices).

Views render projections and fire actions; the state they render and the rules they apply live in `lib/`, the primitives they are assembled from in `ui/`, and the rich prompt editor in `prompt-editor/`.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
