/** Gemeinsame KI-Aufrufe (Gemini/OpenAI) für Finanz-Coach und Lager-Rezept-Coach. */

export const COACH_MAX_MESSAGES = 24
export const COACH_MAX_CONTENT = 8000
export const COACH_MAX_IMAGES_PER_MESSAGE = 4
export const COACH_MAX_BASE64_CHARS_PER_IMAGE = 3_600_000

export type CoachImagePart = { mimeType: string; base64: string }
export type CoachMessage = { role: 'user' | 'assistant'; content: string; images?: CoachImagePart[] }
export type CoachProvider = 'openai' | 'gemini'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function normalisiereEnvApiKey(raw: string | undefined): string {
  if (raw == null) return ''
  let s = String(raw).replace(/^\uFEFF/, '')
  s = s.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }
  return s
}

function openAiApiKey() {
  return normalisiereEnvApiKey(
    process.env.OPENAI_API_KEY || process.env.AI_API_KEY,
  )
}

function geminiApiKey() {
  return normalisiereEnvApiKey(
    process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY,
  )
}

/** Z. B. Kassenzettel-Route, die direkt mit Gemini spricht; nutzt dieselbe Normalisierung wie `resolveCoachProvider`. */
export function readGeminiApiKeyFromEnv(): string {
  return geminiApiKey()
}

export function resolveCoachProvider(): { provider: CoachProvider; apiKey: string } | null {
  const mode = (process.env.FINANCE_COACH_PROVIDER || 'auto').toLowerCase().trim()
  const gKey = geminiApiKey()
  const oKey = openAiApiKey()

  if (mode === 'gemini') {
    return gKey ? { provider: 'gemini', apiKey: gKey } : null
  }
  if (mode === 'openai') {
    return oKey ? { provider: 'openai', apiKey: oKey } : null
  }
  if (gKey) return { provider: 'gemini', apiKey: gKey }
  if (oKey) return { provider: 'openai', apiKey: oKey }
  return null
}

function stripDataUrlBase64(raw: string): string {
  const t = raw.trim()
  if (t.startsWith('data:') && t.includes('base64,')) {
    return t.split('base64,').pop() || ''
  }
  return t
}

function normalizeCoachMessage(raw: unknown): CoachMessage | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const role = o.role
  if (role !== 'user' && role !== 'assistant') return null
  const content = typeof o.content === 'string' ? o.content : ''
  const images: CoachImagePart[] = []
  if (Array.isArray(o.images)) {
    for (const im of o.images) {
      if (!im || typeof im !== 'object') continue
      const img = im as Record<string, unknown>
      const mimeType = typeof img.mimeType === 'string' ? img.mimeType.trim().toLowerCase() : ''
      let base64 = typeof img.base64 === 'string' ? stripDataUrlBase64(img.base64) : ''
      base64 = base64.replace(/\s/g, '')
      if (!mimeType || !base64 || !ALLOWED_MIME.has(mimeType)) continue
      if (base64.length > COACH_MAX_BASE64_CHARS_PER_IMAGE) continue
      images.push({ mimeType, base64 })
      if (images.length >= COACH_MAX_IMAGES_PER_MESSAGE) break
    }
  }
  if (role === 'assistant') {
    if (!content.trim()) return null
    return { role: 'assistant', content }
  }
  if (!content.trim() && images.length === 0) return null
  return images.length ? { role: 'user', content, images } : { role: 'user', content }
}

function trimMessages(messages: unknown[]): CoachMessage[] {
  const out: CoachMessage[] = []
  for (const raw of messages) {
    const m = normalizeCoachMessage(raw)
    if (!m) continue
    if (m.role === 'assistant') {
      out.push({ ...m, content: m.content.slice(0, COACH_MAX_CONTENT) })
    } else {
      const imgs = m.images?.slice(0, COACH_MAX_IMAGES_PER_MESSAGE)
      out.push({
        role: 'user',
        content: m.content.slice(0, COACH_MAX_CONTENT),
        ...(imgs?.length ? { images: imgs } : {}),
      })
    }
  }
  return out.slice(-COACH_MAX_MESSAGES)
}

export function onlyLastUserKeepsImages(messages: CoachMessage[]): CoachMessage[] {
  let lastUser = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      lastUser = i
      break
    }
  }
  return messages.map((m, i) => {
    if (m.role !== 'user' || !m.images?.length) return m
    if (i === lastUser) return m
    const hint = '\n[Früheres Foto nicht erneut mitgesendet.]'
    return {
      role: 'user',
      content: (m.content.trim() || '(Foto)').slice(0, COACH_MAX_CONTENT) + hint,
    }
  })
}

export function prepareCoachMessages(raw: unknown[]): CoachMessage[] {
  return onlyLastUserKeepsImages(trimMessages(raw))
}

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } }

function geminiPartsForUser(m: CoachMessage): GeminiPart[] {
  const parts: GeminiPart[] = []
  if (m.images?.length) {
    for (const im of m.images) {
      parts.push({ inlineData: { mimeType: im.mimeType, data: im.base64 } })
    }
  }
  const t = m.content.trim() || (m.images?.length ? 'Bitte Foto auswerten.' : '')
  if (t) parts.push({ text: t })
  return parts
}

