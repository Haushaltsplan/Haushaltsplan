/** Gemeinsame KI-Aufrufe (Gemini/OpenAI) für Finanz-Coach und Rezept-Coach. */

export const COACH_MAX_MESSAGES = 24
export const COACH_MAX_CONTENT = 8000
/** Pro User-Nachricht. */
export const COACH_MAX_IMAGES_PER_MESSAGE = 8
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
      process.env.GOOGLE_AI_API_KEY ||
      process.env.GEMINI_API_KEY_FREE,
  )
}

/**
 * Key für Free-Tier-Aufrufe (Flash-Modelle): eigener Key aus einem Google-Cloud-Projekt
 * OHNE Billing (`GEMINI_API_KEY_FREE`) — nur solche Keys haben kostenloses Tageskontingent.
 * Fallback: normaler `GEMINI_API_KEY` (dann wird wie bisher abgerechnet).
 */
function geminiApiKeyFree(): string {
  return normalisiereEnvApiKey(process.env.GEMINI_API_KEY_FREE) || geminiApiKey()
}

/** Z. B. Kassenzettel-Route, die direkt mit Gemini spricht (Flash) — bevorzugt den Free-Tier-Key. */
export function readGeminiApiKeyFromEnv(): string {
  return geminiApiKeyFree()
}

/** Ob ein dedizierter Free-Tier-Key gesetzt ist (Google AI Studio ohne Billing). */
export function geminiApiKeyFreeConfigured(): boolean {
  return Boolean(normalisiereEnvApiKey(process.env.GEMINI_API_KEY_FREE))
}

/** Nur `GEMINI_API_KEY_FREE` — kein Fallback auf den Billing-Key. */
export function resolveGeminiFreeTierProvider(): { provider: 'gemini'; apiKey: string } | null {
  const key = normalisiereEnvApiKey(process.env.GEMINI_API_KEY_FREE)
  return key ? { provider: 'gemini', apiKey: key } : null
}

function istGeminiProModell(model: string): boolean {
  return /\bpro\b|-pro(?:-|$)/i.test(model)
}

/**
 * Welcher KI-Anbieter genutzt wird (gleiche Logik wie `resolveCoachProvider`, aber mit frei wählbarem Modus-String).
 * `mode`: `auto` | `gemini` | `openai` (case-insensitive).
 */
