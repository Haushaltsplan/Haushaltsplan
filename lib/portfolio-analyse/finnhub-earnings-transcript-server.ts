/** Finnhub Earnings Transcripts — optional (Professional/Ultimate Plan). */

import 'server-only'

function finnhubKey(): string | null {
  const k = (process.env.FINNHUB_API_KEY ?? '').trim()
  return k || null
}

function finnhubSymbole(ticker: string, symbolYahoo?: string | null): string[] {
  const out: string[] = []
  const yahoo = symbolYahoo?.trim().toUpperCase()
  const t = ticker.trim().toUpperCase()
  if (yahoo) out.push(yahoo)
  if (t) out.push(t)
  if (yahoo?.includes('.')) out.push(yahoo.split('.')[0]!)
  if (t.includes('.')) out.push(t.split('.')[0]!)
  return [...new Set(out.filter(Boolean))]
}

export type FinnhubTranscript = {
  titel: string
  url: string
  callDatum: string | null
  text: string
}

function parseFinnhubTranskript(data: {
  title?: string
  time?: string
  transcript?: Array<{ speech?: string[]; name?: string }>
}): { titel: string; text: string; callDatum: string | null } | null {
  const parts: string[] = []
  for (const block of data.transcript ?? []) {
    const speaker = block.name?.trim()
    const speech = (block.speech ?? []).join(' ').trim()
    if (!speech) continue
    parts.push(speaker ? `${speaker}: ${speech}` : speech)
  }
  const text = parts.join('\n\n')
  if (text.length < 200) return null
  return {
    titel: data.title?.trim() || 'Earnings Call',
    text,
    callDatum: data.time ?? null,
  }
}

async function ladeFinnhubTranskriptNachId(id: string): Promise<FinnhubTranscript | null> {
  const key = finnhubKey()
  if (!key) return null

  const txUrl = new URL('https://finnhub.io/api/v1/stock/transcripts')
  txUrl.searchParams.set('id', id)
  txUrl.searchParams.set('token', key)
  const txRes = await fetch(txUrl, { cache: 'no-store' })
  if (!txRes.ok) {
    const errText = await txRes.text()
    if (/professional|premium|access/i.test(errText)) return null
    return null
  }

  const data = (await txRes.json()) as {
    title?: string
    time?: string
    transcript?: Array<{ speech?: string[]; name?: string }>
  }
  const parsed = parseFinnhubTranskript(data)
  if (!parsed) return null

  return {
    titel: parsed.titel,
    url: `https://finnhub.io/docs/api/earnings-call-transcripts-api#${id}`,
    callDatum: parsed.callDatum,
    text: parsed.text,
  }
}

export async function ladeFinnhubLetztesTranskript(
  ticker: string,
  symbolYahoo?: string | null,
): Promise<FinnhubTranscript | null> {
  const historie = await ladeFinnhubTranskriptHistorie(ticker, symbolYahoo, 1)
  return historie[0] ?? null
}

/** Bis zu `max` Transkripte — für EU/internationale Titel mit Finnhub-Plan. */
export async function ladeFinnhubTranskriptHistorie(
  ticker: string,
  symbolYahoo?: string | null,
  max = 8,
): Promise<FinnhubTranscript[]> {
  const key = finnhubKey()
  if (!key || max < 1) return []

  for (const sym of finnhubSymbole(ticker, symbolYahoo)) {
    try {
      const listUrl = new URL('https://finnhub.io/api/v1/stock/transcripts/list')
      listUrl.searchParams.set('symbol', sym)
      listUrl.searchParams.set('token', key)
      const listRes = await fetch(listUrl, { cache: 'no-store' })
      if (!listRes.ok) continue

      const list = (await listRes.json()) as Array<{ id?: string; title?: string; time?: string }>
      if (!Array.isArray(list) || list.length === 0) continue

      const out: FinnhubTranscript[] = []
      for (const row of list.slice(0, max)) {
        if (!row.id) continue
        const art = await ladeFinnhubTranskriptNachId(row.id)
        if (art) {
          out.push({
            ...art,
            titel: art.titel || row.title?.trim() || `${sym} Earnings Call`,
            callDatum: art.callDatum ?? row.time ?? null,
          })
        }
      }
      if (out.length > 0) {
        out.sort((a, b) => (b.callDatum ?? '').localeCompare(a.callDatum ?? ''))
        return out.slice(0, max)
      }
    } catch {
      continue
    }
  }
  return []
}

export function finnhubTranscriptsKonfiguriert(): boolean {
  return finnhubKey() != null
}
