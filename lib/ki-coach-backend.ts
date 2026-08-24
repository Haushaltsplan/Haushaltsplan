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
    const id = m.replace(/^models\//, '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/** Flash-Modelle mit Google-AI-Studio-Tageskontingent — kein Pro, kein kostenpflichtiges Fallback. */
export function geminiFreeTierFlashModelKandidaten(opts?: {
  primaryEnvKeys?: string[]
  fallbackEnvKey?: string
}): string[] {
  return buildGeminiModelChain({
    primaryEnvKeys: opts?.primaryEnvKeys ?? ['FINANCE_COACH_GEMINI_MODEL', 'GEMINI_MODEL'],
    fallbackEnvKey: opts?.fallbackEnvKey ?? 'GEMINI_MODEL_FALLBACKS',
    defaultPrimary: 'gemini-3.5-flash',
    /** Quota oft pro Modell — nächstes Modell = neues Free-Tier-Kontingent. Kein Pro / kein 3.1-flash-lite. */
    defaultFallbacks: [
      'gemini-flash-latest',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-3-flash-preview',
    ],
  })
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

/** Portfolio-KI-Berater — Free-Tier Flash (Google AI Studio). */
export function portfolioBeraterGeminiModelKandidaten(): string[] {
  return geminiFreeTierFlashModelKandidaten({
    primaryEnvKeys: ['PORTFOLIO_BERATER_GEMINI_MODEL', 'FINANCE_COACH_GEMINI_MODEL', 'GEMINI_MODEL'],
    fallbackEnvKey: 'PORTFOLIO_BERATER_GEMINI_MODEL_FALLBACKS',
  })
}

/** Earnings Call — lange Transkripte, bevorzugt neuestes Flash mit Free-Tier-Fallbacks. */
export function earningsCallGeminiModelKandidaten(): string[] {
  return geminiFreeTierFlashModelKandidaten({
    primaryEnvKeys: ['EARNINGS_CALL_GEMINI_MODEL', 'FINANCE_COACH_GEMINI_MODEL', 'GEMINI_MODEL'],
    fallbackEnvKey: 'EARNINGS_CALL_GEMINI_MODEL_FALLBACKS',
  })
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
  const m = text.toLowerCase()
  if (m.includes('tageskontingent')) return true
  if (m.includes('kontingent') && (m.includes('erschöpft') || m.includes('aufgebraucht'))) return true
  if (m.includes('quota') || m.includes('resource_exhausted') || m.includes('rate limit')) return true
  if (m.includes('free_tier') && m.includes('limit')) return true
  return istGeminiQuotaOderRateLimit(0, text)
}

/** Nutzerfreundliche deutsche Meldung für typische Gemini-Ausfälle. */
export function formatCoachFehlerHint(hint: string, modelsVersucht = 1): string {
  const m = hint.toLowerCase()
  if (m.includes('high demand') || m.includes('try again later') || m.includes('overload')) {
    const mehr =
      modelsVersucht > 1
        ? ` Es wurden bereits ${modelsVersucht} Gemini-Modelle probiert.`
        : ''
    return (
      `Die KI ist gerade stark ausgelastet (Google Gemini). Bitte in 1–2 Minuten erneut versuchen.${mehr} ` +
      'Das ist meist nur kurzzeitig — kein Fehler in deiner App.'
    )
  }
  if (m.includes('quota') || m.includes('rate limit') || m.includes('resource_exhausted')) {
    return (
      'Das kostenlose Gemini-Tageskontingent ist gerade erschöpft. ' +
      'Kurz warten (Reset meist um Mitternacht Pacific Time) oder morgen erneut versuchen. ' +
      'Nur Deep Research / Kaufempfehlung nutzen kostenpflichtiges 3.1 Pro.'
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

/** Pro-Modelle sind kostenpflichtig → bezahlter Key; Flash/sonstige → Free-Tier-Key (falls gesetzt). */
function geminiKeyFuerModell(
  model: string,
  fallbackKey: string,
  opts?: { forcePaid?: boolean },
): string {
  const istPro = /\bpro\b|-pro(?:-|$)/i.test(model)
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
): Promise<{ ok: true; reply: string } | { ok: false; status: number; hint: string }> {
  const models = modelChain?.length ? modelChain : geminiModelKandidaten()
  if (!models.length) {
    return { ok: false, status: 501, hint: 'Kein Gemini-Modell konfiguriert (GEMINI_MODEL / FINANCE_COACH_GEMINI_MODEL).' }
  }

  let lastHint = 'Unbekannter Fehler.'
  let lastHttp = 502

  for (let i = 0; i < models.length; i++) {
    const model = models[i]!
    const modellKey = geminiKeyFuerModell(model, apiKey, { forcePaid: forcePaidKey })
    let r = await callGeminiEinModell(modellKey, model, systemText, userMessages, callOpts)

    // Einmal kurz warten und dasselbe Modell bei temporärer Überlastung wiederholen
    if (!r.ok && r.quotaOderRateLimit && (r.httpStatus === 503 || r.httpStatus === 429)) {
      console.warn(`[ki-coach] Gemini „${model}“ (${r.httpStatus}): kurze Pause, ein Retry …`)
      await sleepMs(2000)
      r = await callGeminiEinModell(modellKey, model, systemText, userMessages, callOpts)
    }

    if (r.ok) {
      if (i > 0) {
        console.warn(`[ki-coach] Gemini: automatisch auf Modell „${model}“ gewechselt (${i} vorherige(r) Modell(e): Quota, Rate-Limit, 404 oder ähnlich).`)
      }
      return { ok: true, reply: r.reply }
    }
    lastHint = r.hint
    lastHttp = r.httpStatus

    const naechstes = models[i + 1]
    /** 404 / Quota / 503 / High demand — nächstes Modell (eigenes Kontingent). */
    const naechstesModellMoeglich =
      Boolean(naechstes) && (r.quotaOderRateLimit || r.httpStatus === 404 || r.httpStatus === 503)
    if (naechstesModellMoeglich) {
      console.warn(`[ki-coach] Gemini „${model}“ (${r.httpStatus}): ${r.hint.slice(0, 220)} — versuche „${naechstes}“.`)
      if (r.quotaOderRateLimit || r.httpStatus === 503) await sleepMs(800)
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
   * Nachkauf-Radar Scan — nicht Free-Tier.
   */
  geminiForcePaidApiKey?: boolean
  /** Gemini-HTTP-Timeout in ms. */
  timeoutMs?: number
}

export async function runCoachCompletion(
  provider: CoachProvider,
  apiKey: string,
  systemText: string,
  userMessages: CoachMessage[],
  options?: RunCoachCompletionOptions,
): Promise<{ ok: true; reply: string } | { ok: false; status: number; hint: string }> {
  const t = options?.temperature ?? 0.55
  const messages = options?.skipMessageTrim ? userMessages : prepareCoachMessages(userMessages)
  if (provider === 'gemini') {
    const gemini = await callGemini(
      apiKey,
      systemText,
      messages,
      {
        temperature: t,
        jsonResponse: options?.jsonResponse,
        geminiGoogleSearch: options?.geminiGoogleSearch,
        timeoutMs: options?.timeoutMs,
      },
      options?.geminiModels,
      options?.geminiForcePaidApiKey === true,
    )
    if (gemini.ok) return gemini

    const oKey = openAiApiKey()
    const kannOpenAiFallback =
      oKey &&
      !options?.jsonResponse &&
      !options?.geminiGoogleSearch &&
      !messages.some((m) => m.images?.length)
    if (kannOpenAiFallback) {
      console.warn('[ki-coach] Gemini fehlgeschlagen — Fallback auf OpenAI.')
      const openAi = await callOpenAI(oKey, systemText, messages, t, false)
      if (openAi.ok) return openAi
    }

    return gemini
  }
  return callOpenAI(apiKey, systemText, messages, t, Boolean(options?.jsonResponse))
}
