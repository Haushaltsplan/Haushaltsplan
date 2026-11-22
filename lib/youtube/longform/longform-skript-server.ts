/**
 * Skript-Pipeline (Billing-Key, Gemini 4):
 * Argon schreibt Hooks und Abschnitte, Carbon prüft Behauptungen, Hydrogen formuliert einzelne Sätze um.
 * Zahlen kommen nur aus dem Faktenblatt; `longform-pruefung` kontrolliert das danach ohne KI.
 */
import 'server-only'

import { resolveCoachProviderFromMode, runCoachCompletion, type CoachMessage } from '@/lib/ki-coach-backend'
import { hookKatalogFuerPrompt } from '@/lib/youtube/longform/longform-abwechslung'
import { klingtNachDeutsch } from '@/lib/youtube/longform/longform-en'
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
    timeoutMs: 120_000,
    geminiTotalBudgetMs: 240_000,
    maxOutputTokens: opts.maxTokens ?? 32_768,
  })
  if (!r.ok) throw new Error(r.hint)
  try {
    return { daten: JSON.parse(r.reply) as T, modell: r.model ?? MODELLE[opts.rolle]()[0]! }
  } catch {
    throw new Error('Gemini lieferte kein gültiges JSON. Bitte nochmal versuchen.')
  }
}

const STIL = `You write long-form YouTube stock analyses in ENGLISH ONLY for a calm, sharp, independent investor who narrates with his own cloned voice.
LANGUAGE LOCK: Every spoken word must be English. Sources may be German (company description, moat reasons) — translate meaning, never paste German words (no "Burggraben", "Technologie", "Halbleiter", "Umsatz", "Aktie", umlauts, etc.). On-screen fokus/titles: English only.
Voice: confident, warm, slightly dry humour, zero hype, but entertaining — tension and curiosity, not a spreadsheet readout. Talk to one viewer ("you"). Use contractions.
Cold open: the first sentence must land like a trailer beat (a shocking number, a sharp claim, or a dilemma). No throat-clearing.
Sentences are spoken by text-to-speech: 6 to 22 words, one idea each, no lists, no brackets, no emojis, no abbreviations the voice could misread (write "percent" only via the % sign attached to a number).
Every number you write must be copied exactly from the FACT SHEET text column and its fact id listed in faktIds. Never compute, round differently, convert or invent numbers, dates, names or events. If a fact is missing, say it qualitatively or leave it out.
Qualitative claims must come from the company description, the moat check texts or the attached documents. No outside knowledge about recent news, products or people unless it is in the sources.
Banned phrases: "let's dive in", "in today's video", "without further ado", "game changer", "buckle up", "at the end of the day", "it's worth noting", "delve", "testament to", "stay tuned", "no-brainer", "smash that like button", "now let's look at", "as you can see".
Transitions grow out of the content (a number, a tension, a question).`

