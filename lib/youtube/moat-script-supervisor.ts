/**
 * YouTube-Shorts-Überwacher — rein lokal, kein API-Call.
 * Prüft jedes gesprochene Feld und den Gesamtrahmen für Moat-Shorts.
 */

import { fremdeZahlen } from '@/lib/youtube/moat-short-zahlen'
import type { MoatShortMetrik } from '@/lib/youtube/moat-short-types'
import {
  doppelteWendung,
  istBeweisUebergabe,
  istOffeneBruecke,
  istUnvollstaendigerSprechsatz,
  schaetzeSprechsekunden,
  scriptLoopWarnungen,
  scriptStoryWarnungen,
  scriptTonWarnungen,
} from '@/lib/youtube/moat-short-script'
import type { MoatShortProps } from '@/remotion/moat-short-types'

export type StudioFeldId =
  | 'kicker'
  | 'hook'
  | 'proof'
  | 'pillar0'
  | 'pillar1'
  | 'pillar2'
  | 'pillar3'
  | 'crack'
  | 'closing'
  | 'gesamt'

export type SupervisorStufe = 'ok' | 'warn' | 'fail'

export type SupervisorFund = {
  id: string
  feld: StudioFeldId
  stufe: SupervisorStufe
  titel: string
  hinweis: string
  /** Kann mit dem KI-Optimierer für dieses Feld behoben werden. */
  optimierbar: boolean
}

export type SupervisorBericht = {
  score: number
  ok: number
  warn: number
  fail: number
  sekunden: number
  dauerOk: boolean
  funds: SupervisorFund[]
  bereit: boolean
}

