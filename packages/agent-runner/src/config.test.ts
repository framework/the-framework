import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readPersonal } from './config.js'

async function project(config?: string): Promise<string> {
  const repo = await mkdtemp(join(tmpdir(), 'agent-runner-config-'))
  if (config !== undefined) {
    await mkdir(join(repo, '.agent-runner'))
    await writeFile(join(repo, '.agent-runner', 'config.yml'), config)
  }
  return repo
}

const OFF = { memory: false, connectors: false, skills: false }

test('a run loads a part of the person\'s own setup only when this machine\'s `personal:` turns it on', async () => {
  const log: string[] = []
  assert.deepEqual(await readPersonal(await project(), l => log.push(l)), OFF, 'no file: all off')
  assert.deepEqual(await readPersonal(await project('ended: echo hi\n'), l => log.push(l)), OFF, 'no map: all off')
  assert.deepEqual(await readPersonal(await project('personal:\n  memory: on\n'), l => log.push(l)), { ...OFF, memory: true }, 'one part on, the others off')
  assert.deepEqual(await readPersonal(await project('personal:\n  memory: on\n  connectors: True\n  skills: on\n'), l => log.push(l)), { memory: true, connectors: true, skills: true }, 'YAML true is on too')
  assert.deepEqual(await readPersonal(await project('personal:\n  memory: off\n  connectors: false\n  skills:\n'), l => log.push(l)), OFF)
  assert.equal(log.length, 0)
  assert.deepEqual(await readPersonal(await project('personal:\n  memory: On\n  skills: on\n'), l => log.push(l)), { ...OFF, skills: true }, 'a value neither on nor off: that part off, and said')
  assert.match(log[0]!, /`personal.memory` is not on or off/)
  assert.deepEqual(await readPersonal(await project('personal:\n  plugins: on\n'), l => log.push(l)), OFF, 'an unknown part: said, nothing on')
  assert.match(log[1]!, /`personal` has no part `plugins`; the parts are memory, connectors, skills/)
  assert.deepEqual(await readPersonal(await project('personal: on\n'), l => log.push(l)), OFF, 'not a map: all off, and said')
  assert.match(log[2]!, /`personal` is not a map of memory, connectors, skills/)
  assert.deepEqual(await readPersonal(await project('personal: "unclosed\n'), l => log.push(l)), OFF, 'a broken file: all off, and said')
  assert.equal(log.length, 4)
})
