// The CLI entry the E2E harness hands to createProjectRuntime as `binPath`.
//
// The daemon spawns a run as `node <binPath> <argv…>`; this entry forwards that argv to the real
// CLI with `--fake` appended, so the spawned child executes the complete production run lifecycle
// (worktree cwd, run store, events.jsonl, control watcher, gates, teardown) with the deterministic
// offline FakeDriver where a real coding agent would be. `FRAMEWORK_FAKE_AWAIT` still scripts a
// gate turn, which is how a story parks a run on a question.
//
// When `$FRAMEWORK_E2E_ARGV_FILE` is set, the argv is appended there as one JSON line per spawn —
// the only way a story can assert that a dashboard toggle actually became the run flag it maps to,
// since the spawn is detached and its argv is otherwise observable nowhere.
import { appendFileSync } from 'node:fs'
import { runCli } from '../cli.js'

const args = process.argv.slice(2)
const argvFile = process.env.FRAMEWORK_E2E_ARGV_FILE
if (argvFile) {
  try {
    appendFileSync(argvFile, JSON.stringify(args) + '\n')
  } catch {
    // recording is diagnostics, never a reason to fail the run
  }
}

runCli([...args, '--fake'])
  .then(code => {
    process.exitCode = code
  })
  .catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