function kontext(fb: LongformFaktenblatt, thema: string): string {
  const m = fb.moat
  return [
    `COMPANY: ${fb.firmenname} (${fb.ticker})${fb.sektor ? `, sector ${fb.sektor}` : ''}${fb.branche ? `, industry ${fb.branche}` : ''}`,
    `VIDEO TOPIC FROM THE CREATOR: ${thema || '(none given, choose the most interesting angle the data supports)'}`,
    fb.beschreibung ? `COMPANY DESCRIPTION (German source — translate into English meaning only, never quote German):\n${fb.beschreibung.slice(0, 2500)}` : '',
    m
      ? `MOAT CHECK (pillar shape from app assessment, overall score locked to scorecard):\nOverall moat score: ${m.score}/10 (${m.urteil}). Pillar scores average to this overall score — use moat.score and the pillar scores as written, never invent a different total.\nBusiness model: ${m.geschaeftsmodell}\n${m.pfeiler
          .map((p) => `- ${p.label} ${p.score}/10: ${p.begruendung} Risk: ${p.risiko}`)
          .join('\n')}\nWhat could break it: ${m.zerstoerung.join(' | ')}`
      : 'MOAT CHECK: not available.',
    fb.burggraben
      ? `SCORECARD MOAT COLUMN (quality ${fb.burggraben.score ?? 'n/a'}/10 — same number as moat.score):\n${fb.burggraben.balken.map((b) => `- ${b.label}: ${b.wertText}`).join('\n')}`
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
  geschaeft: ['moat_geschaeft', 'moat_segmente', 'bild'],
  burggraben: ['moat_pfeiler', 'moat_scorecard', 'moat_finanzen', 'moat_segmente', 'bild'],
  zahlen: ['zahl_reihe', 'bild'],
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
  const faktIds = [...new Set(r.faktIds ?? [])]
  if (faktIds.some((id) => id.startsWith('km.'))) szene = 'moat_finanzen'
  return {
    id: neueSatzId(abschnitt),
    text: r.text.replace(/\s+/g, ' ').trim(),
    faktIds,
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
    `TASK: Propose exactly 3 openings for this video. Each has a guiding question (leitfrage, ENGLISH) that the whole video will answer at the end, and 2 to 4 spoken ENGLISH sentences (about 20 to 30 seconds).
The opening must feel like a cold open / trailer: first line hits hard, create an open loop, never reveal the final verdict. No greeting, no channel name, no "in this video". Spoken text and leitfrage: English only.
begruendung: one German sentence for the creator (studio only) explaining why this angle fits the data.`,
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
    denkstufe: opts.zustand.denkstufe ?? 'medium',
  })
  return (daten.hooks ?? [])
    .filter((h) => h.saetze?.length && !opts.gesperrt.includes(h.typ))
    .slice(0, 3)
    .map((h) => ({ ...h, saetze: h.saetze.map((s) => ({ text: s.text.trim(), faktIds: s.faktIds ?? [] })) }))
}

