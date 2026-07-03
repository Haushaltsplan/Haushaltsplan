import 'server-only'

import {
  geminiFreeTierFlashModelKandidaten,
  resolveCoachProviderFromMode,
  runCoachCompletion,
} from '@/lib/ki-coach-backend'
import { momentumPlaybookLabel } from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import type { MomentumScanEintrag } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const PRE_EVENT_PLAYBOOKS = new Set(['earnings_pre_event', 'earnings_vorlauf'])
const MAX_PRE_EVENT_MEMOS = 3

const PRE_EVENT_SYSTEM_PROMPT = `Du bist ein nüchterner Earnings-Strategie-Assistent (Deutsch).
Aufgabe: Pre-Event-Vorbereitung erklären — KEIN konkreter Trade vor den Zahlen.
Max. 120 Wörter. Keine Anlageberatung. Keine Richtungs-Wette vor dem Event.
Nenne: historisches Gap-Profil, Lauf vor Earnings, Beat-Historie, welche Szenarien nach den Zahlen zu prüfen sind.
Betone: erst nach Reaktion handeln.`

async function generierePreEventMemo(e: MomentumScanEintrag): Promise<string | null> {
  const provider = resolveCoachProviderFromMode('gemini')
  if (!provider || provider.provider !== 'gemini') return null

  const ind = e.indikatoren
  const userText = [
    'Symbol: ' + e.symbol,
    'Playbook: ' + momentumPlaybookLabel(e.playbook),
    'Score: ' + e.score + '/100 | Stufe: ' + String(ind.vorbereitungStufe ?? '—'),
    'Earnings in: ' + String(ind.tageBisEarnings ?? '—') + ' Tagen',
    'Median-Gap: ' + String(ind.medianGapPct ?? '—') + '%',
    '20-Tage-Lauf: ' + String(ind.laufVorEarningsPct ?? '—') + '%',
    'Beat-Rate: ' + String(ind.beatRatePct ?? '—') + '%',
    'ATR-Faktor: ' + String(ind.atrElevationsFaktor ?? '—'),
    'Szenario-Plan:',
    String(ind.szenarioPlan ?? '—'),
    '',
    'Fasse die Vorbereitung sachlich zusammen.',
  ].join('\n')

  const result = await runCoachCompletion(
    provider.provider,
    provider.apiKey,
    PRE_EVENT_SYSTEM_PROMPT,
    [{ role: 'user', content: userText }],
    {
      temperature: 0.2,
      skipMessageTrim: true,
      geminiModels: geminiFreeTierFlashModelKandidaten({
        primaryEnvKeys: ['MOMENTUM_SCAN_GEMINI_MODEL', 'FINANCE_COACH_GEMINI_MODEL', 'GEMINI_MODEL'],
      }),
    },
  )

  return result.ok ? result.reply.trim() : null
}

/** KI-Memo für Pre-Event-Katalysatoren (max. 3). */
export async function ergaenzePreEventMitKiMemos(
  ergebnisse: MomentumScanEintrag[],
): Promise<MomentumScanEintrag[]> {
  const kandidaten = ergebnisse
    .filter(
      (e) =>
        PRE_EVENT_PLAYBOOKS.has(e.playbook) &&
        e.ampel === 'gelb' &&
        !e.indikatoren.kiBegruendung,
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PRE_EVENT_MEMOS)

  if (kandidaten.length === 0) return ergebnisse

  const memos = new Map<string, string | null>()
  for (const e of kandidaten) {
    memos.set(e.symbol + e.playbook, await generierePreEventMemo(e))
  }

  return ergebnisse.map((e) => {
    const memo = memos.get(e.symbol + e.playbook)
    if (!memo) return e
    return { ...e, indikatoren: { ...e.indikatoren, kiBegruendung: memo } }
  })
}
