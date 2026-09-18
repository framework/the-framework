What the tests cover, with the offset hook itself faked:

- **Setting the spend offset reaches every project with the line** - the points reach each registered project's offset hook in order, a project without the line is skipped, and the answer is success.
- **Every refusal is words** - no project with the line, and no project at all, are "no project has an offset hook in .the-framework/hooks.yml"; a failing line is the error prefixed with the failing project's name ("b: the offset hook: exit 1"); a value that is not a number is "the spend offset must be a number" and runs no line.
