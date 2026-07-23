---
'@gemstack/the-framework': minor
---

Dashboard: semantic status colours, a real Checkbox, a stable Sessions rail, and no emoji glyphs.

The status colours are now four tokens (`--success`, `--warning`, `--danger`, `--info`) tuned per
theme, replacing every raw palette value. Before this, "good" was six different greens, `amber-500`
meant both "stopped" and "building, fine", and the flat `-500` tones sat near 2:1 contrast on the
light canvas.

Checkboxes are a shadcn-style primitive on Base UI instead of bare `<input type="checkbox">`, so
they follow the theme and carry the same focus ring as everything else.

The Sessions rail no longer collapses to a strip when the right rail opens the Browser or Views
tab; its width is now constant.

The ✅/❌/⚠️ glyphs in the Enhanced System Prompt disclosure are replaced by a status dot and plain
text, matching how every other state in the app is drawn.

Sessions rail rows now show which agent ran them, and lead with something that identifies the
session: the agent's own session name or its branch when there is no typed prompt, and the start
time when there is neither. They used to print a bold "(no prompt)" while the timestamp that
actually told them apart sat beside it in small muted text.

A clean git tree's dot is neutral rather than green. Green means "added / new / done" everywhere
else, so a green dot for "nothing changed" sat one pane from the file tree's green dot for "this
folder has changes".

Claude's logo is its own starburst rather than the Anthropic wordmark.
