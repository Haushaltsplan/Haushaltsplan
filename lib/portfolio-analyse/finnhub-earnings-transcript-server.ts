/** Finnhub Earnings Transcripts — optional (Professional/Ultimate Plan). */

import 'server-only'

function finnhubKey(): string | null {
  const k = (process.env.FINNHUB_API_KEY ?? '').trim()
  return k || null
}

function finnhubSymbole(sym: string): string[] {
  const t = sym.trim().toUpperCase()
  if (!t) return []
  const out = [t]
  if (t.includes('.')) out.push(t.split('.')[0])
  return [...new Set(out)]
}

export type FinnhubTranscript = {
  titel: string
  url: string
  callDatum: string | null
  text: string
}

export async function ladeFinnhubLetztesTranskript(ticker: string): Promise<FinnhubTranscript | null> {
  const key = finnhubKey()
  if (!key) return null

  for (const sym of finnhubSymbole(ticker)) {
    try {
      const listUrl = new URL('https://finnhub.io/api/v1/stock/transcripts/list')
      listUrl.searchParams.set('symbol', sym)
      listUrl.searchParams.set('token', key)
      const listRes = await fetch(listUrl, { cache: 'no-store' })
      if (!listRes.ok) continue

      const list = (await listRes.json()) as Array<{ id?: string; title?: string; time?: string }>
      const latest = Array.isArray(list) ? list[0] : null
      if (!latest?.id) continue

      const txUrl = new URL('https://finnhub.io/api/v1/stock/transcripts')
      txUrl.searchParams.set('id', latest.id)
      txUrl.searchParams.set('token', key)
      const txRes = await fetch(txUrl, { cache: 'no-store' })
      if (!txRes.ok) {
        const errText = await txRes.text()
        if (/professional|premium|access/i.test(errText)) return null
        continue
      }

      const data = (await txRes.json()) as {
        title?: string
        time?: string
        transcript?: Array<{ speech?: string[]; name?: string }>
      }

      const parts: string[] = []
      for (const block of data.transcript ?? []) {
        const speaker = block.name?.trim()
        const speech = (block.speech ?? []).join(' ').trim()
        if (!speech) continue
        parts.push(speaker ? `${speaker}: ${speech}` : speech)
      }
      const text = parts.join('\n\n')
      if (text.length < 200) continue

      return {
        titel: data.title?.trim() || latest.title?.trim() || `${sym} Earnings Call`,
        url: `https://finnhub.io/docs/api/earnings-call-transcripts-api`,
        callDatum: data.time ?? latest.time ?? null,
        text,
      }
    } catch {
      continue
    }
  }
  return null
}

export function finnhubTranscriptsKonfiguriert(): boolean {
  return finnhubKey() != null
}
