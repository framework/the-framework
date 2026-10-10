import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { lineRuns } from './hook-lines.js'

const TOOL = { name: '@openagt/agent-scheduler', commands: ['agent-scheduler'] }

test('a line runs a tool by its bare command, by a path, or by its package\'s name with or without a version', () => {
  for (const line of [
    'agent-scheduler start',
    'npx agent-scheduler start',
    'npx @openagt/agent-scheduler start',
    'npx @openagt/agent-scheduler@0.1 start',
    'npx @openagt/agent-scheduler@^0.1.2 start',
    'FOO=1 agent-scheduler start',
    './node_modules/.bin/agent-scheduler start',
    'node /opt/tools/bin/agent-scheduler start --foreground',
    'cd sub&&agent-scheduler start',
    '"agent-scheduler" stop --unless-keep-alive',
    'echo `agent-scheduler status`',
  ])
    assert.equal(lineRuns(line, TOOL), true, line)
})

test('a name inside another word, and a line that names nothing of the tool, do not run it', () => {
  for (const line of ['npx my-agent-scheduler-wrapper start', 'echo agent-scheduler-is-not-here', 'agent-runner run --detach "$PROMPT"', 'npx @other/agent-scheduler-plus start', ''])
    assert.equal(lineRuns(line, TOOL), false, line)
})