export function resolveCoachProviderFromMode(modeRaw: string | undefined): { provider: CoachProvider; apiKey: string } | null {
  const mode = (modeRaw || 'auto').toLowerCase().trim()
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

export function resolveCoachProvider(): { provider: CoachProvider; apiKey: string } | null {
  return resolveCoachProviderFromMode(process.env.FINANCE_COACH_PROVIDER)
}

/** Für Fehlermeldungen: ob die Laufzeitumgebung einen nicht-leeren Schlüssel sieht (kein Key-Wert). */
export function coachProviderSchluesselDiagnose(): {
  gemini_gesetzt: boolean
  openai_gesetzt: boolean
} {
  return {
    gemini_gesetzt: Boolean(geminiApiKey()),
    openai_gesetzt: Boolean(openAiApiKey()),
  }
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

/**
 * Google hat 2.5-Flash-Lite für neue AI-Studio-Projekte abgeschaltet
 * („no longer available to new users“ → 3.5-Flash-Lite).
 */
export function normalisiereGeminiModellId(raw: string): string {
  const id = raw.replace(/^models\//, '').trim()
  if (!id) return id
  const klein = id.toLowerCase()
  if (klein === 'gemini-2.5-flash-lite' || klein === 'gemini-2.0-flash-lite' || klein === 'gemini-flash-lite-latest') {
    return 'gemini-3.5-flash-lite'
  }
  return id
}

/** Primärmodell + Fallbacks (ohne Duplikate). Reihenfolge: ENV primär, GEMINI_MODEL_FALLBACKS, dann sinnvolle Defaults. */
function buildGeminiModelChain(opts: {
  primaryEnvKeys: string[]
  fallbackEnvKey: string
  defaultPrimary: string
  defaultFallbacks: string[]
}): string[] {
  let primary = ''
  for (const key of opts.primaryEnvKeys) {
    const v = process.env[key]?.trim()
    if (v) {
      primary = v
      break
    }
  }
  if (!primary) primary = process.env.GEMINI_MODEL?.trim() || opts.defaultPrimary

  const ausEnv = (process.env[opts.fallbackEnvKey] || process.env.GEMINI_MODEL_FALLBACKS || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const chain = [primary, ...ausEnv, ...opts.defaultFallbacks]
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of chain) {
    const id = normalisiereGeminiModellId(m)
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/** Free-Tier Flash: fest 3.8 → 3.5 (kein Lite/Latest/ENV-Chaos). */
export const GEMINI_FREE_FLASH_PRIMARY = 'gemini-3.8-flash'
export const GEMINI_FREE_FLASH_FALLBACK = 'gemini-3.5-flash'

/**
 * Flash-Modelle mit Google-AI-Studio-Tageskontingent — kein Pro, kein Billing-Fallback.
 * Kette ist fest: gemini-3.8-flash, dann gemini-3.5-flash.
 * `opts` bleibt für Call-Sites kompatibel, steuert die Reihenfolge aber nicht mehr.
 */
export function geminiFreeTierFlashModelKandidaten(_opts?: {
  primaryEnvKeys?: string[]
  fallbackEnvKey?: string
}): string[] {
  return [GEMINI_FREE_FLASH_PRIMARY, GEMINI_FREE_FLASH_FALLBACK]
}

/**
 * Bezahltes Flash (Nachkauf-Radar Stufe A): immer Billing-Key, kein Free-Tier-Hopping.
 * Primär gemini-3.5-flash — Fallbacks nur andere Flash-Modelle (kein Pro).
 */
export function geminiPaidFlashModelKandidaten(opts?: {
  primaryEnvKeys?: string[]
  fallbackEnvKey?: string
}): string[] {
  return buildGeminiModelChain({
    primaryEnvKeys: opts?.primaryEnvKeys ?? ['NACHKAUF_SCAN_GEMINI_MODEL', 'GEMINI_MODEL'],
    fallbackEnvKey: opts?.fallbackEnvKey ?? 'NACHKAUF_SCAN_GEMINI_MODEL_FALLBACKS',
    defaultPrimary: 'gemini-3.5-flash',
    defaultFallbacks: ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3-flash-preview'],
  })
}

/** Nur Gemini 3.1 Pro — kostenpflichtig; Deep Research & Kaufempfehlung. */
export function geminiProPaidModelKandidaten(opts?: { primaryEnvKeys?: string[] }): string[] {
  return buildGeminiModelChain({
    primaryEnvKeys:
      opts?.primaryEnvKeys ?? [
        'NACHKAUF_DEEP_RESEARCH_GEMINI_MODEL',
        'NACHKAUF_KAUFEMPFEHLUNG_GEMINI_MODEL',
      ],
    fallbackEnvKey: 'NACHKAUF_DEEP_RESEARCH_GEMINI_MODEL_FALLBACKS',
    defaultPrimary: 'gemini-3.1-pro-preview',
    defaultFallbacks: ['gemini-3.1-pro-preview-customtools', 'gemini-3.1-pro-exp'],
  })
}

function geminiModelKandidaten(): string[] {
  return geminiFreeTierFlashModelKandidaten()
}

/** Portfolio-KI-Berater — Free-Tier Flash (Google AI Studio). Nie Pro (das wäre Billing). */
export function portfolioBeraterGeminiModelKandidaten(): string[] {
  return geminiFreeTierFlashModelKandidaten()
}

/** Earnings Call — Free-Tier Flash (3.8 → 3.5). */
export function earningsCallGeminiModelKandidaten(): string[] {
  return geminiFreeTierFlashModelKandidaten()
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

export type GeminiLimitArt = 'limit_zero' | 'per_day' | 'per_minute' | 'capacity' | 'generic_429' | 'sonst'

/** Trennt Limit-0 / Minuten-Limit / echtes Tageskontingent — 429 ≠ automatisch „Tag leer“. */
export function klassifiziereGeminiLimit(hint: string): GeminiLimitArt {
  const m = hint.toLowerCase()
  if (m.includes('high demand') || m.includes('try again later') || m.includes('overload')) return 'capacity'
  if (/limit:\s*0\b/.test(m) || (m.includes('limit: 0') && m.includes('quota'))) return 'limit_zero'
  if (
    /\bper day\b|\brpd\b|daily quota|per day per model/.test(m) ||
    (m.includes('tageskontingent') && (m.includes('erschöpft') || m.includes('aufgebraucht')))
  ) {
    return 'per_day'
  }
  if (/\bper minute\b|\brpm\b|per minute per model|retry.?after/.test(m)) return 'per_minute'
  if (m.includes('quota') || m.includes('resource_exhausted') || m.includes('rate limit') || m.includes('too many requests')) {
    return 'generic_429'
  }
  return 'sonst'
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Quota / RPS / Überlastung — nächstes Modell oder Kurz-Wartezeit. */
function istGeminiQuotaOderRateLimit(httpStatus: number, message: string, apiStatus?: string): boolean {
  if (httpStatus === 429) return true
  if (httpStatus === 503) return true
  if (apiStatus === 'RESOURCE_EXHAUSTED' || apiStatus === 'UNAVAILABLE') return true
  const m = message.toLowerCase()
  if (m.includes('resource_exhausted')) return true
  if (m.includes('quota') && (m.includes('exceed') || m.includes('exceeded') || m.includes('limit'))) return true
  if (m.includes('rate limit') || m.includes('too many requests')) return true
  if (m.includes('free_tier') && m.includes('limit')) return true
  if (m.includes('high demand') || m.includes('try again later')) return true
  if (m.includes('overload') || m.includes('overloaded') || m.includes('unavailable')) return true
  if (m.includes('temporarily') && (m.includes('unavailable') || m.includes('busy'))) return true
  return false
}

/**
 * Erkennt erschöpftes Gemini-Kontingent (auch deutsche formatCoachFehlerHint-Texte).
 * Für Cron: Lauf stoppen und am nächsten Tag genau dort fortsetzen.
 */
export function istKiKontingentErschoepft(text: string | null | undefined): boolean {
  if (!text?.trim()) return false
  return klassifiziereGeminiLimit(text) === 'per_day'
}

/** Nutzerfreundliche deutsche Meldung für typische Gemini-Ausfälle. */
export function formatCoachFehlerHint(hint: string, modelsVersucht = 1): string {
  const art = klassifiziereGeminiLimit(hint)
  const mehr =
    modelsVersucht > 1 ? ` Es wurden ${modelsVersucht} Gemini-Modelle probiert.` : ''
  const raw = hint.toLowerCase()
  if (raw.includes('no longer available') || raw.includes('not longer available')) {
    return (
      'Google hat dieses Gemini-Modell für neue Free-Projekte abgeschaltet. ' +
      'Die App nutzt 3.8 Flash mit Rückfall auf 3.5 Flash — bitte erneut senden.'
    )
  }
  if (art === 'capacity') {
    return (
      `Google Gemini ist gerade überlastet (Kapazität/high demand) — das ist nicht dein Tageskontingent.${mehr} ` +
      'Bitte 1–2 Minuten warten und erneut senden.'
    )
  }
  if (art === 'limit_zero') {
    return (
      'Google hat dieses Modell im kostenlosen Projekt nicht freigeschaltet (Limit 0). ' +
      '3.8 Flash / 3.5 Flash haben in der Regel noch Kontingent — bitte gleich nochmal senden.'
    )
  }
  if (art === 'per_day') {
    return (
      'Das kostenlose Gemini-Tageskontingent für dieses Modell ist erschöpft. ' +
      'Reset meist um Mitternacht Pacific Time. Deep Research / Kaufempfehlung nutzen den bezahlten Key.'
    )
  }
  if (art === 'per_minute' || art === 'generic_429') {
    return (
      'Gemini hat die Anfrage gerade mit einem kurzen Rate-Limit beantwortet — das Tageskontingent ist dafür oft noch frei. ' +
      `Bitte 30–60 Sekunden warten und erneut senden.${mehr}`
    )
  }
  return hint
}

type CallGeminiEinModellOptions = {
  temperature: number
  jsonResponse?: CoachJsonResponseConfig
  /** Grounding mit Google Search — siehe https://ai.google.dev/gemini-api/docs/google-search */
  geminiGoogleSearch?: boolean
  /** Abbruch der Gemini-HTTP-Anfrage (Default 90s). */
  timeoutMs?: number
  /** Caps die sichtbare Antwortlänge. Bei Thinking-Modellen zählt Denken mit — nicht zu knapp setzen. */
  maxOutputTokens?: number
  /**
   * Wenig/kein Thinking, damit Free-Flash nicht das Tokenbudget im Denken verbraucht
   * und die sichtbare Antwort mitten im Satz abbricht.
   */
  thinkingMinimal?: boolean
  /** Erzwingt thinkingLevel (z. B. Retry nach „MINIMAL not supported“). */
  thinkingLevelOverride?: 'minimal' | 'low' | 'medium' | 'high'
}

/**
 * Gemini 3.7+ Full-Flash und Alias `gemini-flash-latest` unterstützen
 * thinkingLevel=minimal nicht (HTTP 400). Flash-Lite behält minimal.
 */
function geminiMinimalThinkingNichtUnterstuetzt(model: string): boolean {
  const m = model.toLowerCase().replace(/^models\//, '')
  if (m === 'gemini-flash-latest') return true
  if (m.includes('lite') || m.includes('image')) return false
  const full = m.match(/^gemini-(\d+)\.(\d+)-flash(?:-|$)/)
  if (!full) return false
  const major = Number(full[1])
  const minor = Number(full[2])
  return major > 3 || (major === 3 && minor >= 7)
}

function geminiThinkingConfig(model: string): Record<string, unknown> {
  const m = model.toLowerCase()
  if (/gemini-2\.5/.test(m)) return { thinkingBudget: 0 }
  if (geminiMinimalThinkingNichtUnterstuetzt(model)) return { thinkingLevel: 'low' }
  return { thinkingLevel: 'minimal' }
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
  if (opts.maxOutputTokens != null && opts.maxOutputTokens > 0) {
    generationConfig.maxOutputTokens = opts.maxOutputTokens
  }
  if (opts.thinkingLevelOverride) {
    generationConfig.thinkingConfig = { thinkingLevel: opts.thinkingLevelOverride }
  } else if (opts.thinkingMinimal) {
    generationConfig.thinkingConfig = geminiThinkingConfig(model)
  }
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

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
    })
  } catch (e) {
    const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')
    return {
      ok: false,
      httpStatus: timeout ? 504 : 502,
      hint: timeout
        ? 'Gemini hat das Zeitlimit überschritten. Bitte nochmal senden.'
        : e instanceof Error
          ? e.message
          : 'Verbindung zu Gemini fehlgeschlagen.',
      quotaOderRateLimit: false,
    }
  }

  const raw = await res.text()
  if (!res.ok) {
    const { message, apiStatus } = parseGeminiFehlerBody(raw)
    const quotaOderRateLimit = istGeminiQuotaOderRateLimit(res.status, message, apiStatus)
    return { ok: false, httpStatus: res.status, hint: message, apiStatus, quotaOderRateLimit }
  }

  let data: {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string; thought?: boolean }> }
      finishReason?: string
    }>
    promptFeedback?: { blockReason?: string }
  }
  try {
    data = JSON.parse(raw) as typeof data
  } catch {
    return { ok: false, httpStatus: 502, hint: 'Ungültige JSON-Antwort von Gemini.', quotaOderRateLimit: false }
  }

  const cand = data.candidates?.[0]
  const parts = cand?.content?.parts ?? []
  const text = parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
    .trim()
  const finish = cand?.finishReason
  if (!text) {
    const block = data.promptFeedback?.blockReason || finish
    const extra = block ? ` (${block})` : ''
    return {
      ok: false,
      httpStatus: finish === 'MAX_TOKENS' ? 504 : 502,
      hint:
        finish === 'MAX_TOKENS'
          ? 'Gemini hat nur intern nachgedacht, die Antwort wurde abgeschnitten. Bitte nochmal senden.'
          : `Keine nutzbare Antwort von Gemini${extra}.`,
      quotaOderRateLimit: false,
    }
  }
  if (finish === 'MAX_TOKENS' && text.length < 1600) {
    console.warn(`[ki-coach] Gemini „${model}“ MAX_TOKENS nach ${text.length} Zeichen — zu kurz, nächstes Modell.`)
    return {
      ok: false,
      httpStatus: 504,
      hint: 'Gemini hat die Antwort mitten im Satz abgeschnitten. Bitte nochmal senden.',
      quotaOderRateLimit: false,
    }
  }
  return { ok: true, reply: text }
}

/** Pro-Modelle sind kostenpflichtig → bezahlter Key; Flash/sonstige → Free-Tier-Key (falls gesetzt). */
function geminiKeyFuerModell(
  model: string,
  fallbackKey: string,
  opts?: { forcePaid?: boolean; forceFree?: boolean },
): string {
  if (opts?.forceFree) {
    return normalisiereEnvApiKey(process.env.GEMINI_API_KEY_FREE) || fallbackKey
  }
  const istPro = istGeminiProModell(model)
  const key = opts?.forcePaid || istPro ? geminiApiKey() : geminiApiKeyFree()
  return key || fallbackKey
}

async function callGemini(
  apiKey: string,
  systemText: string,
  userMessages: CoachMessage[],
  callOpts: CallGeminiEinModellOptions,
  modelChain?: string[],
  forcePaidKey?: boolean,
  forceFreeKey?: boolean,
  totalBudgetMs?: number,
): Promise<
  { ok: true; reply: string; model: string } | { ok: false; status: number; hint: string }
> {
  const models = modelChain?.length ? modelChain : geminiModelKandidaten()
  if (!models.length) {
    return { ok: false, status: 501, hint: 'Kein Gemini-Modell konfiguriert (GEMINI_MODEL / FINANCE_COACH_GEMINI_MODEL).' }
  }
  if (forceFreeKey && !geminiApiKeyFreeConfigured()) {
    return {
      ok: false,
      status: 501,
      hint: 'GEMINI_API_KEY_FREE fehlt — dieser Dienst darf den Billing-Key nicht nutzen.',
    }
  }

  let lastHint = 'Unbekannter Fehler.'
  let lastHttp = 502
  const perModelTimeout = callOpts.timeoutMs ?? 90_000
  const started = Date.now()
  const deadline = started + (totalBudgetMs ?? perModelTimeout)
  const restMs = () => deadline - Date.now()

  for (let i = 0; i < models.length; i++) {
    const remaining = restMs()
    if (remaining < 10_000) {
      lastHttp = 504
      lastHint = 'Gemini-Zeitbudget aufgebraucht. Bitte nochmal senden.'
      break
    }
    const model = models[i]!
    const thisTimeout = Math.min(perModelTimeout, remaining)
    const modellKey = geminiKeyFuerModell(model, apiKey, { forcePaid: forcePaidKey, forceFree: forceFreeKey })
    const optsMitTimeout = { ...callOpts, timeoutMs: thisTimeout }
    let r = await callGeminiEinModell(modellKey, model, systemText, userMessages, optsMitTimeout)

    // thinkingLevel=minimal nicht unterstützt (3.7+/flash-latest) → Retry mit low, dann ohne Flag
    if (!r.ok && r.httpStatus === 400 && callOpts.thinkingMinimal && restMs() > 10_000) {
      const tipp = r.hint.toLowerCase()
      const minimalAbgelehnt =
        tipp.includes('thinking') && (tipp.includes('minimal') || tipp.includes('not supported'))
      if (minimalAbgelehnt && !callOpts.thinkingLevelOverride) {
        console.warn(`[ki-coach] Gemini „${model}“ 400 (minimal) — Retry mit thinkingLevel=low.`)
        r = await callGeminiEinModell(modellKey, model, systemText, userMessages, {
          ...callOpts,
          thinkingLevelOverride: 'low',
          timeoutMs: Math.min(perModelTimeout, restMs()),
        })
      }
      if (!r.ok && r.httpStatus === 400 && restMs() > 10_000) {
        console.warn(`[ki-coach] Gemini „${model}“ 400 mit thinkingConfig — Retry ohne Thinking-Flag.`)
        r = await callGeminiEinModell(modellKey, model, systemText, userMessages, {
          ...callOpts,
          thinkingMinimal: false,
          thinkingLevelOverride: undefined,
          timeoutMs: Math.min(perModelTimeout, restMs()),
        })
      }
    }

    // Google Search hat oft ein eigenes, winziges Free-Kontingent — ohne Search erneut versuchen
    if (
      !r.ok &&
      r.quotaOderRateLimit &&
      callOpts.geminiGoogleSearch &&
      restMs() > 12_000
    ) {
      console.warn(`[ki-coach] Gemini „${model}“ (${r.httpStatus}) mit Google Search — Retry ohne Search.`)
      r = await callGeminiEinModell(modellKey, model, systemText, userMessages, {
        ...optsMitTimeout,
        geminiGoogleSearch: false,
        timeoutMs: Math.min(perModelTimeout, restMs()),
      })
    }

    // Kurze Backoffs bei Overload/RPM — oft kein Tageskontingent, sondern Kapazität.
    // Bei 503 und vorhandenem Fallback nur 1 Retry, dann schnell zum nächsten Modell
    // (sonst frisst die Retry-Schleife das Gesamtbudget und der Fallback startet nie).
    if (!r.ok && r.quotaOderRateLimit && (r.httpStatus === 503 || r.httpStatus === 429) && restMs() > 12_000) {
      const hatFallback = Boolean(models[i + 1])
      const pauses =
        r.httpStatus === 503 ? (hatFallback ? [2000] : [2500, 4500]) : [2000]
      for (const pause of pauses) {
        if (r.ok || restMs() < 12_000) break
        console.warn(`[ki-coach] Gemini „${model}“ (${r.httpStatus}): Pause ${pause}ms, Retry …`)
        await sleepMs(pause)
        const retryTimeout = Math.min(perModelTimeout, restMs())
        if (retryTimeout < 8_000) break
        r = await callGeminiEinModell(modellKey, model, systemText, userMessages, {
          ...callOpts,
          timeoutMs: retryTimeout,
        })
      }
    }

    if (r.ok) {
      if (i > 0) {
        console.warn(`[ki-coach] Gemini: automatisch auf Modell „${model}“ gewechselt (${i} vorherige(r) Modell(e): Quota, Rate-Limit, 404, Timeout oder ähnlich).`)
      }
      return { ok: true, reply: r.reply, model }
    }
    lastHint = r.hint
    lastHttp = r.httpStatus

    const naechstes = models[i + 1]
    const modellAbgeschaltet = /no longer available|not longer available/i.test(r.hint)
    /** 404 / Quota / 503 / Timeout / abgekündigtes Modell — nächstes Flash (eigenes Kontingent). */
    const naechstesModellMoeglich =
      Boolean(naechstes) &&
      restMs() >= 12_000 &&
      (r.quotaOderRateLimit ||
        r.httpStatus === 404 ||
        r.httpStatus === 503 ||
        r.httpStatus === 504 ||
        modellAbgeschaltet)
    if (naechstesModellMoeglich) {
      console.warn(`[ki-coach] Gemini „${model}“ (${r.httpStatus}): ${r.hint.slice(0, 220)} — versuche „${naechstes}“.`)
      if (r.quotaOderRateLimit || r.httpStatus === 503) await sleepMs(1500)
      continue
    }
    return {
      ok: false,
      status: lastHttp >= 400 && lastHttp < 600 ? lastHttp : 502,
      hint: formatCoachFehlerHint(lastHint, i + 1),
    }
  }

  return {
    ok: false,
    status: lastHttp >= 400 && lastHttp < 600 ? lastHttp : 502,
    hint: formatCoachFehlerHint(lastHint, models.length),
  }
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
  /** Voller User-Text ohne COACH_MAX_CONTENT-Kürzung (z. B. Earnings-Transkript). */
  skipMessageTrim?: boolean
  /** Nur Gemini: eigene Modell-Kette (Primär + Fallbacks bei Quota/429). */
  geminiModels?: string[]
  /**
   * Nur Gemini: immer `GEMINI_API_KEY` (Billing), auch für Flash.
   * Nachkauf-Radar Scan/DR/Kaufempfehlung — nicht Free-Tier.
   * Niemals am Portfolio-Berater / Mode / Coach setzen.
   */
  geminiForcePaidApiKey?: boolean
  /**
   * Nur Gemini: immer `GEMINI_API_KEY_FREE`, nie Billing, nie OpenAI-Fallback.
   * Portfolio-Berater.
   */
  geminiForceFreeApiKey?: boolean
  /** Gemini-HTTP-Timeout je Modell in ms. */
  timeoutMs?: number
  /** Gesamtes Zeitbudget über die Modell-Kette (Timeouts dürfen hoppen). */
  geminiTotalBudgetMs?: number
  /** Gemini generationConfig.maxOutputTokens. */
  maxOutputTokens?: number
  /** Wenig Thinking (3.x: thinkingLevel minimal, 2.5: thinkingBudget 0). */
  thinkingMinimal?: boolean
}

export async function runCoachCompletion(
  provider: CoachProvider,
  apiKey: string,
  systemText: string,
  userMessages: CoachMessage[],
  options?: RunCoachCompletionOptions,
): Promise<
  { ok: true; reply: string; model?: string } | { ok: false; status: number; hint: string }
> {
  const t = options?.temperature ?? 0.55
  const messages = options?.skipMessageTrim ? userMessages : prepareCoachMessages(userMessages)
  if (provider === 'gemini') {
    if (options?.geminiForcePaidApiKey && options?.geminiForceFreeApiKey) {
      return { ok: false, status: 500, hint: 'Intern: Paid- und Free-Gemini-Key dürfen nicht gleichzeitig erzwungen werden.' }
    }
    const gemini = await callGemini(
      apiKey,
      systemText,
      messages,
      {
        temperature: t,
        jsonResponse: options?.jsonResponse,
        geminiGoogleSearch: options?.geminiGoogleSearch,
        timeoutMs: options?.timeoutMs,
        maxOutputTokens: options?.maxOutputTokens,
        thinkingMinimal: options?.thinkingMinimal,
      },
      options?.geminiModels,
      options?.geminiForcePaidApiKey === true,
      options?.geminiForceFreeApiKey === true,
      options?.geminiTotalBudgetMs,
    )
    if (gemini.ok) return gemini

    const oKey = openAiApiKey()
    const kannOpenAiFallback =
      oKey &&
      !options?.geminiForceFreeApiKey &&
      !options?.jsonResponse &&
      !options?.geminiGoogleSearch &&
      !messages.some((m) => m.images?.length)
    if (kannOpenAiFallback) {
      console.warn('[ki-coach] Gemini fehlgeschlagen — Fallback auf OpenAI.')
      const openAi = await callOpenAI(oKey, systemText, messages, t, false)
      if (openAi.ok) return { ...openAi, model: 'openai' }
    }

    return gemini
  }
  const openAi = await callOpenAI(apiKey, systemText, messages, t, Boolean(options?.jsonResponse))
  if (openAi.ok) return { ...openAi, model: 'openai' }
  return openAi
}
