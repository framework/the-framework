---
"@gemstack/framework": minor
---

Add the [Security audit] preset (#461): an exhaustive, direct security pass over a target (defaults to `this PR`), shipped alongside [Research], [Readability], and [Maintainability]. It lists every aspect considered with a per-aspect verdict and fixes each issue in its own commit. Available as a dashboard Start-a-run button and exported as `renderSecurityAuditPrompt`. It is also the third of the post-merge quality prompts #326 fires on `setReadyForMerge()`.
