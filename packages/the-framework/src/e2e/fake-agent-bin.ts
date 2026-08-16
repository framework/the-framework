// The CLI entry the E2E harness hands to createProjectRuntime as `binPath`.
//
// The dashboard spawns a session as `node <binPath> --agent <specPath>`; this entry forwards
// that argv to the real CLI with `FRAMEWORK_FAKE` set on itself, so the spawned child executes the
// complete production session lifecycle (worktree cwd, run store, events.jsonl, control watcher,
// gates, teardown) with the deterministic offline FakeDriver where a real coding agent would be.
// The variable rather than the spec, because the offline driver is a property of *this process*,
// not of the session the dashboard asked for. `FRAMEWORK_FAKE_AWAIT` still scripts a gate turn,
// which is how a story parks a session on a question.
//
// When `$FRAMEWORK_E2E_ARGV_FILE` is set, the spec is appended there as one JSON line per spawn —
// the only way a story can assert that a dashboard toggle actually reached the session, since the
// spawn is detached and its argv is otherwise observable nowhere. Read, not consumed: the CLI
// below removes the file itself.
import { appendFileSync, readFileSync } from 'node:fs'
import { runCli } from '../cli.js'

const args = process.argv.slice(2)
const argvFile = process.env.FRAMEWORK_E2E_ARGV_FILE
if (argvFile) {
  try {
    const specPath = args[args.indexOf('--agent') + 1]
    appendFileSync(argvFile, readFileSync(specPath!, 'utf8').replace(/\s*\n\s*/g, '') + '\n')
  } catch {
    // recording is diagnostics, never a reason to fail the run
  }
}

process.env.FRAMEWORK_FAKE = '1'
runCli(args)
  .then(code => {
    process.exitCode = code
  })
  .catch((err: unknown) => {
    console.error(err)
    process.exitCode = 1
  })
