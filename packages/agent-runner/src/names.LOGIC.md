The names the tool hangs off. The tool's own directory is `.agent-runner` at the repository root, hidden from git by the tool itself the first time it takes a run's lock [1]; in it, a `runs/` directory holds one lock and one stderr file per run, and `config.yml` holds the tool's settings for this project on this machine only: the `ended:` line a person wants run when a run needs them (`ended.ts`). The dashboard's directory in a project is `.the-framework`, and its hooks file, where `init` writes the tool's lines, is `.the-framework/hooks.yml`. The tool has no defaults of its own: no model, no state file; `config.yml` is written only by a person.

## Glossary

[1] the run's lock: `.agent-runner/runs/<id>.lock` at the repository root, holding the pid of the one process of the run at work on it.
