import 'server-only'

import {
  geminiFreeTierFlashModelKandidaten,
  resolveCoachProviderFromMode,
  runCoachCompletion,
} from '@/lib/ki-coach-backend'
import { MOMENTUM_TRADE_PLAYBOOKS } from '@/lib/portfolio-analyse/momentum-trader/momentum-playbook-registry'
import { MOMENTUM_SCAN_SYSTEM_PROMPT } from '@/lib/portfolio-analyse/momentum-trader/momentum-scan-prompt'
import { momentumPlaybookLabel } from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import type { MomentumScanEintrag } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const TRADE_PLAYBOOKS = new Set(MOMENTUM_TRADE_PLAYBOOKS)
const MAX_KI_MEMOS = 5

async function generiereSetupMemo(e: MomentumScanEintrag): Promise<string | null> {
  const provider = resolveCoachProviderFromMode('gemini')
  if (!provider || provider.provider !== 'gemini') return null

  const ind = e.indikatoren
  const userText = [
    'Symbol: ' + e.symbol,
    'Playbook: ' + momentumPlaybookLabel(e.playbook),
    'Ampel: ' + e.ampel + ' | Score: ' + e.score + '/100',
    'Richtung: ' + String(ind.richtung ?? '—'),
    'Gap: ' + String(ind.gapPct ?? '—') + '% | RVOL: ' + String(ind.rvol ?? '—') + '×',
    'Surprise EPS: ' + String(ind.surpriseEpsPct ?? '—') + '%',
    'Guidance: ' + String(ind.guidanceFlag ?? '—'),
    'Stop: ' + String(ind.stopPrice ?? '—') + ' | Ziel: ' + String(ind.targetPrice ?? '—'),
    'Gates bestanden: ' + e.gatesPassed.join('; '),
    'Gates fehlgeschlagen: ' + e.gatesFailed.join('; '),
    '',
    'Erkläre das Setup gemäß System-Prompt.',
  ].join('\n')

  const result = await runCoachCompletion(
    provider.provider,
    provider.apiKey,
    MOMENTUM_SCAN_SYSTEM_PROMPT,
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

/** KI-Begründung für Top-Trade-Setups (optional, max. 5 Aufrufe). */
export async function ergaenzeScanMitKiMemos(
  ergebnisse: MomentumScanEintrag[],
): Promise<MomentumScanEintrag[]> {
  const kandidaten = ergebnisse
    .filter(
      (e) =>
        TRADE_PLAYBOOKS.has(e.playbook) &&
        (e.ampel === 'gruen' || e.ampel === 'gelb') &&
        !e.indikatoren.kiBegruendung,
    )
    .sort((a, b) => {
      const pa = typeof a.indikatoren.erfolgWahrscheinlichkeitPct === 'number' ? a.indikatoren.erfolgWahrscheinlichkeitPct : 0
      const pb = typeof b.indikatoren.erfolgWahrscheinlichkeitPct === 'number' ? b.indikatoren.erfolgWahrscheinlichkeitPct : 0
      return pb - pa || b.score - a.score
    })
    .slice(0, MAX_KI_MEMOS)

  if (kandidaten.length === 0) return ergebnisse

  const memos = new Map<string, string | null>()
  for (const e of kandidaten) {
    const key = e.symbol + e.playbook
    memos.set(key, await generiereSetupMemo(e))
  }

  return ergebnisse.map((e) => {
    const key = e.symbol + e.playbook
    const memo = memos.get(key)
    if (!memo) return e
    return {
      ...e,
      indikatoren: { ...e.indikatoren, kiBegruendung: memo },
    }
  })
}
