/** Einzelne Script-Felder mit Free-Key Gemini nachziehen — nie Billing-Key. */
import 'server-only'

import { geminiFreeTierFlashModelKandidaten, resolveGeminiFreeTierProvider, runCoachCompletion } from '@/lib/ki-coach-backend'
import { branchenAnker } from '@/lib/youtube/moat-branchen-anker'
import {
  antwortFuerKennzahl,
  istBeweisUebergabe,
  istOffeneBruecke,
  korrigiereCrackWortwahl,
  kuerzeGesprocheneZeile,
  oeffneSprechende,
  schliesseBeweis,
  sichereKartenZeile,
} from '@/lib/youtube/moat-short-script'
import type { StudioFeldId } from '@/lib/youtube/moat-script-supervisor'
import type { MoatShortProps } from '@/remotion/moat-short-types'

export type OptimiererKontext = {
  props: MoatShortProps
  feld: StudioFeldId
  hinweis?: string
  geschaeft?: string
}

function parseJson(reply: string): Record<string, unknown> | null {
  const t = reply.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const m = t.match(/\{[\s\S]*\}/)
  try {
    const j = JSON.parse(m ? m[0] : t) as unknown
    return j && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function text(v: unknown): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim()
}

function lokalFix(opts: OptimiererKontext): string | null {
  const { props, feld } = opts
  if (feld === 'proof') {
    if (!istBeweisUebergabe(props.proof) || !/\btypical\b/i.test(props.proof)) {
      const metrikKey = `${props.metricLabel} ${props.metricValue}`
      return antwortFuerKennzahl(
        props.metricValue,
        props.metricLabel,
        metrikKey,
        opts.geschaeft || props.business,
        branchenAnker(opts.geschaeft || props.business, metrikKey),
        props.firmenname,
      )
    }
    return schliesseBeweis(props.proof)
  }
  if (feld === 'closing' && !istOffeneBruecke(props.closing, props.metricValue)) {
    const kern = oeffneSprechende(props.closing).replace(/\bso the question is\b/i, '').trim()
    const bruecke = kern ? `${kern.replace(/[,:\s]+$/g, '')}, so the question is` : 'Nobody else has a lock like this, so the question is'
    return oeffneSprechende(bruecke)
  }
  if (feld === 'crack') {
    const t = sichereKartenZeile(korrigiereCrackWortwahl(props.crack), { label: 'The crack' })
    if (t !== props.crack.replace(/\s+/g, ' ').trim()) return t
  }
  if (feld.startsWith('pillar')) {
    const i = Number(feld.slice(6))
    const p = props.pillars[i]
    if (!p?.line) return null
    const neu = sichereKartenZeile(p.line, { label: p.label, score: p.score })
    if (neu && neu !== p.line) return neu
  }
  return null
}

function systemFuer(feld: StudioFeldId): string {
  const basis = `You are a ruthless YouTube Shorts script editor for English finance shorts.
Return JSON {"text":"..."}. One spoken line only. Digits with % (22.6% not twenty-two). No em dash. No buy/sell advice.
Company nouns only — never copy fees onto machines or drugs.`
  if (feld === 'hook') {
    return `${basis}
Rewrite the opening QUESTION. 6–10 words. Starts with Why/How/What/Is/Can. No metric number. Complete grammar.`
  }
  if (feld === 'proof') {
    return `${basis}
Rewrite sentence 2. Pattern: "While typical [peers] struggle at [anchor]%, [Company]'s [metric] hits [hero]%, and it starts with"
If the company is not higher: use clear / sits at. End exactly on "and it starts with" with no period. Keep the exact hero value and the industry anchor from the user message.`
  }
  if (feld === 'crack') {
    return `${basis}
Rewrite THE CRACK — one concrete finance threat, 8–12 words, complete sentence with period.
Use precise terms: stagnant renewal rates, fee caps, churn, regulation, export controls.
Never "stigmatized". Never social adjectives.`
  }
  if (feld === 'closing') {
    return `${basis}
Rewrite the LOOP BRIDGE. 6–12 words. Ends exactly "so the question is" with no period. No metric. Grammatical clause before the ending.`
  }
  if (feld === 'kicker') {
    return `${basis}
Rewrite the on-screen sub-label only. Prefer "vs. N% industry avg." using the anchor from the user message. Max 5 words. Not spoken.`
  }
  if (feld.startsWith('pillar')) {
    return `${basis}
Rewrite one MOAT CARD line. 8–12 words. Complete sentence: subject, verb, concrete noun object, period.
Bad: "brings massive recurring." Good: "brings massive recurring revenue."
Match the pillar score tone. No hook metric repeat on the first pillar.`
  }
  return `${basis}
Tighten the spoken line. Keep meaning. Complete grammar.`
}

function userFuer(opts: OptimiererKontext): string {
  const { props, feld, hinweis } = opts
  const anker = branchenAnker(opts.geschaeft || props.business, '')
  const lines = [
    `Company: ${props.firmenname} (${props.ticker})`,
    `Business: ${(opts.geschaeft || props.business || '').slice(0, 400)}`,
    `Hero metric: ${props.metricLabel} = ${props.metricValue}`,
    `Industry anchor: typical ${anker.peers} at ${anker.value}`,
    `Current hook: ${props.hook}`,
    `Current proof: ${props.proof}`,
    `Pillars: ${props.pillars.map((p) => `${p.label} ${p.score}/10: ${p.line}`).join(' | ')}`,
    `Crack: ${props.crack}`,
    `Closing: ${props.closing}`,
    hinweis ? `Fix this issue: ${hinweis}` : null,
    `Field to rewrite: ${feld}`,
  ]
  if (feld.startsWith('pillar')) {
    const i = Number(feld.slice(6))
    const p = props.pillars[i]
    lines.push(`Pillar to rewrite: ${p?.label ?? ''} score ${p?.score ?? ''} text: ${p?.line ?? ''}`)
  } else if (feld === 'hook') lines.push(`Text now: ${props.hook}`)
  else if (feld === 'proof') lines.push(`Text now: ${props.proof}`)
  else if (feld === 'crack') lines.push(`Text now: ${props.crack}`)
  else if (feld === 'closing') lines.push(`Text now: ${props.closing}`)
  else if (feld === 'kicker') lines.push(`Text now: ${props.kicker}`)
  return lines.filter(Boolean).join('\n')
}

function nachziehen(feld: StudioFeldId, roh: string, props: MoatShortProps): string {
  let t = text(roh)
  if (feld === 'proof') t = schliesseBeweis(t)
  if (feld === 'closing') t = oeffneSprechende(t.includes('so the question is') ? t : `${t}, so the question is`)
  if (feld === 'crack') t = sichereKartenZeile(korrigiereCrackWortwahl(t), { label: 'The crack' })
  if (feld.startsWith('pillar')) {
    const i = Number(feld.slice(6))
    const p = props.pillars[i]
    t = sichereKartenZeile(t, { label: p?.label, score: p?.score })
  }
  if (feld === 'hook') t = kuerzeGesprocheneZeile(t, { maxWoerter: 10, maxZeichen: 78, frage: true })
  if (feld === 'kicker') {
    t = t.replace(/[.!?…]/g, '').trim()
    if (!t) t = `vs. ${branchenAnker(props.business, '').value} industry avg.`
  }
  return t
}

/** Optimiert ein Feld. Zuerst lokale Regeln, sonst Free-Gemini. */
export async function optimiereScriptFeld(opts: OptimiererKontext): Promise<{ text: string; quelle: 'lokal' | 'ki' }> {
  if (opts.feld === 'gesamt') throw new Error('Gesamt ist kein einzelnes Feld.')
  const lokal = lokalFix(opts)
  if (lokal && lokal.trim() && lokal.trim() !== feldText(opts).trim()) {
    return { text: nachziehen(opts.feld, lokal, opts.props), quelle: 'lokal' }
  }

  const provider = resolveGeminiFreeTierProvider()
  if (!provider) throw new Error('GEMINI_API_KEY_FREE fehlt.')

  const result = await runCoachCompletion(
    provider.provider,
    provider.apiKey,
    systemFuer(opts.feld),
    [{ role: 'user', content: userFuer(opts) }],
    {
      geminiModels: geminiFreeTierFlashModelKandidaten(),
      geminiForceFreeApiKey: true,
      jsonResponse: {
        schema: {
          type: 'object',
          properties: { text: { type: 'string' } },
          required: ['text'],
        },
      },
      maxOutputTokens: 400,
      timeoutMs: 45_000,
      geminiTotalBudgetMs: 55_000,
    },
  )
  if (!result.ok) throw new Error(result.hint || 'Optimierung fehlgeschlagen.')
  const roh = parseJson(result.reply)
  const textOut = nachziehen(opts.feld, text(roh?.text), opts.props)
  if (!textOut) throw new Error('Die KI lieferte keinen Text.')
  return { text: textOut, quelle: 'ki' }
}

function feldText(opts: OptimiererKontext): string {
  const { props, feld } = opts
  if (feld === 'hook') return props.hook
  if (feld === 'proof') return props.proof
  if (feld === 'crack') return props.crack
  if (feld === 'closing') return props.closing
  if (feld === 'kicker') return props.kicker
  if (feld.startsWith('pillar')) return props.pillars[Number(feld.slice(6))]?.line ?? ''
  return ''
}

export function wendeOptimierungAn(props: MoatShortProps, feld: StudioFeldId, textNeu: string): MoatShortProps {
  if (feld === 'hook') return { ...props, hook: textNeu }
  if (feld === 'proof') {
    return {
      ...props,
      proof: textNeu,
      heroMetric: props.heroMetric
        ? { ...props.heroMetric, spoken_reference: textNeu }
        : { value: props.metricValue, label: props.metricLabel, context_note: '', spoken_reference: textNeu },
    }
  }
  if (feld === 'crack') return { ...props, crack: textNeu }
  if (feld === 'closing') return { ...props, closing: textNeu }
  if (feld === 'kicker') return { ...props, kicker: textNeu }
  if (feld.startsWith('pillar')) {
    const i = Number(feld.slice(6))
    return {
      ...props,
      pillars: props.pillars.map((p, j) => (j === i ? { ...p, line: textNeu } : p)),
    }
  }
  return props
}