function abschnittAuftrag(id: LongformAbschnittId, fb: LongformFaktenblatt): string {
  switch (id) {
    case 'hook':
      return 'hook: Keep the chosen opening almost word for word. 2 to 3 spoken English sentences. Every sentence is scene hook_bild. Each needs a concrete English bildWunsch, the same kind of search brief as any other bild sentence: a short query a person can type, naming a product the company sells or its headquarters building. No logo poster, no invented scene, no giant number on screen. The voice carries the words. Do not use hook_zahl or hook_frage. Do not describe an image as if it were already chosen.'
    case 'chart10k':
      return `chart10k (about 70 to 110 seconds, 10 to 16 sentences): ONE continuous chart chapter — do NOT insert scene bild in the middle of chart beats (that redraws the chart). Order: (1) chart_linie while the lines draw — S&P and sector ETF are already on screen; (2) one sentence per core number with matching faktIds: k10.nur_kurs (price only), then k10.dividenden_usd if present, then k10.endwert (total with dividends), then k10.rendite or k10.cagr; (3) chart_drawdown for the drop from the high (k10.drawdown); (4) chart_vergleich for S&P${fb.chart?.endwertSektor != null ? ' and sector ETF (k10.sektor_endwert / k10.sektor_rendite / k10.vs_sektor)' : ''}. ${fb.chart?.endwertSpy != null ? 'You MUST include at least two chart_vergleich sentences using k10.spy_endwert / k10.spy_rendite / k10.vs_spy. ' : ''}OPTIONAL: at most ONE scene bild BEFORE the first chart_linie sentence OR AFTER the last chart sentence — never between chart_linie / endwert / drawdown / vergleich. Each sentence = exactly one core number; faktIds and betonung must point at that number. Scenes allowed: chart_linie, chart_endwert, chart_drawdown${fb.chart?.endwertSpy != null ? ', chart_vergleich (required)' : ''}, and optionally bild only at section edges.`
    case 'geschaeft':
      return `geschaeft (about 70 to 90 seconds): how the company gets paid, in everyday English a non-investor understands. First 2 sentences: scene moat_geschaeft, who the customer is and what they pay for. If a segment name is only an acronym, put a short gloss immediately after it, taken from the business description already in the fact sheet, in the form "CMBU, the memory sold to phone makers". If you cannot ground that gloss, keep the acronym and do not invent a long name. No scores, no moat theory.${fb.segmente ? ` Then scene moat_segmente: one overview sentence with no fokus${fb.fakten.some((f) => f.id === 'seg.other') ? ', and that overview must mention faktId seg.other: the rest of revenue comes from other businesses, without inventing their names' : ''}, then 2 or 3 sentences on the largest segments. Each of those carries exactly one faktId (seg.N or seg.N.marge or seg.N.wachstum), fokus set to that same id, betonung on the spoken number. Never three numbers in one sentence.` : ' No revenue mix is available, do not use moat_segmente.'} A bild sentence only before the first line or after the last segment sentence, with a concrete English bildWunsch.`
    case 'burggraben':
      return `burggraben (about 100 to 140 seconds): the moat, starting at the pillars. Do NOT re-explain how the company makes money. Say "moat", never the German word. Overall score is moat.score, said once. One sentence per pillar, scene moat_pfeiler, fokus = exactly one pillar id (preissetzungsmacht, replikationsbarriere, wechselkosten, marktdichte). Put a scene bild with a concrete English bildWunsch BETWEEN pillars so the same card is never on screen for the whole chapter. Then one moat_scorecard sentence for the overall score. ${fb.segmente ? 'At most one moat_segmente callback.' : ''} If you cite a km.* fact (operating margin, ROIC, net cash, interest coverage, and the other key metrics), that sentence is scene moat_finanzen with exactly one km.* id. Never leave those numbers on moat_scorecard. End on one threat, a single sentence. Do not add a like or subscribe sentence.`
    case 'zahlen':
      return `zahlen: one chart per series, never combined. Scenes zahl_reihe with fokus umsatz, marge, gewinn, fcf — only for series that exist as reihe.* facts. One sentence per chart, faktIds = reihe.<id>, betonung on the latest figure. If a year is an outlier, say so only when a fact gives the company's own reason; otherwise just name the year. A bild sentence with bildWunsch may sit between two charts.`
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
For every sentence choose the scene that best shows what is being said. Consecutive sentences may share a scene. For moat: change visuals / insert scene bild about every 20–25 seconds. For chart10k: keep ONE unbroken chart sequence (no mid-chapter bild). One core number per sentence; faktIds + betonung must match that spoken number so on-screen HUD syncs with the voice. Every bild / hook_bild sentence MUST include a concrete English bildWunsch (image brief a human can search or shoot).
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
  stelleChartVergleichSicher(abschnitte, fb)
  stelleHookBildSicher(abschnitte, fb)
  stelleBrollSicher(abschnitte, fb)
  stelleSegmentFokusSicher(abschnitte)
  stellePfeilerFokusSicher(abschnitte)
  haengeSchlussAn(abschnitte, fb, z.investiert)
  const deutsch = abschnitte.flatMap((a) => a.saetze).filter((s) => klingtNachDeutsch(s.text))
  if (deutsch.length) {
    throw new Error(
      `Skript enthält noch deutsche Wörter (z. B. „${deutsch[0]!.text.slice(0, 80)}“). Bitte Skript neu erzeugen — nur Englisch erlaubt.`,
    )
  }
  if (klingtNachDeutsch(opts.hook.leitfrage)) {
    throw new Error('Leitfrage ist nicht auf Englisch. Bitte anderen Hook wählen oder neu erzeugen.')
  }
  return { leitfrage: opts.hook.leitfrage, hookTyp: opts.hook.typ, abschnitte, kernphrasen: (daten.kernphrasen ?? []).slice(0, 12) }
}

/** Wenn SPY-Daten da sind, muss mindestens eine chart_vergleich-Szene existieren. */
function stelleChartVergleichSicher(abschnitte: LongformAbschnitt[], fb: LongformFaktenblatt) {
  if (fb.chart?.endwertSpy == null) return
  const chart = abschnitte.find((a) => a.id === 'chart10k')
  if (!chart?.saetze.length) return
  if (chart.saetze.some((s) => s.visual.szene === 'chart_vergleich')) return
  const kandidat =
    chart.saetze.find((s) => /S&P|SPY|index|benchmark/i.test(s.text) || s.faktIds.some((id) => id.includes('spy') || id === 'k10.vs_spy')) ??
    chart.saetze.find((s) => s.visual.szene === 'chart_endwert') ??
    chart.saetze[chart.saetze.length - 1]
  if (kandidat) kandidat.visual.szene = 'chart_vergleich'
}

const BROLL_POOL = [
  'semiconductor wafer cleanroom',
  'DRAM memory chips close up',
  'data center server racks',
  'silicon wafer manufacturing',
  'circuit board macro photography',
  'factory industrial robotics',
]

function brollSuchbegriff(fb: LongformFaktenblatt, index: number): string {
  const branche = (fb.branche ?? fb.sektor ?? '').toLowerCase()
  if (/semi|chip|memory|halbleiter|technologie|technology/.test(branche) || /MU|micron/i.test(fb.ticker + fb.firmenname)) {
    return BROLL_POOL[index % BROLL_POOL.length]!
  }
  if (/bank|financ/.test(branche)) return ['bank trading floor', 'city skyline financial district', 'stock exchange building'][index % 3]!
  if (/health|bio|pharma/.test(branche)) return ['laboratory research', 'medical laboratory', 'pharmaceutical manufacturing'][index % 3]!
  return [`${fb.firmenname} industry`, 'modern office building exterior', 'global supply chain shipping'][index % 3]!
}

function hookBildWunsch(fb: LongformFaktenblatt, index: number): string {
  const name = fb.firmenname
  const pool = [`${name} product close up`, `${name} headquarters building`, `${name} factory exterior`]
  return pool[index % pool.length]!
}

function stelleHookBildSicher(abschnitte: LongformAbschnitt[], fb: LongformFaktenblatt) {
  const hook = abschnitte.find((a) => a.id === 'hook')
  if (!hook) return
  let n = 0
  for (const s of hook.saetze) {
    if (s.visual.szene === 'titel_karte') continue
    s.visual.szene = 'hook_bild'
    if (!s.visual.bildWunsch?.trim()) s.visual.bildWunsch = hookBildWunsch(fb, n)
    n += 1
  }
}

const PFEILER_IDS = ['preissetzungsmacht', 'replikationsbarriere', 'wechselkosten', 'marktdichte']

function stelleSegmentFokusSicher(abschnitte: LongformAbschnitt[]) {
  for (const a of abschnitte) {
    for (const s of a.saetze) {
      if (s.visual.szene !== 'moat_segmente') continue
      const id = s.faktIds.find((x) => x === 'seg.other' || /^seg\.\d+/.test(x))
      if (id && !s.visual.fokus) s.visual.fokus = id
    }
  }
}

function stellePfeilerFokusSicher(abschnitte: LongformAbschnitt[]) {
  const moat = abschnitte.find((a) => a.id === 'burggraben')
  if (!moat) return
  let n = 0
  for (const s of moat.saetze) {
    if (s.visual.szene !== 'moat_pfeiler') continue
    const ausFakt = s.faktIds.map((id) => id.replace(/^moat\./, '')).find((id) => PFEILER_IDS.includes(id))
    if (!s.visual.fokus || !PFEILER_IDS.includes(s.visual.fokus)) {
      s.visual.fokus = ausFakt ?? PFEILER_IDS[n % PFEILER_IDS.length]!
    }
    n += 1
  }
}

const SCHLUSS_SZENEN = new Set(['abo_karte', 'disclaimer', 'schluss'])

/** Like, gesprochener Disclaimer und Cheers ans Ende. Ein Abo-Satz mitten im Film fliegt raus. */
export function haengeSchlussAn(abschnitte: LongformAbschnitt[], fb: LongformFaktenblatt, investiert: boolean | null) {
  const name = fb.firmenname.replace(/[.\s]+$/, '')
  const gewollt: { szene: 'abo_karte' | 'disclaimer' | 'schluss'; text: string }[] = [
    { szene: 'abo_karte', text: 'If this was useful, like and subscribe.' },
  ]
  if (investiert === true || investiert === false) {
    gewollt.push({
      szene: 'disclaimer',
      text: investiert ? `I own shares of ${name}.` : `I do not own shares of ${name}.`,
    })
  }
  gewollt.push({ szene: 'schluss', text: 'Cheers.' })
  const vorhanden = abschnitte.flatMap((a) => a.saetze).filter((s) => SCHLUSS_SZENEN.has(s.visual.szene))
  for (const a of abschnitte) {
    a.saetze = a.saetze.filter((s) => s.visual.fokus !== 'abo' && !SCHLUSS_SZENEN.has(s.visual.szene))
  }
  const ziel = [...abschnitte].reverse().find((a) => a.saetze.length)
  if (!ziel) return
  for (const g of gewollt) {
    const alt = vorhanden.find((s) => s.visual.szene === g.szene && s.text === g.text)
    ziel.saetze.push(
      alt ?? {
        id: neueSatzId(ziel.id),
        text: g.text,
        faktIds: [],
        visual: { szene: g.szene, fokus: null, betonung: null, bildWunsch: null },
      },
    )
  }
}

/** B-Roll absichern: Chart nie in der Mitte zerreißen; Moat mind. 2 Schnitte. */
function stelleBrollSicher(abschnitte: LongformAbschnitt[], fb: LongformFaktenblatt) {
  let pool = 0
  for (const a of abschnitte) {
    if (a.id === 'hook' || a.saetze.length < 4) continue
    if (a.id === 'geschaeft') {
      for (const s of a.saetze) {
        if ((s.visual.szene === 'bild' || s.visual.szene === 'hook_bild') && !s.visual.bildWunsch) {
          s.visual.bildWunsch = brollSuchbegriff(fb, pool++)
        }
      }
      continue
    }

    if (a.id === 'chart10k') {
      // Mid-Chart-B-Roll → Chart zeichnet neu. Nur Rand erlauben.
      const chartIdx = a.saetze
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.visual.szene.startsWith('chart_'))
      const firstChart = chartIdx[0]?.i ?? -1
      const lastChart = chartIdx[chartIdx.length - 1]?.i ?? -1
      a.saetze.forEach((s, i) => {
        if (s.visual.szene !== 'bild' && s.visual.szene !== 'hook_bild') return
        if (firstChart >= 0 && lastChart >= 0 && i > firstChart && i < lastChart) {
          s.visual.szene = 'chart_linie'
          s.visual.bildWunsch = null
        } else if (!s.visual.bildWunsch) {
          s.visual.bildWunsch = brollSuchbegriff(fb, pool++)
        }
      })
      // Optional ein Bild nach dem Chart-Block, falls keines am Rand steht.
      const randBilder = a.saetze.filter(
        (s, i) =>
          (s.visual.szene === 'bild' || s.visual.szene === 'hook_bild') &&
          (firstChart < 0 || i <= firstChart || i >= lastChart),
      )
      if (!randBilder.length && lastChart >= 0 && lastChart < a.saetze.length - 1) {
        const ziel = a.saetze[a.saetze.length - 1]!
        if (!ziel.visual.szene.startsWith('chart_')) {
          ziel.visual.szene = 'bild'
          ziel.visual.bildWunsch = brollSuchbegriff(fb, pool++)
        }
      } else if (!randBilder.length && a.saetze.length >= 2) {
        // Kein freier Rand-Satz: keinen Extra-Split erzwingen — Chart bleibt ein Block.
      }
      continue
    }

    const bilder = a.saetze.filter((s) => (s.visual.szene === 'bild' || s.visual.szene === 'hook_bild') && s.visual.fokus !== 'abo')
    for (const s of bilder) {
      if (!s.visual.bildWunsch && s.visual.fokus !== 'abo') s.visual.bildWunsch = brollSuchbegriff(fb, pool++)
    }
    const fehlt = Math.max(0, 2 - bilder.length)
    if (!fehlt) continue
    const kandidaten = a.saetze
      .map((s, i) => ({ s, i }))
      .filter(
        ({ s, i }) =>
          s.visual.fokus !== 'abo' &&
          s.visual.szene !== 'bild' &&
          s.visual.szene !== 'hook_bild' &&
          s.visual.szene !== 'moat_pfeiler' &&
          s.visual.szene !== 'moat_finanzen' &&
          s.visual.szene !== 'moat_segmente' &&
          s.visual.szene !== 'moat_scorecard' &&
          s.visual.szene !== 'abo_karte' &&
          s.visual.szene !== 'disclaimer' &&
          s.visual.szene !== 'schluss' &&
          s.visual.szene !== 'zahl_reihe' &&
          !s.visual.szene.startsWith('chart_') &&
          i > 0 &&
          i < a.saetze.length - 1,
      )
    const schritt = Math.max(1, Math.floor(kandidaten.length / (fehlt + 1)))
    let gesetzt = 0
    for (let k = schritt; k < kandidaten.length && gesetzt < fehlt; k += schritt) {
      const ziel = kandidaten[k]!
      ziel.s.visual.szene = 'bild'
      ziel.s.visual.bildWunsch = brollSuchbegriff(fb, pool++)
      gesetzt += 1
    }
  }
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
