/**
 * Skript-Pipeline (Billing-Key, Gemini 4):
 * Argon schreibt Hooks und Abschnitte, Carbon prüft Behauptungen, Hydrogen formuliert einzelne Sätze um.
 * Zahlen kommen nur aus dem Faktenblatt; `longform-pruefung` kontrolliert das danach ohne KI.
 */
import 'server-only'

import { resolveCoachProviderFromMode, runCoachCompletion, type CoachMessage } from '@/lib/ki-coach-backend'
import { hookKatalogFuerPrompt } from '@/lib/youtube/longform/longform-abwechslung'
import { faktenFuerPrompt } from '@/lib/youtube/longform/longform-fakten'
import {
  LONGFORM_ABSCHNITT_TITEL,
  LONGFORM_AKTIVE_ABSCHNITTE,
  LONGFORM_HOOK_TYPEN,
  LONGFORM_SZENEN,
  type LongformAbschnitt,
  type LongformAbschnittId,
  type LongformFaktenblatt,
  type LongformHookTyp,
  type LongformHookVorschlag,
  type LongformProjektZustand,
  type LongformSatz,
  type LongformSkript,
  type LongformSzenenTyp,
} from '@/lib/youtube/longform/longform-types'

export type LongformDokument = { name: string; mime: string; base64: string }

function kette(envKey: string, standard: string[]): string[] {
  const env = process.env[envKey]?.split(/[,;\s]+/).filter(Boolean) ?? []
  return [...new Set([...env, ...standard])]
}

const MODELLE = {
  schreiben: () => kette('LONGFORM_GEMINI_SCHREIBEN', ['gemini-4-argon', 'gemini-3.1-pro-preview']),
  pruefen: () => kette('LONGFORM_GEMINI_PRUEFEN', ['gemini-4-carbon', 'gemini-4-argon', 'gemini-3.1-pro-preview']),
  klein: () => kette('LONGFORM_GEMINI_KLEIN', ['gemini-4-hydrogen', 'gemini-3.8-flash']),
}

type Stufe = 'low' | 'medium' | 'high'

async function frage<T>(opts: {
  rolle: keyof typeof MODELLE
  system: string
  nutzer: string
  dokumente?: LongformDokument[]
  schema: Record<string, unknown>
  denkstufe: Stufe
  maxTokens?: number
}): Promise<{ daten: T; modell: string }> {
  const provider = resolveCoachProviderFromMode('gemini')
  if (!provider || provider.provider !== 'gemini') throw new Error('GEMINI_API_KEY fehlt (Long-Form nutzt den Billing-Key).')
  const nachricht: CoachMessage = {
    role: 'user',
    content: opts.nutzer,
    ...(opts.dokumente?.length ? { images: opts.dokumente.map((d) => ({ mimeType: d.mime, base64: d.base64 })) } : {}),
  }
  const r = await runCoachCompletion(provider.provider, provider.apiKey, opts.system, [nachricht], {
    geminiModels: MODELLE[opts.rolle](),
    geminiForcePaidApiKey: true,
    jsonResponse: { schema: opts.schema },
    skipMessageTrim: true,
    thinkingLevel: opts.denkstufe,
    timeoutMs: 240_000,
    geminiTotalBudgetMs: 280_000,
    maxOutputTokens: opts.maxTokens ?? 32_768,
  })
  if (!r.ok) throw new Error(r.hint)
  try {
    return { daten: JSON.parse(r.reply) as T, modell: r.model ?? MODELLE[opts.rolle]()[0]! }
  } catch {
    throw new Error('Gemini lieferte kein gültiges JSON. Bitte nochmal versuchen.')
  }
}