function woerter(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

function fund(
  id: string,
  feld: StudioFeldId,
  stufe: SupervisorStufe,
  titel: string,
  hinweis: string,
  optimierbar = true,
): SupervisorFund {
  return { id, feld, stufe, titel, hinweis, optimierbar }
}

/** Ein Durchlauf über Props + Metriken. Tempo steuert die Dauer-Schätzung. */
export function pruefeMoatScript(
  props: MoatShortProps,
  metriken: MoatShortMetrik[],
  tempo = 1.15,
): SupervisorBericht {
  const funds: SupervisorFund[] = []
  const spoken = [props.hook, props.proof, ...props.pillars.map((p) => p.line), props.crack, props.closing]
  const sekunden = schaetzeSprechsekunden(spoken, tempo)
  const dauerOk = sekunden >= 27 && sekunden <= 32

  if (!dauerOk) {
    funds.push(
      fund(
        'dauer',
        'gesamt',
        sekunden < 24 || sekunden > 36 ? 'fail' : 'warn',
        'Länge',
        `Geschätzt ~${sekunden.toFixed(0)}s. Shorts-Ziel 27–32s. Kürze oder strecke einzelne Zeilen manuell / per KI-Hinweis.`,
        false,
      ),
    )
  }

  if (!props.hook.trim() || !/\?\s*$/.test(props.hook.trim())) {
    funds.push(fund('hook-frage', 'hook', 'fail', 'Frage', 'Der Einstieg muss eine komplette Frage sein.', true))
  } else if (props.metricValue && props.hook.includes(props.metricValue)) {
    funds.push(fund('hook-zahl', 'hook', 'fail', 'Frage', 'Die Hero-Zahl gehört nicht in die Frage.', true))
  } else if (woerter(props.hook).length > 12) {
    funds.push(fund('hook-lang', 'hook', 'warn', 'Frage', 'Die Frage ist lang — Untertitel brechen leicht.', true))
  }

  if (!props.proof.trim()) {
    funds.push(fund('proof-leer', 'proof', 'fail', 'Antwort', 'Satz 2 fehlt.', true))
  } else {
    if (!props.proof.includes(props.metricValue)) {
      funds.push(fund('proof-zahl', 'proof', 'fail', 'Antwort', `Die Antwort muss ${props.metricValue} enthalten.`, true))
    }
    if (!istBeweisUebergabe(props.proof)) {
      funds.push(fund('proof-handoff', 'proof', 'fail', 'Antwort', 'Muss offen enden: „and it starts with“.', true))
    }
    if (/\bproving\b|market lock|strong fundamentals/i.test(props.proof)) {
      funds.push(fund('proof-abstract', 'proof', 'fail', 'Antwort', 'Keine BWL-Floskel. Branchenvergleich + Handoff.', true))
    }
    if (!/\btypical\b/i.test(props.proof)) {
      funds.push(fund('proof-peer', 'proof', 'warn', 'Antwort', 'Branchenanker fehlt („While typical …“).', true))
    }
    if (istUnvollstaendigerSprechsatz(props.proof.replace(/,?\s*and it starts with[.!?…]*$/i, ''))) {
      funds.push(fund('proof-stummel', 'proof', 'warn', 'Antwort', 'Der Teil vor dem Handoff klingt abgeschnitten.', true))
    }
  }

  props.pillars.forEach((p, i) => {
    const feld = `pillar${i}` as StudioFeldId
    if (!p.line.trim()) {
      funds.push(fund(`${feld}-leer`, feld, 'fail', p.label, 'Moat-Karte ohne Satz.', true))
      return
    }
    if (istUnvollstaendigerSprechsatz(p.line)) {
      funds.push(
        fund(`${feld}-stummel`, feld, 'fail', p.label, 'Unvollständiger Satz — Subjekt, Verb, Objekt, Punkt.', true),
      )
    } else if (woerter(p.line).length > 14 || p.line.length > 78) {
      funds.push(fund(`${feld}-lang`, feld, 'warn', p.label, 'Zu lang für eine Caption-Zeile.', true))
    } else if (woerter(p.line).length < 7) {
      funds.push(fund(`${feld}-kurz`, feld, 'warn', p.label, 'Zu kurz, klingt nach Slogan.', true))
    }
  })

  if (!props.crack.trim()) {
    funds.push(fund('crack-leer', 'crack', 'fail', 'The Crack', 'Das Risiko fehlt.', true))
  } else {
    if (istUnvollstaendigerSprechsatz(props.crack)) {
      funds.push(fund('crack-stummel', 'crack', 'fail', 'The Crack', 'Unvollständiger Risikosatz.', true))
    }
    if (/\bstigmatiz/i.test(props.crack)) {
      funds.push(fund('crack-wort', 'crack', 'fail', 'The Crack', 'Falsches Wort — „stagnant“, nicht „stigmatized“.', true))
    }
  }

  if (!istOffeneBruecke(props.closing, props.metricValue)) {
    funds.push(
      fund('closing-bridge', 'closing', 'fail', 'Landung', 'Muss offen auf „so the question is“ enden.', true),
    )
  } else if (props.metricValue && props.closing.includes(props.metricValue)) {
    funds.push(fund('closing-zahl', 'closing', 'fail', 'Landung', 'Keine Hero-Zahl in der Landung.', true))
  }

  const kicker = props.kicker.trim()
  if (kicker && !/^vs\.?\s+\d/i.test(kicker) && woerter(kicker).length > 5) {
    funds.push(fund('kicker-lang', 'kicker', 'warn', 'Blickfang', 'Max. 5 Wörter oder „vs. N% industry avg.“.', true))
  }

  const doppel = doppelteWendung(props)
  if (doppel) funds.push(fund('doppel', 'gesamt', 'fail', 'Fluss', doppel, true))

  if (/[.!?…,:;—–-]\s+(?:an?\s+)?\d/.test([props.proof, props.hook, props.crack, props.closing].join(' '))) {
    funds.push(fund('pause-zahl', 'gesamt', 'fail', 'Fluss', 'Satzzeichen vor der Zahl — die Stimme pausiert.', true))
  }

  for (const w of scriptLoopWarnungen(props.hook, props.closing, props.metricValue, props.proof, props.metricLabel)) {
    if (funds.some((f) => f.hinweis === w)) continue
    funds.push(fund(`loop-${funds.length}`, 'proof', 'warn', 'Loop', w, true))
  }
  for (const w of scriptStoryWarnungen(props.hookLoop, props.crack)) {
    funds.push(fund(`story-${funds.length}`, 'crack', 'warn', 'Story', w, true))
  }
  for (const w of scriptTonWarnungen(spoken)) {
    funds.push(fund(`ton-${funds.length}`, 'gesamt', 'warn', 'Ton', w, true))
  }

  const scores = [props.score, ...props.pillars.map((p) => p.score)]
  const fremd = fremdeZahlen(spoken.join(' '), metriken, scores)
  if (fremd.length) {
    funds.push(
      fund('zahlen', 'gesamt', 'fail', 'Zahlen', `Ohne Quelle: ${fremd.join(', ')}.`, false),
    )
  }

  const fail = funds.filter((f) => f.stufe === 'fail').length
  const warn = funds.filter((f) => f.stufe === 'warn').length
  const okChecks = Math.max(0, 12 - fail - warn)
  const score = Math.max(0, Math.min(100, Math.round(100 - fail * 14 - warn * 5)))
  return {
    score,
    ok: okChecks,
    warn,
    fail,
    sekunden,
    dauerOk,
    funds,
    bereit: fail === 0 && dauerOk,
  }
}

export function felderZumOptimieren(bericht: SupervisorBericht): StudioFeldId[] {
  const set = new Set<StudioFeldId>()
  for (const f of bericht.funds) {
    if (f.stufe === 'ok' || !f.optimierbar) continue
    if (f.feld === 'gesamt') {
      set.add('hook')
      set.add('proof')
      set.add('crack')
      set.add('closing')
      continue
    }
    set.add(f.feld)
  }
  return [...set]
}

export function felderLabel(id: StudioFeldId): string {
  if (id === 'hook') return 'Frage'
  if (id === 'proof') return 'Antwort'
  if (id === 'kicker') return 'Blickfang'
  if (id === 'crack') return 'The Crack'
  if (id === 'closing') return 'Landung'
  if (id === 'gesamt') return 'Gesamt'
  if (id.startsWith('pillar')) return `Moat-Karte ${Number(id.slice(6)) + 1}`
  return id
}
