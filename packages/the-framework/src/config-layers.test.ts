import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  describeResolvedConfig,
  fileConfigLayer,
  resolveConfigKey,
  resolveRunConfig,
  RUN_CONFIG_DEFAULTS,
  type ConfigLayer,
} from './config-layers.js'

// The #800 chain, nearest first.
const chain = (run = {}, project = {}, repo = {}, global = {}): ConfigLayer[] => [
  { name: 'run', values: run },
  { name: 'project', values: project },
  { name: 'the-framework.yml', values: repo },
  { name: 'global', values: global },
]

test('resolveConfigKey takes the nearest layer that set the key (#841)', () => {
  assert.deepEqual(resolveConfigKey(chain({ transparent: false }, { transparent: true }), 'transparent'), {
    value: false,
    from: 'run',
  })
  assert.deepEqual(resolveConfigKey(chain({}, { transparent: true }), 'transparent'), { value: true, from: 'project' })
  assert.deepEqual(resolveConfigKey(chain({}, {}, {}, { transparent: false }), 'transparent'), {
    value: false,
    from: 'global',
  })
})

test('resolveConfigKey ignores layers that left the key unset (#841)', () => {
  assert.equal(resolveConfigKey(chain(), 'transparent'), undefined)
  // An unset key in a nearer layer does not shadow a farther one that set it.
  assert.deepEqual(resolveConfigKey(chain({ technical: true }, {}, { transparent: true }), 'transparent'), {
    value: true,
    from: 'the-framework.yml',
  })
})

test('resolveRunConfig: each layer can win, and each can be absent (#841)', () => {
  for (const layer of ['run', 'project', 'the-framework.yml', 'global']) {
    const layers = chain().map(l => (l.name === layer ? { ...l, values: { transparent: true, preset: layer } } : l))
    const resolved = resolveRunConfig(layers)
    assert.equal(resolved.transparent, true, `${layer} should win autopilot`)
    assert.equal(resolved.presetName, layer)
    assert.equal(resolved.sources.transparent, layer)
  }
  // Every layer absent: the defaults hold and nothing claims a source.
  const bare = resolveRunConfig(chain())
  assert.equal(bare.transparent, RUN_CONFIG_DEFAULTS.transparent)
  assert.equal(bare.vanilla, RUN_CONFIG_DEFAULTS.vanilla)
  assert.equal(bare.transparent, RUN_CONFIG_DEFAULTS.transparent)
  // The handoff defaults to the PR rung (#1102/#1216): a session nobody configured hands itself
  // back, and merging — the one rung above — has to be asked for.
  assert.equal(bare.handoff, 'pr')
  assert.equal(bare.presetName, undefined)
  assert.equal(bare.buildEvent, undefined)
  assert.deepEqual(bare.sources, {})
  // No layers at all resolves the same way as layers that set nothing.
  assert.deepEqual(resolveRunConfig([]), bare)
})

test('resolveRunConfig: a nearer false beats a farther true (#841)', () => {
  const resolved = resolveRunConfig(chain({}, { transparent: false }, { transparent: true }))
  assert.equal(resolved.transparent, false)
  assert.equal(resolved.sources.transparent, 'project')
})

test('fileConfigLayer carries only the keys the-framework.yml set', () => {
  assert.deepEqual(fileConfigLayer({}), { name: 'the-framework.yml', values: {} })
  assert.deepEqual(fileConfigLayer({ transparent: false, preset: 'software-development' }).values, {
    transparent: false,
    preset: 'software-development',
  })
  // `event` is the file's name for the build event key.
  assert.deepEqual(fileConfigLayer({ event: 'bug-fix' }).values, { event: 'bug-fix' })
  assert.equal(fileConfigLayer({}, 'other.yml').name, 'other.yml')
})

test('describeResolvedConfig narrates which layer won each key (#841)', () => {
  assert.equal(describeResolvedConfig(resolveRunConfig(chain())), '')
  assert.equal(
    describeResolvedConfig(resolveRunConfig(chain({ transparent: false }, {}, { transparent: true, preset: 'software-development' }))),
    'preset=software-development (the-framework.yml), transparent=off (run)',
  )
  assert.equal(
    describeResolvedConfig(resolveRunConfig(chain({}, {}, { event: 'bug-fix', transparent: true }))),
    'transparent=on (the-framework.yml), event=bug-fix (the-framework.yml)',
  )
})
