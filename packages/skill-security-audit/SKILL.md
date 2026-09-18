---
name: security-audit
description: Audit a part of the code for security issues, exhaustively, fixing each issue found, and open a pull request for a person to review.
disable-model-invocation: true
---

Audit a part of the project for security. Nobody will answer you: never ask, decide yourself. The part is what follows the command: a folder, a file, or a feature in words; when nothing follows it, it is the whole project. Scrutinize all of its code for potential security issues, and make it exhaustive: every file of the part. List every aspect you considered, and give each a verdict, with an explanation when the verdict is not obvious. Fix each security issue you find in its own commit on your branch. Then publish the work: push your branch and open its pull request, its body the list of aspects with their verdicts, and leave the merge to a person. Your last message is the same list. If you find no issue, your last message is the list and you stop, publishing nothing.
