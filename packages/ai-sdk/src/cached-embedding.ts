import type { EmbeddingAdapter, EmbeddingResult } from './types.js'

/** Options for {@link CachedEmbeddingAdapter}. */
export interface CachedEmbeddingOptions {
  /**
   * Cap on cached vectors; the oldest are evicted first. Default 10_000 — a
   * long-lived process embedding user-supplied text would otherwise grow the
   * map without bound, and each entry is a full vector.
   */
  maxEntries?: number
}

/**
 * In-memory caching wrapper for any EmbeddingAdapter.
 *
 * Caches embeddings by `model:text` key so repeated inputs skip the provider call.
 * Usage reflects what the provider actually charged: zero when every input was
 * served from cache, otherwise the usage of the call made for the cache misses.
 */
export class CachedEmbeddingAdapter implements EmbeddingAdapter {
  private cache = new Map<string, number[]>()
  private readonly maxEntries: number

  constructor(private inner: EmbeddingAdapter, opts: CachedEmbeddingOptions = {}) {
    this.maxEntries = opts.maxEntries ?? 10_000
  }

  async embed(input: string | string[], model: string): Promise<EmbeddingResult> {
    const inputs = Array.isArray(input) ? input : [input]
    const results: number[][] = []
    const uncached: string[] = []
    const uncachedIndices: number[] = []

    for (let i = 0; i < inputs.length; i++) {
      const key = `${model}:${inputs[i]}`
      const cached = this.cache.get(key)
      if (cached) {
        results[i] = cached
      } else {
        uncached.push(inputs[i]!)
        uncachedIndices.push(i)
      }
    }

    if (uncached.length === 0) {
      // Nothing hit the provider, so nothing was charged.
      return { embeddings: results, usage: { promptTokens: 0, totalTokens: 0 } }
    }

    const fresh = await this.inner.embed(uncached, model)
    for (let j = 0; j < uncachedIndices.length; j++) {
      const idx = uncachedIndices[j]!
      const embedding = fresh.embeddings[j]!
      results[idx] = embedding
      this.remember(`${model}:${uncached[j]}`, embedding)
    }

    // Report what the provider charged for the misses — zeroing it here would
    // make every consumer aggregating usage undercount embedding spend.
    return { embeddings: results, usage: fresh.usage }
  }

  /** Store one vector, evicting the oldest entries once the cap is exceeded. */
  private remember(key: string, embedding: number[]): void {
    this.cache.set(key, embedding)
    while (this.cache.size > this.maxEntries) {
      const oldest = this.cache.keys().next()
      if (oldest.done) break
      this.cache.delete(oldest.value)
    }
  }
}
