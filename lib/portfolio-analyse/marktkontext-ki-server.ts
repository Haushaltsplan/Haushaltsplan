/** Marktkontext via Gemini Google Search Grounding — ergänzt KI-Zusammenfassungen. */

import 'server-only'

import { resolveCoachProviderFromMode, runCoachCompletion, earningsCallGeminiModelKandidaten } from '@/lib/ki-coach-backend'
import { MARKTKONTEXT_SYSTEM_PROMPT } from './marktkontext-prompt'

export function marktkontextKiAktiv(): boolean {
  const v = (process.env.PORTFOLIO_KI_MARKTKONTEXT ?? '1').trim().toLowerCase()
  return v !== '0' && v !== 'false' && v !== 'off'
}

export async function ergaenzeMarktkontextKi(opts: {
  ticker: string
  firmenname?: string | null
  basisZusammenfassung: string
  berichtLabel?: string
}): Promise<string | null> {
  if (!marktkontextKiAktiv()) return null

  const provider = resolveCoachProviderFromMode('gemini')
  if (!provider || provider.provider !== 'gemini') return null

  const name = opts.firmenname?.trim() || opts.ticker
  const userText = [
    `Unternehmen: ${name} (${opts.ticker})`,
    opts.berichtLabel ? `Kontext: ${opts.berichtLabel}` : '',
    '',
    '--- BEREITS ERSTELLTE ANALYSE (Auszug) ---',
    opts.basisZusammenfassung.slice(0, 8_000),
    '',
    'Ergänze einen aktuellen Marktkontext via Websuche. Keine Wiederholung der Analyse.',
  ]
    .filter(Boolean)
    .join('\n')

  const result = await runCoachCompletion(
    provider.provider,
    provider.apiKey,
    MARKTKONTEXT_SYSTEM_PROMPT,
    [{ role: 'user', content: userText }],
    {
      temperature: 0.35,
      skipMessageTrim: true,
      geminiGoogleSearch: true,
      geminiModels: earningsCallGeminiModelKandidaten(),
    },
  )

  if (!result.ok || !result.reply.trim()) return null
  return result.reply.trim()
}

export async function zusammenfassungMitMarktkontext(
  basis: string,
  opts: { ticker: string; firmenname?: string | null; berichtLabel?: string },
): Promise<string> {
  try {
    const markt = await ergaenzeMarktkontextKi({ ...opts, basisZusammenfassung: basis })
    if (!markt) return basis
    return `${basis.trim()}\n\n${markt}`
  } catch (e) {
    console.warn('Marktkontext-KI fehlgeschlagen', e)
    return basis
  }
}
