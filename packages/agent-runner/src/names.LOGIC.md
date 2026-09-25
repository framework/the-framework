The names the tool hangs off. The tool's own directory is `.agent-runner` at the repository root, hidden from git by the tool itself the first time it takes a run's lock [1]; in it, a `runs/` directory holds one lock and one stderr file per run. The dashboard's directory in a project is `.the-framework`, and its hooks file, where `init` writes the tool's lines, is `.the-framework/hooks.yml`. The tool has no defaults of its own: no model, no state file.

## Glossary

[1] the run's lock: `.agent-runner/runs/<id>.lock` at the repository root, holding the pid of the one process of the run at work on it.
