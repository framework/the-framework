import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CachedEmbeddingAdapter } from './cached-embedding.js'
import type { EmbeddingAdapter, EmbeddingResult } from './types.js'

/** Records every batch it was asked to embed, and charges 10 tokens per input. */
function fakeAdapter(): EmbeddingAdapter & { batches: string[][] } {
  const batches: string[][] = []
  return {
    batches,
    async embed(input: string | string[]): Promise<EmbeddingResult> {
      const inputs = Array.isArray(input) ? input : [input]
      batches.push(inputs)
      return {
        embeddings: inputs.map((_, i) => [i, inputs.length]),
        usage: { promptTokens: inputs.length * 10, totalTokens: inputs.length * 10 },
      }
    },
  }
}

describe('CachedEmbeddingAdapter', () => {
  it('reports the provider usage for cache misses', async () => {
    const inner = fakeAdapter()
    const cached = new CachedEmbeddingAdapter(inner)

    const first = await cached.embed(['a', 'b'], 'm')
    // Both missed, so the provider was called and its charge must surface.
    assert.deepEqual(inner.batches, [['a', 'b']])
    assert.equal(first.usage.totalTokens, 20)
  })

  it('reports zero usage only when every input was served from cache', async () => {
    const inner = fakeAdapter()
    const cached = new CachedEmbeddingAdapter(inner)

    await cached.embed(['a', 'b'], 'm')
    const second = await cached.embed(['a', 'b'], 'm')

    assert.equal(inner.batches.length, 1) // no second provider call
    assert.equal(second.usage.totalTokens, 0)
  })

  it('charges only for the uncached half of a partial hit', async () => {
    const inner = fakeAdapter()
    const cached = new CachedEmbeddingAdapter(inner)

    await cached.embed(['a'], 'm')
    const mixed = await cached.embed(['a', 'b'], 'm')

    assert.deepEqual(inner.batches[1], ['b']) // only the miss went out
    assert.equal(mixed.usage.totalTokens, 10)
    assert.equal(mixed.embeddings.length, 2)
  })

  it('keys by model, so the same text under two models is two entries', async () => {
    const inner = fakeAdapter()
    const cached = new CachedEmbeddingAdapter(inner)

    await cached.embed(['a'], 'm1')
    await cached.embed(['a'], 'm2')

    assert.equal(inner.batches.length, 2)
  })

  it('evicts oldest-first once maxEntries is exceeded', async () => {
    const inner = fakeAdapter()
    const cached = new CachedEmbeddingAdapter(inner, { maxEntries: 2 })

    await cached.embed(['a'], 'm')
    await cached.embed(['b'], 'm')
    await cached.embed(['c'], 'm')   // evicts 'a'
    await cached.embed(['c'], 'm')   // still cached
    assert.equal(inner.batches.length, 3)

    await cached.embed(['a'], 'm')   // evicted, so it goes out again
    assert.deepEqual(inner.batches[3], ['a'])
  })
})
