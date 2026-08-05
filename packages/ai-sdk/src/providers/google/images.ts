import type {
  ImageGenerationAdapter,
  ImageGenerationOptions,
  ImageGenerationResult,
} from '../../types.js'
import type { GoogleConfig } from './config.js'

// ─── Image Generation Adapter (Imagen) ──────────────────

const GOOGLE_IMAGE_SIZE_MAP: Record<string, string> = {
  square: '1024x1024',
  landscape: '1792x1024',
  portrait: '1024x1792',
}

/**
 * Imagen's `aspectRatio` takes an enumerated ratio (`1:1`, `16:9`, …), not a pixel
 * pair — `1024:1024` is rejected. Map a width/height to the nearest supported ratio.
 */
function toImagenAspectRatio(width: number, height: number): string | undefined {
  if (!width || !height) return undefined
  const ratio = width / height
  const options: Array<[string, number]> = [
    ['1:1', 1],
    ['16:9', 16 / 9],
    ['9:16', 9 / 16],
    ['4:3', 4 / 3],
    ['3:4', 3 / 4],
  ]
  return options.reduce((best, cur) =>
    Math.abs(cur[1] - ratio) < Math.abs(best[1] - ratio) ? cur : best,
  )[0]
}

export class GoogleImageAdapter implements ImageGenerationAdapter {
  constructor(
    private readonly config: GoogleConfig,
    private readonly model: string,
  ) {}

  async generate(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const size = options.size
      ? (GOOGLE_IMAGE_SIZE_MAP[options.size] ?? options.size)
      : '1024x1024'

    const [width, height] = size.split('x').map(Number)
    const aspectRatio = toImagenAspectRatio(width ?? 0, height ?? 0)

    const body: Record<string, unknown> = {
      instances: [{ prompt: options.prompt }],
      parameters: {
        sampleCount: options.n ?? 1,
        ...(aspectRatio ? { aspectRatio } : {}),
      },
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:predict?key=${this.config.apiKey}`

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      throw new Error(`[ai-sdk] Google image generation error: ${res.status} ${await res.text()}`)
    }

    const data = await res.json() as {
      predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>
    }

    return {
      images: (data.predictions ?? []).map((p: any) => ({
        ...(p.bytesBase64Encoded ? { base64: p.bytesBase64Encoded as string } : {}),
      })),
      model: this.model,
    }
  }
}
