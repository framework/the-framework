---
'@gemstack/framework': minor
---

Custom presets can now be saved to a project, not just to you. When you create a preset with a project open, a "Save to" choice lets you keep it private (as before) or commit it into the repo's `.the-framework/custom-presets.json`, so everyone who clones the project gets it. Shared presets show up in their own "Project presets" group in the Presets menu and under `/` in the editor, and delete from there. Personal presets still live in your home config and follow you across every project.
