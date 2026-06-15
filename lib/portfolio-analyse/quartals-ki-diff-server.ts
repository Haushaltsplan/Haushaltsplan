import 'server-only'

import { ladeEarningsCallKiCacheEintrag } from '@/lib/portfolio-analyse/earnings-call-unternehmen-cache-server'
import { QUARTALS_KI_DIFF_SYSTEM_PROMPT } from '@/lib/portfolio-analyse/quartals-ki-diff-prompt'
import {
  ladeQuartalsKiDiffCache,
  speichereQuartalsKiDiffCache,
} from '@/lib/portfolio-analyse/quartals-ki-diff-cache-server'
import type { QuartalsKiDiffAnfrage, QuartalsKiDiffPaket } from '@/lib/portfolio-analyse/quartals-ki-diff-types'
import { ladeSecBerichtKiCacheEintrag } from '@/lib/portfolio-analyse/sec-berichte-ki-cache-server'
import { resolveCoachProviderFromMode, runCoachCompletion, earningsCallGeminiModelKandidaten } from '@/lib/ki-coach-backend'

async function summaryEarnings(ticker: string, quartalId: string): Promise<string | null> {
  const hit = await ladeEarningsCallKiCacheEintrag(ticker, quartalId)
  return hit?.zusammenfassung?.trim() || null
}

async function summarySec(ticker: string, berichtId: string): Promise<string | null> {
  const hit = await ladeSecBerichtKiCacheEintrag(ticker, berichtId)
  return hit?.zusammenfassung?.trim() || null
}

export async function ladeQuartalsKiDiff(anfrage: QuartalsKiDiffAnfrage): Promise<QuartalsKiDiffPaket> {
  const ticker = anfrage.ticker?.trim().toUpperCase() ?? ''
  const aktuellId = anfrage.aktuellId?.trim() ?? ''
  const vorherId = anfrage.vorherId?.trim() ?? ''
  const typ = anfrage.typ

  const leer = (fehler: string): QuartalsKiDiffPaket => ({
    ok: false,
    ticker,
    typ,
    aktuellId,
    vorherId,
    aktuellLabel: null,
    vorherLabel: null,
    diff: null,
    geladenAm: new Date().toISOString(),
    ausCache: false,
    fehler,
  })

  if (!ticker || !aktuellId || !vorherId) return leer('Ticker und Perioden-IDs erforderlich.')

  if (!anfrage.force) {
    const cached = await ladeQuartalsKiDiffCache(ticker, typ, aktuellId, vorherId)
    if (cached) {
      return {
        ok: true,
        ticker,
        typ,
        aktuellId,
        vorherId,
        aktuellLabel: aktuellId,
        vorherLabel: vorherId,
        diff: cached,
        geladenAm: new Date().toISOString(),
        ausCache: true,
      }
    }
  }

  const aktuell =
    typ === 'earnings_call'
      ? await summaryEarnings(ticker, aktuellId)
      : await summarySec(ticker, aktuellId)
  const vorher =
    typ === 'earnings_call'
      ? await summaryEarnings(ticker, vorherId)
      : await summarySec(ticker, vorherId)

  if (!aktuell || !vorher) {
    return leer(
      'Beide KI-Zusammenfassungen müssen existieren. Bitte zuerst aktuelles und Vorquartal in Quartalszahlen öffnen.',
    )
  }

  const provider = resolveCoachProviderFromMode('gemini')
  if (!provider) return leer('KI nicht konfiguriert (GEMINI_API_KEY).')

  const userText = [
    `Unternehmen: ${anfrage.firmenname?.trim() || ticker} (${ticker})`,
    `Vergleich: ${vorherId} → ${aktuellId}`,
    '',
    '--- VORPERIODE ---',
    vorher.slice(0, 12_000),
    '',
    '--- AKTUELLE PERIODE ---',
    aktuell.slice(0, 12_000),
  ].join('\n')

  const result = await runCoachCompletion(
    provider.provider,
    provider.apiKey,
    QUARTALS_KI_DIFF_SYSTEM_PROMPT,
    [{ role: 'user', content: userText }],
    {
      temperature: 0.35,
      skipMessageTrim: true,
      geminiModels: earningsCallGeminiModelKandidaten(),
    },
  )

  if (!result.ok) return leer(result.hint)

  const diff = result.reply.trim()
  await speichereQuartalsKiDiffCache({ ticker, typ, aktuellId, vorherId, diff })

  return {
    ok: true,
    ticker,
    typ,
    aktuellId,
    vorherId,
    aktuellLabel: aktuellId,
    vorherLabel: vorherId,
    diff,
    geladenAm: new Date().toISOString(),
    ausCache: false,
  }
}
