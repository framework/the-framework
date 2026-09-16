What the tests cover, on the schedule's text alone:

- **A schedule line** - `- work-queue: when \`npx queue\`, cap 2` reads as the command, its check and its cap with its line number; a line with no cap reads as cap 1; headings and prose are not read.
- **An interval** - `every 6h` alone, `every 7d, cap 2`, `every 1h` beside a check whose text holds a comma, and the three clauses in any order each read as their command with the duration and the text as written.
- **An unreadable interval** - an unknown unit, `every 0h`, `every` twice, an unknown word beside it, and `every day` are each unreadable.
- **Unreadable lines** - a capitalized name, a line with a cap but no check, and a check without backticks are each kept aside with their line number and text, while the readable line still counts.
- **A cap of zero** - reads as one.
- **Due** - a non-empty JSON array or object, `true` and non-JSON text are due; `[]`, `{}`, `null`, `false`, `""`, no output and blank output are not.
- **The prompt** - a command's prompt is its slash command.
