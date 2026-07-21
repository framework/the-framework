import type { ZodLikeObject } from './types.js'

/** Outcome of checking client-supplied arguments against a declared schema. */
export type ValidationResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; message: string }

interface SafeParsable {
  safeParse(input: unknown): {
    success: boolean
    data?: unknown
    error?: { issues?: Array<{ path?: PropertyKey[]; message?: string }> }
  }
}

function isSafeParsable(schema: unknown): schema is SafeParsable {
  return typeof (schema as SafeParsable | null)?.safeParse === 'function'
}

/**
 * Check client-supplied arguments against the schema a tool or prompt declares.
 *
 * The low-level MCP `Server` validates only the request envelope — `arguments`
 * is typed as an open record on the wire — so without this a handler receives
 * whatever the client sent, whatever its declared schema says. Handlers are
 * written against the declared types (and interpolate those values into URLs and
 * paths), so an unchecked argument is a real injection surface.
 *
 * Returns the *parsed* value on success, so handlers see coerced values and
 * declared-away extra keys rather than the raw payload. Schemas that cannot
 * validate (a plain `{ shape }` object rather than a Zod schema) pass through
 * unchanged — advertising is best-effort for those, and so is checking.
 */
export function validateInput(schema: ZodLikeObject, input: Record<string, unknown>): ValidationResult {
  if (!isSafeParsable(schema)) return { ok: true, data: input }

  const parsed = schema.safeParse(input)
  if (parsed.success) {
    return { ok: true, data: (parsed.data ?? input) as Record<string, unknown> }
  }

  const issues = parsed.error?.issues ?? []
  const detail = issues
    .map((i) => {
      const path = (i.path ?? []).join('.')
      return path ? `${path}: ${i.message ?? 'invalid'}` : (i.message ?? 'invalid')
    })
    .join('; ')
  return { ok: false, message: detail || 'input did not match the declared schema' }
}
