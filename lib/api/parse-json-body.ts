import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'

export type ParseJsonOk<T> = { ok: true; data: T }
export type ParseJsonFail = { ok: false; response: NextResponse }

/**
 * Liest JSON aus dem Request und validiert mit Zod.
 * Leerer Body → `fallback` (falls gesetzt), sonst Fehler.
 */
export async function parseJsonBody<T>(
  req: Request,
  schema: ZodType<T>,
  opts?: { fallback?: T; fehlerPrefix?: string },
): Promise<ParseJsonOk<T> | ParseJsonFail> {
  let raw: unknown = opts?.fallback
  try {
    raw = await req.json()
  } catch {
    if (opts?.fallback !== undefined) {
      const parsed = schema.safeParse(opts.fallback)
      if (parsed.success) return { ok: true, data: parsed.data }
    }
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Ungültige Anfrage (kein JSON).', fehler: 'Ungültige Anfrage (kein JSON).' },
        { status: 400 },
      ),
    }
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .slice(0, 6)
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ')
    const msg = `${opts?.fehlerPrefix ?? 'Ungültige Anfrage'}${detail ? `: ${detail}` : ''}`
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: msg, fehler: msg }, { status: 400 }),
    }
  }
  return { ok: true, data: parsed.data }
}
