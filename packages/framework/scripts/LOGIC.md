The two scripts the framework package's own build, test and type-check commands call: the generator that turns the prompt markdown into the module the code imports, which is what makes the markdown the only source of truth of what an agent [1] is told, and the test runner that keeps the package's test suite away from the machine's real configuration. `gen-prompts.BUG-ANALYSIS.md` and `run-tests.BUG-ANALYSIS.md` are analysis notes holding only the date of their last analysis and carry no business logic.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] skill: one of the four capabilities an agent is taught (`branches`, `tickets`, `queue`, `logs`), each a package with the instructions the agent reads (its `SKILL.md`), a command on the agent's PATH, and an API the product calls.

## Business logic — TL;DR

- **Compiling the prompts** (`gen-prompts.mjs`) - every `.md` under `prompts/` except `README.md` and the `LOGIC.md` files, plus the `SKILL.md` of the `tickets`, `queue` and `logs` skills [2] with their front matter dropped, become string constants named after their paths in the git-ignored `src/prompts.generated.ts`, regenerated before every build, test, type check and development watch, so the markdown can never drift from what the code sends.
- **Running the tests in isolation** (`run-tests.mjs`) - the compiled test suite runs under Node's test runner against a throwaway configuration home, so no test reads the real registry or attaches to a live daemon, with 60 seconds per test and the runner's exit code reported as the script's own.
