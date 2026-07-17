import { describe, expect, test } from 'vitest'
import type { Activity } from '@gemstack/framework'
import { activityKey, pickNewActivity } from './activity.js'

const started: Activity = { projectId: 'a', projectName: 'a', runId: 'r1', kind: 'started' }
const finished: Activity = { projectId: 'a', projectName: 'a', runId: 'r1', kind: 'finished' }

describe('activity helpers (#627)', () => {
  test('activityKey separates a run start from its finish', () => {
    expect(activityKey(started)).toBe('started:a:r1')
    expect(activityKey(finished)).toBe('finished:a:r1')
  })

  test('pickNewActivity returns only unseen keys', () => {
    const seen = new Set([activityKey(started)])
    expect(pickNewActivity(seen, [started, finished])).toEqual([finished])
  })
})