async function callOpenAI(
  apiKey: string,
  systemText: string,
  userMessages: CoachMessage[],
  temperature: number,
  jsonObjectMode?: boolean,
): Promise<{ ok: true; reply: string } | { ok: false; status: number; hint: string }> {
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = process.env.FINANCE_COACH_MODEL || 'gpt-4o-mini'

  type Msg = { role: 'system' | 'user' | 'assistant'; content: string | unknown[] }
  const payloadMsgs: Msg[] = [{ role: 'system', content: systemText }]

  for (const m of userMessages) {
    if (m.role === 'assistant') {
      payloadMsgs.push({ role: 'assistant', content: m.content })
    } else if (m.images?.length) {
      if (m.images.some((im) => im.mimeType === 'application/pdf')) {
        return {
          ok: false,
          status: 400,
          hint: 'OpenAI-Vision unterstützt hier kein eingebettetes PDF — bitte Gemini nutzen oder Bilder (JPEG/PNG) senden.',
        }
      }
      const content: unknown[] = []
      const text = m.content.trim() || 'Bitte dieses Foto auswerten.'
      content.push({ type: 'text', text })
      for (const im of m.images) {
        content.push({
          type: 'image_url',
          image_url: { url: `data:${im.mimeType};base64,${im.base64}` },
        })
      }
      payloadMsgs.push({ role: 'user', content })
    } else {
      payloadMsgs.push({ role: 'user', content: m.content })
    }
  }

  const payload: Record<string, unknown> = {
    model,
    temperature,
    messages: payloadMsgs,
  }
  if (jsonObjectMode) {
    payload.response_format = { type: 'json_object' }
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const raw = await res.text()
  if (!res.ok) {
    let hint = raw.slice(0, 400)
    try {
      const j = JSON.parse(raw) as { error?: { message?: string } }
      if (j?.error?.message) hint = j.error.message
    } catch {
      /* ignore */
    }
    return { ok: false, status: 502, hint }
  }

  const data = JSON.parse(raw) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const reply = data.choices?.[0]?.message?.content?.trim()
  if (!reply) {
    return { ok: false, status: 502, hint: 'Leere Antwort vom KI-Dienst.' }
  }
  return { ok: true, reply }
}

export type CoachJsonResponseConfig = {
  /** Gemini `responseSchema` (OpenAPI-ähnliches Objekt). */
  schema: Record<string, unknown>
}

/** Primärmodell + Fallbacks (ohne Duplikate). Reihenfolge: ENV primär, GEMINI_MODEL_FALLBACKS, dann sinnvolle Defaults. */
function geminiModelKandidaten(): string[] {
  const primaryRaw =
    process.env.FINANCE_COACH_GEMINI_MODEL?.trim() || process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash'
  const primary = primaryRaw || 'gemini-2.5-flash'
  const ausEnv = (process.env.GEMINI_MODEL_FALLBACKS || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  /** Wenn das Free-Tier-Limit eines Modells erreicht ist, zählt Google oft **pro Modell** — nächstes Modell = neues Kontingent. */
  const defaults = ['gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-3-flash-preview']
  const chain = [primary, ...ausEnv, ...defaults]
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of chain) {
    const id = m.replace(/^models\//, '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function parseGeminiFehlerBody(raw: string): { message: string; apiStatus?: string } {
  try {
    const j = JSON.parse(raw) as { error?: { message?: string; status?: string } }
    const msg = typeof j?.error?.message === 'string' ? j.error.message : raw.slice(0, 500)
    const st = typeof j?.error?.status === 'string' ? j.error.status : undefined
    return { message: msg, apiStatus: st }
  } catch {
    return { message: raw.slice(0, 500) }
  }
}

/** Quota / RPS / Free-Tier — nächstes Modell versuchen. */
function istGeminiQuotaOderRateLimit(httpStatus: number, message: string, apiStatus?: string): boolean {
  if (httpStatus === 429) return true
  if (apiStatus === 'RESOURCE_EXHAUSTED') return true
  const m = message.toLowerCase()
  if (m.includes('resource_exhausted')) return true
  if (m.includes('quota') && (m.includes('exceed') || m.includes('exceeded') || m.includes('limit'))) return true
  if (m.includes('rate limit') || m.includes('too many requests')) return true
  if (m.includes('free_tier') && m.includes('limit')) return true
  if (httpStatus === 503 && (m.includes('overload') || m.includes('unavailable') || m.includes('quota'))) return true
  return false
}

type CallGeminiEinModellOptions = {
  temperature: number
  jsonResponse?: CoachJsonResponseConfig
  /** Grounding mit Google Search — siehe https://ai.google.dev/gemini-api/docs/google-search */
  geminiGoogleSearch?: boolean
}

async function callGeminiEinModell(
  apiKey: string,
  model: string,
  systemText: string,
  userMessages: CoachMessage[],
  opts: CallGeminiEinModellOptions,
): Promise<
  | { ok: true; reply: string }
  | { ok: false; httpStatus: number; hint: string; apiStatus?: string; quotaOderRateLimit: boolean }
> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

  const contents = userMessages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: m.role === 'assistant' ? [{ text: m.content }] : geminiPartsForUser(m),
  }))

  const generationConfig: Record<string, unknown> = { temperature: opts.temperature }
  if (opts.jsonResponse?.schema) {
    generationConfig.responseMimeType = 'application/json'
    generationConfig.responseSchema = opts.jsonResponse.schema
  }

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: systemText }] },
    contents,
    generationConfig,
  }
  if (opts.geminiGoogleSearch) {
    body.tools = [{ google_search: {} }]
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const raw = await res.text()
  if (!res.ok) {
    const { message, apiStatus } = parseGeminiFehlerBody(raw)
    const quotaOderRateLimit = istGeminiQuotaOderRateLimit(res.status, message, apiStatus)
    return { ok: false, httpStatus: res.status, hint: message, apiStatus, quotaOderRateLimit }
  }

  let data: {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
      finishReason?: string
    }>
    promptFeedback?: { blockReason?: string }
  }
  try {
    data = JSON.parse(raw) as typeof data
  } catch {
    return { ok: false, httpStatus: 502, hint: 'Ungültige JSON-Antwort von Gemini.', quotaOderRateLimit: false }
  }

  const parts = data.candidates?.[0]?.content?.parts
  const text = parts?.map((p) => p.text ?? '').join('').trim()
  if (!text) {
    const block = data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason
    const extra = block ? ` (${block})` : ''
    return {
      ok: false,
      httpStatus: 502,
      hint: `Keine nutzbare Antwort von Gemini${extra}.`,
      quotaOderRateLimit: false,
    }
  }
  return { ok: true, reply: text }
}