const STIL = `You write long-form YouTube stock analyses in English for a calm, sharp, independent investor who narrates with his own cloned voice.
Voice: confident, warm, slightly dry humour, zero hype. Talk to one viewer ("you"). Use contractions.
Sentences are spoken by text-to-speech: 6 to 24 words, one idea each, no lists, no brackets, no emojis, no abbreviations the voice could misread (write "percent" only via the % sign attached to a number).
Every number you write must be copied exactly from the FACT SHEET text column and its fact id listed in faktIds. Never compute, round differently, convert or invent numbers, dates, names or events. If a fact is missing, say it qualitatively or leave it out.
Qualitative claims must come from the company description, the moat check texts or the attached documents. No outside knowledge about recent news, products or people unless it is in the sources.
Banned phrases: "let's dive in", "in today's video", "without further ado", "game changer", "buckle up", "at the end of the day", "it's worth noting", "delve", "testament to", "stay tuned", "no-brainer", "smash that like button".
Transitions grow out of the content (a number, a tension, a question), never "now let's look at".`

function kontext(fb: LongformFaktenblatt, thema: string): string {
  const m = fb.moat
  return [
    `COMPANY: ${fb.firmenname} (${fb.ticker})${fb.sektor ? `, sector ${fb.sektor}` : ''}${fb.branche ? `, industry ${fb.branche}` : ''}`,
    `VIDEO TOPIC FROM THE CREATOR: ${thema || '(none given, choose the most interesting angle the data supports)'}`,
    fb.beschreibung ? `COMPANY DESCRIPTION (German source, translate meaning only):\n${fb.beschreibung.slice(0, 2500)}` : '',
    m
      ? `MOAT CHECK (app assessment, German source):\nBusiness model: ${m.geschaeftsmodell}\n${m.pfeiler
          .map((p) => `- ${p.label} ${p.score}/10: ${p.begruendung} Risk: ${p.risiko}`)
          .join('\n')}\nWhat could break it: ${m.zerstoerung.join(' | ')}`
      : 'MOAT CHECK: not available.',
    fb.burggraben
      ? `SCORECARD MOAT COLUMN (quality ${fb.burggraben.score ?? 'n/a'}/10):\n${fb.burggraben.balken.map((b) => `- ${b.label}: ${b.wertText}`).join('\n')}`
      : '',
    fb.segmente ? `REVENUE MIX available (${fb.segmente.art}).` : 'REVENUE MIX: not available, do not use scene moat_segmente.',
    `FACT SHEET (id | label | allowed text | date):\n${faktenFuerPrompt(fb)}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

const SATZ_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    faktIds: { type: 'array', items: { type: 'string' } },
    szene: { type: 'string', enum: [...LONGFORM_SZENEN] },
    fokus: { type: 'string' },
    betonung: { type: 'string' },
    bildWunsch: { type: 'string' },
  },
  required: ['text', 'faktIds', 'szene'],
}

type SatzRoh = { text: string; faktIds?: string[]; szene?: string; fokus?: string; betonung?: string; bildWunsch?: string }

const SZENEN_JE_ABSCHNITT: Partial<Record<LongformAbschnittId, LongformSzenenTyp[]>> = {
  hook: ['hook_zahl', 'hook_frage', 'hook_bild', 'titel_karte'],
  chart10k: ['chart_linie', 'chart_endwert', 'chart_drawdown', 'chart_vergleich', 'bild'],
  burggraben: ['moat_geschaeft', 'moat_pfeiler', 'moat_scorecard', 'moat_segmente', 'bild'],
}

let satzZaehler = 0
function neueSatzId(abschnitt: string): string {
  satzZaehler = (satzZaehler + 1) % 1_000_000
  return `${abschnitt}-${Date.now().toString(36)}-${satzZaehler.toString(36)}`
}

function satzAusRoh(r: SatzRoh, abschnitt: LongformAbschnittId, fb: LongformFaktenblatt): LongformSatz {
  const erlaubt = SZENEN_JE_ABSCHNITT[abschnitt] ?? [...LONGFORM_SZENEN]
  let szene = (LONGFORM_SZENEN as readonly string[]).includes(r.szene ?? '') ? (r.szene as LongformSzenenTyp) : erlaubt[0]!
  if (!erlaubt.includes(szene)) szene = erlaubt[0]!
  if (szene === 'moat_segmente' && !fb.segmente) szene = 'moat_geschaeft'
  if (szene === 'chart_drawdown' && !fb.chart?.drawdown) szene = 'chart_linie'
  if (szene === 'chart_vergleich' && fb.chart?.endwertSpy == null) szene = 'chart_endwert'
  if ((szene === 'moat_pfeiler' || szene === 'moat_scorecard') && !fb.moat && !fb.burggraben) szene = 'moat_geschaeft'
  return {
    id: neueSatzId(abschnitt),
    text: r.text.replace(/\s+/g, ' ').trim(),
    faktIds: [...new Set(r.faktIds ?? [])],
    visual: {
      szene,
      fokus: r.fokus?.trim() || null,
      betonung: r.betonung?.trim() || null,
      bildWunsch: r.bildWunsch?.trim() || null,
    },
  }
}

export async function erzeugeHooks(opts: {
  zustand: LongformProjektZustand
  gesperrt: LongformHookTyp[]
  fruehereLeitfragen: string[]
  dokumente: LongformDokument[]
}): Promise<LongformHookVorschlag[]> {
  const fb = opts.zustand.faktenblatt
  const nutzer = [
    kontext(fb, opts.zustand.thema),
    `ALLOWED HOOK TYPES (pick three different ones that the data genuinely supports):\n${hookKatalogFuerPrompt(opts.gesperrt)}`,
    opts.fruehereLeitfragen.length ? `GUIDING QUESTIONS OF RECENT VIDEOS (do not reuse their angle or wording):\n${opts.fruehereLeitfragen.map((q) => `- ${q}`).join('\n')}` : '',
    `TASK: Propose exactly 3 openings for this video. Each has a guiding question (leitfrage) that the whole video will answer at the end, and 2 to 4 spoken sentences (about 20 to 30 seconds).
The opening must create an open loop: tease the tension, never reveal the final verdict. No greeting, no channel name, no "in this video".
begruendung: one German sentence for the creator explaining why this angle fits the data.`,
  ]
    .filter(Boolean)
    .join('\n\n')
  const schema = {
    type: 'object',
    properties: {
      hooks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            typ: { type: 'string', enum: [...LONGFORM_HOOK_TYPEN] },
            leitfrage: { type: 'string' },
            begruendung: { type: 'string' },
            saetze: {
              type: 'array',
              items: { type: 'object', properties: { text: { type: 'string' }, faktIds: { type: 'array', items: { type: 'string' } } }, required: ['text', 'faktIds'] },
            },
          },
          required: ['typ', 'leitfrage', 'begruendung', 'saetze'],
        },
      },
    },
    required: ['hooks'],
  }
  const { daten } = await frage<{ hooks: LongformHookVorschlag[] }>({
    rolle: 'schreiben',
    system: STIL,
    nutzer,
    dokumente: opts.dokumente,
    schema,
    denkstufe: opts.zustand.denkstufe === 'low' ? 'medium' : 'high',
  })
  return (daten.hooks ?? [])
    .filter((h) => h.saetze?.length && !opts.gesperrt.includes(h.typ))
    .slice(0, 3)
    .map((h) => ({ ...h, saetze: h.saetze.map((s) => ({ text: s.text.trim(), faktIds: s.faktIds ?? [] })) }))
}

function abschnittAuftrag(id: LongformAbschnittId, fb: LongformFaktenblatt): string {
  switch (id) {
    case 'hook':
      return 'hook: Keep the chosen opening almost word for word. You may smooth it into 2 to 4 sentences. Scenes: the given hook scene; optionally end with titel_karte (fokus = short title on screen, max 6 words).'
    case 'chart10k':
      return `chart10k (about 70 to 110 seconds, 10 to 16 sentences): the long-term chart and what $10,000 invested ${fb.chart ? `in ${fb.chart.startDatum.slice(0, 4)}` : '10 years ago'} became, in dollars and percent, dividends reinvested. Mention how much came from dividends if that fact exists, compare with the S&P 500 if the facts exist, and make the worst drawdown feel real (what the viewer would have had to sit through). Scenes: chart_linie, chart_endwert, chart_drawdown, chart_vergleich, bild (bildWunsch = concrete English photo search, e.g. "semiconductor cleanroom").`
    case 'burggraben':
      return `burggraben (about 100 to 150 seconds, 14 to 22 sentences): the moat check. Start from how the business earns money (moat_geschaeft${fb.segmente ? ', moat_segmente for the revenue mix' : ''}), then walk through the four moat pillars with their scores and one concrete reason each (scene moat_pfeiler, fokus = pillar id: preissetzungsmacht, replikationsbarriere, wechselkosten, marktdichte), then the scorecard moat column (moat_scorecard), and end on the biggest threat to the moat as a bridge to the rest of the video. Spend more time on the strongest and the weakest pillar, less on average ones.`
    default:
      return `${id}: ${LONGFORM_ABSCHNITT_TITEL[id]}`
  }
}

const ABSCHNITT_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', enum: [...LONGFORM_AKTIVE_ABSCHNITTE] },
    saetze: { type: 'array', items: SATZ_SCHEMA },
  },
  required: ['id', 'saetze'],
}

export async function erzeugeSkript(opts: {
  zustand: LongformProjektZustand
  hook: LongformHookVorschlag
  dokumente: LongformDokument[]
}): Promise<LongformSkript> {
  const z = opts.zustand
  const fb = z.faktenblatt
  const nutzer = [
    kontext(fb, z.thema),
    `CHOSEN OPENING (type ${opts.hook.typ}):\nGuiding question: ${opts.hook.leitfrage}\n${opts.hook.saetze.map((s) => `- ${s.text} [${s.faktIds.join(', ')}]`).join('\n')}`,
    `PREFERRED HOOK SCENE: ${z.varianten.hookSzene}`,
    `TASK: Write these sections of the video, in this order. Every section keeps the guiding question alive without answering it (the answer comes in the final section of the full video, not now).\n${LONGFORM_AKTIVE_ABSCHNITTE.map((a) => `- ${abschnittAuftrag(a, fb)}`).join('\n')}
For every sentence choose the scene that best shows what is being said. Consecutive sentences may share a scene; change scenes at least every 3 to 4 sentences to keep the edit alive. betonung = the single word or number in the sentence where the visual should land.
kernphrasen: 5 to 10 distinctive phrases from your script (for repetition checks in later videos).`,
  ].join('\n\n')
  const schema = {
    type: 'object',
    properties: { abschnitte: { type: 'array', items: ABSCHNITT_SCHEMA }, kernphrasen: { type: 'array', items: { type: 'string' } } },
    required: ['abschnitte', 'kernphrasen'],
  }
  const { daten } = await frage<{ abschnitte: { id: LongformAbschnittId; saetze: SatzRoh[] }[]; kernphrasen: string[] }>({
    rolle: 'schreiben',
    system: STIL,
    nutzer,
    dokumente: opts.dokumente,
    schema,
    denkstufe: z.denkstufe,
    maxTokens: 48_000,
  })
  const abschnitte: LongformAbschnitt[] = LONGFORM_AKTIVE_ABSCHNITTE.map((id) => {
    const roh = daten.abschnitte?.find((a) => a.id === id)
    return { id, titel: LONGFORM_ABSCHNITT_TITEL[id], saetze: (roh?.saetze ?? []).filter((s) => s.text?.trim()).map((s) => satzAusRoh(s, id, fb)) }
  })
  if (abschnitte.every((a) => !a.saetze.length)) throw new Error('Gemini hat kein Skript geliefert.')
  return { leitfrage: opts.hook.leitfrage, hookTyp: opts.hook.typ, abschnitte, kernphrasen: (daten.kernphrasen ?? []).slice(0, 12) }
}

/** Carbon prüft qualitative Aussagen gegen die Quellen. Zahlen prüft der Code. */
export async function pruefeBehauptungen(opts: {
  zustand: LongformProjektZustand
  skript: LongformSkript
  dokumente: LongformDokument[]
}): Promise<Record<string, string>> {
  const saetze = opts.skript.abschnitte.flatMap((a) => a.saetze)
  const nutzer = [
    kontext(opts.zustand.faktenblatt, opts.zustand.thema),
    `SCRIPT SENTENCES (id: text):\n${saetze.map((s) => `${s.id}: ${s.text}`).join('\n')}`,
    `TASK: You are a strict fact checker. List every sentence that states something the sources above (fact sheet, description, moat check, scorecard, attached documents) do not support, or that overstates them. Ignore style and opinions clearly framed as opinion. Numbers that appear in the fact sheet are fine. Write each problem as one short German sentence for the creator. Return an empty list if everything is supported.`,
  ].join('\n\n')
  const schema = {
    type: 'object',
    properties: {
      probleme: { type: 'array', items: { type: 'object', properties: { satzId: { type: 'string' }, problem: { type: 'string' } }, required: ['satzId', 'problem'] } },
    },
    required: ['probleme'],
  }
  const { daten } = await frage<{ probleme: { satzId: string; problem: string }[] }>({
    rolle: 'pruefen',
    system: 'You verify scripts against sources. You never add information.',
    nutzer,
    dokumente: opts.dokumente,
    schema,
    denkstufe: 'high',
    maxTokens: 16_000,
  })
  const out: Record<string, string> = {}
  for (const p of daten.probleme ?? []) if (p.satzId && p.problem) out[p.satzId] = p.problem
  return out
}

/** Chat-Anweisung für einen ganzen Abschnitt (Argon) oder einen einzelnen Satz (Hydrogen). */
export async function ueberarbeite(opts: {
  zustand: LongformProjektZustand
  skript: LongformSkript
  abschnittId: LongformAbschnittId
  satzId: string | null
  anweisung: string
  dokumente: LongformDokument[]
}): Promise<LongformSatz[]> {
  const fb = opts.zustand.faktenblatt
  const abschnitt = opts.skript.abschnitte.find((a) => a.id === opts.abschnittId)
  if (!abschnitt) throw new Error('Abschnitt nicht gefunden.')
  const ziel = opts.satzId ? abschnitt.saetze.find((s) => s.id === opts.satzId) : null
  if (opts.satzId && !ziel) throw new Error('Satz nicht gefunden.')

  const aktuell = abschnitt.saetze
    .map((s) => `${s.id === opts.satzId ? '>>> ' : ''}${s.text} [scene ${s.visual.szene}${s.visual.fokus ? ` / ${s.visual.fokus}` : ''}; facts ${s.faktIds.join(', ')}]`)
    .join('\n')
  const nutzer = [
    kontext(fb, opts.zustand.thema),
    `GUIDING QUESTION: ${opts.skript.leitfrage}`,
    `CURRENT SECTION "${abschnitt.titel}" (${abschnittAuftrag(opts.abschnittId, fb)}):\n${aktuell}`,
    ziel
      ? `TASK: Rewrite only the sentence marked >>> following the creator's instruction (German): "${opts.anweisung}". You may return 1 to 3 sentences that replace it. Keep the flow with the sentences around it.`
      : `TASK: Rewrite this section following the creator's instruction (German): "${opts.anweisung}". Keep what already works, change what the instruction asks for. Return the complete new section.`,
  ].join('\n\n')
  const schema = { type: 'object', properties: { saetze: { type: 'array', items: SATZ_SCHEMA } }, required: ['saetze'] }
  const { daten } = await frage<{ saetze: SatzRoh[] }>({
    rolle: ziel ? 'klein' : 'schreiben',
    system: STIL,
    nutzer,
    dokumente: ziel ? [] : opts.dokumente,
    schema,
    denkstufe: ziel ? 'low' : opts.zustand.denkstufe,
    maxTokens: ziel ? 4_096 : 24_000,
  })
  const neu = (daten.saetze ?? []).filter((s) => s.text?.trim()).map((s) => satzAusRoh(s, opts.abschnittId, fb))
  if (!neu.length) throw new Error('Gemini hat keinen Text geliefert.')
  return neu
}