async function callGemini(
  apiKey: string,
  systemText: string,
  userMessages: CoachMessage[],
  callOpts: CallGeminiEinModellOptions,
): Promise<{ ok: true; reply: string } | { ok: false; status: number; hint: string }> {
  const models = geminiModelKandidaten()
  if (!models.length) {
    return { ok: false, status: 501, hint: 'Kein Gemini-Modell konfiguriert (GEMINI_MODEL / FINANCE_COACH_GEMINI_MODEL).' }
  }

  let lastHint = 'Unbekannter Fehler.'
  let lastHttp = 502

  for (let i = 0; i < models.length; i++) {
    const model = models[i]!
    const r = await callGeminiEinModell(apiKey, model, systemText, userMessages, callOpts)
    if (r.ok) {
      if (i > 0) {
        console.warn(`[ki-coach] Gemini: automatisch auf Modell „${model}“ gewechselt (${i} vorherige(r) Modell(e): Quota, Rate-Limit, 404 oder ähnlich).`)
      }
      return { ok: true, reply: r.reply }
    }
    lastHint = r.hint
    lastHttp = r.httpStatus

    const naechstes = models[i + 1]
    /** 404: Modell-ID unbekannt — nächstes aus der Kette probieren. Quota/Rate-Limit: nächstes Modell = oft eigenes Free-Tier-Kontingent. */
    const naechstesModellMoeglich = Boolean(naechstes) && (r.quotaOderRateLimit || r.httpStatus === 404)
    if (naechstesModellMoeglich) {
      console.warn(`[ki-coach] Gemini „${model}“ (${r.httpStatus}): ${r.hint.slice(0, 220)} — versuche „${naechstes}“.`)
      continue
    }
    const suffixAlleDurch =
      i === models.length - 1 && models.length > 1 && (r.quotaOderRateLimit || r.httpStatus === 404)
        ? ` (Alle ${models.length} Modelle der Fallback-Kette wurden durchprobiert.)`
        : ''
    return {
      ok: false,
      status: lastHttp >= 400 && lastHttp < 600 ? lastHttp : 502,
      hint: lastHint + suffixAlleDurch,
    }
  }

  return { ok: false, status: lastHttp >= 400 && lastHttp < 600 ? lastHttp : 502, hint: lastHint }
}

export type RunCoachCompletionOptions = {
  temperature?: number
  /** Nur JSON-Antwort (Gemini: Schema; OpenAI: json_object). */
  jsonResponse?: CoachJsonResponseConfig
  /**
   * Nur Gemini: Grounding mit Google Search (Live-Web).
   * Doku: https://ai.google.dev/gemini-api/docs/google-search
   */
  geminiGoogleSearch?: boolean
}

export async function runCoachCompletion(
  provider: CoachProvider,
  apiKey: string,
  systemText: string,
  userMessages: CoachMessage[],
  options?: RunCoachCompletionOptions,
): Promise<{ ok: true; reply: string } | { ok: false; status: number; hint: string }> {
  const t = options?.temperature ?? 0.55
  if (provider === 'gemini') {
    return callGemini(apiKey, systemText, userMessages, {
      temperature: t,
      jsonResponse: options?.jsonResponse,
      geminiGoogleSearch: options?.geminiGoogleSearch,
    })
  }
  return callOpenAI(apiKey, systemText, userMessages, t, Boolean(options?.jsonResponse))
}
