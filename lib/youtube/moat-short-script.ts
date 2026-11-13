import type { MoatShortProps, MoatShortVerdict } from '@/remotion/moat-short-types'
import { firmenKurzname, phrasePasst } from '@/lib/youtube/youtube-keywords'

const ABSCHIED =
  /\b(thanks for watching|thank you|thanks for|follow for|subscribe|see you|that's the video|watch next|hit like|link in|comment below)\b/i

const ZUSAMMENFASSUNG =
  /\b(wide moat|narrow moat|no real moat|the proof is|already said so|is the tell|that's the story|in conclusion|to sum up)\b/i

const BRUECKE_ENDE = /(?:which is why|that's why|that is why|and that's why|so the question is)$/i

const VERBOTENE_WOERTER = [
  'delve',
  'game-changer',
  'game changer',
  'unbelievable',
  'testament',
  'revolutionizing',
  'revolutionize',
  'revolutionise',
  'revolutionary',
  'mind-blowing',
  'mind blowing',
  'pivotal',
  'furthermore',
  'consequently',
  'moreover',
  'therefore',
  'thus',
  'additionally',
  'subsequently',
  'incredible',
  'insane',
  'crazy',
  'juggernaut',
  'powerhouse',
  'unstoppable',
  'groundbreaking',
  'cutting-edge',
  'paradigm',
  'synergy',
  'utilize',
]

const SATZ_MIN_WOERTER = 7
const SATZ_MAX_WOERTER = 12

const FIRMENSPRECH = [
  'operational complexity',
  'capital investment',
  'this ecosystem',
  'the ecosystem',
  'competing global',
  'requires decades of',
  'financial institutions',
  'significant barriers',
  'durable competitive',
  'value proposition',
  'go-to-market',
  'highly differentiated',
  'when leaving this',
  'dominant market position',
  'sustained pricing power',
]

function memoTreffer(satz: string): number {
  return satz.match(/\b(complexity|infrastructure|institutions|ecosystem|proposition|differentiated|operationally|significantly)\b/gi)?.length ?? 0
}

const FALLBACK_SPANNUNG = 'One thing could still break that lock.'

const STOPWÖRTER = new Set(
  'a an the and or but if of to in on for with as is it that this those these be was are were not no so just still could would can cannot because'.split(
    ' ',
  ),
)

const BEDROHUNG_LEAK =
  /\b(regulator|regulatory|regulation|cap|caps|export|control|controls|rival|rivals|china|ban|antitrust|interchange|lawsuit|sanction|sanctions|war|tariff|fee cap)\b/i

const AUFLÖSUNG_LEAK =
  /\b(because|cannot leave|can't leave|can not leave|no second|only shop|banks (can't|cannot|still pay)|merchants can't)\b/i

function woerter(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w && !/^[—–\-,.;:!?…]+$/.test(w))
}

/** Gedankenstrich und „Wort - Wort“ sind KI-Ton. Zwei kurze Sätze oder ein Komma. */
export function ohneKiBindestrich(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, '. ')
    .replace(/\s+-\s+/g, '. ')
    .replace(/\.\s+([a-z])/g, (_, c: string) => `. ${c.toUpperCase()}`)
    .replace(/\.\s*\./g, '.')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Interne Kennzahl-IDs. Gesprochen wird nur das englische Label. */
const KENNZAHL_NAME: Record<string, string> = {
  ltm_brutto: 'gross margin',
  ltm_ebit: 'operating margin',
  ltm_roic: 'return on capital',
  roic_5y_avg: '5-year average ROIC',
  incremental_roic: 'return on new capital',
  fcf_conversion: 'FCF conversion',
  nrr: 'net revenue retention',
  rev_cagr_5y: '5-year revenue growth',
  brutto_std_10y: '10-year margin swing',
  net_debt_ebitda: 'net debt to EBITDA',
  interest_coverage: 'interest coverage',
  aktien_verwaesserung: 'share count change',
  preissetzungsmacht: 'pricing power',
  replikationsbarriere: 'hard to copy',
  wechselkosten: 'switching costs',
  marktdichte: 'market control',
}

function artikelVor(wert: string): string {
  return /^(8|11|18)(?:\D|$)/.test(wert) ? 'an' : 'a'
}

/** „an ltm_ebit of 58.3%“ wird „a 58.3% operating margin“. Gilt für jede Kennzahl-ID. */
export function ohneKennzahlId(text: string): string {
  let t = text
  const ids = Object.keys(KENNZAHL_NAME).sort((a, b) => b.length - a.length)
  for (const id of ids) {
    const name = KENNZAHL_NAME[id]!
    const key = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    t = t.replace(new RegExp(`\\b(?:an?|the)\\s+${key}\\s+of\\s+([\\d.]+%|[\\d.]+\\s*pts|[\\d.]+x)`, 'gi'), (_, wert: string) => {
      return `${artikelVor(wert)} ${wert} ${name}`
    })
    t = t.replace(new RegExp(`\\b${key}\\s+of\\s+([\\d.]+%|[\\d.]+\\s*pts|[\\d.]+x)`, 'gi'), (_, wert: string) => `${wert} ${name}`)
    t = t.replace(new RegExp(`\\b${key}\\b`, 'gi'), (treffer, offset, ganz) => {
      const satzanfang = offset === 0 || /[.!?]\s*$/.test(String(ganz).slice(0, Number(offset)))
      return satzanfang ? name.charAt(0).toUpperCase() + name.slice(1) : name
    })
  }
  return t.replace(/\s+/g, ' ').trim()
}

/** Kein Schluss-Punkt: sonst hängt TTS eine Pause an und der Loop stockt. */
export function oeffneSprechende(text: string): string {
  return text.replace(/[.!?…]+$/u, '').replace(/,+$/g, '').trim()
}

function inhaltsWörter(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9%\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWÖRTER.has(w)),
  )
}

export function istSpannungOhneSpoiler(loop: string, crack: string): boolean {
  const t = ohneKiBindestrich(loop)
  if (!t || ABSCHIED.test(t) || BEDROHUNG_LEAK.test(t) || AUFLÖSUNG_LEAK.test(t)) return false
  if (!crack.trim()) return true
  const a = inhaltsWörter(t)
  const b = inhaltsWörter(crack)
  let treffer = 0
  for (const w of a) if (b.has(w)) treffer += 1
  return treffer < 2
}

export function saubererHookLoop(loop: string, crack: string): string {
  const t = ohneKiBindestrich(loop)
  return istSpannungOhneSpoiler(t, crack) ? t : FALLBACK_SPANNUNG
}

export function fallbackLand(verdict: MoatShortVerdict, _value?: string): string {
  if (verdict === 'wide') return 'Nobody else has a lock like this, so the question is'
  if (verdict === 'narrow') return 'The lead is thinner than it looks, so the question is'
  return 'That advantage is not a moat, so the question is'
}

/** Landung, wenn du das Urteil selbst setzt. Offene Brücke, kein neuer Fakt. */
export function landFuerPersoenlichesUrteil(verdict: MoatShortVerdict): string {
  return fallbackLand(verdict)
}

/** Die Landung muss in eine Frage münden, sonst startet der Loop mit der Zahl. */
export function landZurFrage(land: string, verdict: MoatShortVerdict, value: string): string {
  const t = saubererLand(land, verdict, value)
  if (/so the question is$/i.test(t)) return t
  const stamm = t.replace(/\s+(?:which is why|that's why|that is why|and that's why)$/i, '').replace(/[,:\s]+$/g, '')
  const neu = `${stamm}, so the question is`
  if (neu.split(/\s+/).filter(Boolean).length <= 12 && neu.length <= 90) return neu
  return fallbackLand(verdict)
}

/** Blickfang, eine Zeile, in unter einer Sekunde lesbar. Keine erfundene Zahl. */
export function kickerFuerBild(roh: string, firma: string): string {
  const name = firma.split(/\s+/)[0] || 'This'
  let t = ohneKiBindestrich(roh).replace(/[.!?…]/g, '').replace(/\$?\d[\d.,]*%?/g, '').replace(/\s+/g, ' ').trim()
  const woerter = t.split(/\s+/).filter(Boolean).slice(0, 5)
  t = woerter.join(' ')
  if (t.length > 28) t = t.slice(0, 28).replace(/\s+\S*$/, '').trim()
  if (t.split(/\s+/).filter(Boolean).length < 2) return `${name} has no substitute`
  return t
}

/** Erste gesprochene Zeile ist die Frage. Die Kennzahl darf hier nicht stehen. */
export function frageFuerHook(roh: string, firma: string, wert: string): string {
  let t = ohneKiBindestrich(roh).replace(/\s+/g, ' ').trim()
  if (wert) t = t.replace(wert, '').replace(/\s+/g, ' ').trim()
  t = t.replace(/[.!]+$/g, '').trim()
  if (!t.endsWith('?')) t = `${t.replace(/[?]+$/g, '')}?`
  const gekuerzt = kuerzeGesprocheneZeile(t, { maxWoerter: 10, maxZeichen: 78, frage: true })
  const n = gekuerzt.split(/\s+/).filter(Boolean).length
  if (
    n >= 6 &&
    n <= 10 &&
    gekuerzt.length <= 78 &&
    /^(why|how|what|who|is|can|could)\b/i.test(gekuerzt) &&
    !gekuerzt.includes(wert) &&
    !satzUnbrauchbar(gekuerzt)
  ) {
    return gekuerzt
  }
  const name = firma.split(/\s+/)[0] || 'They'
  return `Why can ${name} raise prices and nobody leaves?`
}

export type HookKennzahlArt = 'marge' | 'kapital' | 'andere'

/** Marge und Kapitalrendite müssen eine Macht- oder Dominanzfrage beantworten. */
export function hookKennzahlArt(label: string, id = ''): HookKennzahlArt {
  const l = `${id} ${label}`.toLowerCase()
  if (/roic|return on capital|return on new capital/.test(l)) return 'kapital'
  if (/margin|ltm_brutto|ltm_ebit/.test(l)) return 'marge'
  return 'andere'
}

function firmenwort(firma: string): string {
  return firma.split(/\s+/).filter(Boolean)[0] || 'They'
}

function artikelVorGesprochen(wert: string): 'a' | 'an' {
  const z = wert.trim()
  if (/^(?:8\d*(?:\.\d+)?|11(?:\.\d+)?|18(?:\.\d+)?)%/.test(z)) return 'an'
  return 'a'
}

/** „print. A 71.5%“ und „print — a 82.4%“ werden ein Atemzug: „print an 82.4%“. */
export function flussZurZahl(text: string): string {
  const t = text
    .replace(/\s+/g, ' ')
    .replace(/[.!?…,:;—–-]+\s+(?:an?\s+)?(\d[\d.]*%?)/gi, (_m, num: string) => {
      const wert = /%$/.test(num) ? num : `${num}%`
      return ` ${artikelVorGesprochen(wert)} ${num}`
    })
    .replace(/\s+/g, ' ')
    .replace(/\s+([.!?])/g, '$1')
    .trim()
  return t
}

function kennzahlGesprochen(label: string, id: string): string {
  return (KENNZAHL_NAME[id] ?? label).replace(/\s+/g, ' ').trim()
}

const MACHT_ODER_DOMINANZ =
  /\b(charg\w*|fees?\b|prices?\b|pricing|pay\w*|rais\w*|premium|toll|dominan\w*|monopol\w*|nobody|no one|cannot leave|can't leave|can no\b|drop\w*)\b/i

export function fragtNachMachtOderDominanz(frage: string): boolean {
  return MACHT_ODER_DOMINANZ.test(frage)
}

function nenntKennzahl(text: string, label: string, id: string): boolean {
  const name = kennzahlGesprochen(label, id).toLowerCase()
  const t = text.toLowerCase()
  const kerne = name.split(/\s+/).filter((w) => w.length > 3 && !['year', 'average'].includes(w))
  if (!kerne.length) return true
  return kerne.some((w) => t.includes(w))
}

/** Muster, wenn die KI-Frage die Kennzahl nicht begründet. Gilt für jede Firma, nicht für einen Ticker. */
export function frageFuerKennzahl(firma: string, label: string, id = ''): string {
  const name = firmenwort(firma)
  const art = hookKennzahlArt(label, id)
  if (art === 'kapital') return `How dominant is ${name}'s market monopoly?`
  if (art === 'marge') return `Why can ${name} charge endless fees?`
  const l = `${id} ${label}`.toLowerCase()
  if (/retention|\bnrr\b/.test(l)) return `Why do ${name}'s customers spend more every year?`
  if (/fcf|conversion|cash/.test(l)) return `Why does ${name}'s profit turn into cash?`
  if (/growth|cagr|revenue/.test(l)) return `Why does ${name}'s revenue keep compounding?`
  return `Why does ${name} keep that edge?`
}

export type MoatUrsacheId = 'network' | 'switching' | 'patent' | 'barrier'

/**
 * Klasse, nicht Ticker. Ein Kartennetz steht für alle Zahlungsnetze.
 * Plural („costs“) nimmt „let“, Singular nimmt „lets“.
 */
export function moatUrsacheAusText(text: string): MoatUrsacheId {
  const t = text.toLowerCase()
  if (/pharma|biotech|biotechn|medtech|medizintechnik|medizinprodukt|arznei|wirkstoff|therapeutic|implant|veterin|tierarz|tiergesundheit|animal health|animal-health/.test(t)) {
    return 'patent'
  }
  if (/zahlungs|payment|kreditkarte|kartenzahlung|card network|interchange|bezahl|acquiring|netzwerkeffekt|network effect/.test(t)) {
    return 'network'
  }
  if (/halbleiter|semiconductor|eisenbahn|railroad|pipeline|flughafen|hafen|netzbetreiber|maschinenbau|energieversorg/.test(t)) {
    return 'barrier'
  }
  if (/\b(software|saas|cloud|enterprise|lizenzsoftware|b2b)\b/.test(t)) return 'switching'
  return 'barrier'
}

type TreiberId = 'land' | 'franchise' | 'formula' | 'patent' | 'network' | 'switching' | 'tools' | 'routes' | 'barrier'

type Treiber = {
  id: TreiberId
  subjekt: string
  verb: 'drives' | 'drive'
  frage: (name: string) => string
  kontrast: (name: string) => string
  stakes: (name: string) => string
}

function treiber(teil: Omit<Treiber, 'kontrast' | 'stakes'> & { kontrast: Treiber['kontrast']; stakes: Treiber['stakes'] }): Treiber {
  return teil
}

/**
 * Der ökonomische Motor aus dem Text DIESES Unternehmens.
 * Grundstück und Franchise nur, wenn das Modell wirklich Vermietung oder Franchise ist.
 * „Grundstoff“ und das eigene Werksgrundstück sind kein Vermieter-Modell.
 */
export function treiberAusText(text: string): Treiber {
  const t = text.toLowerCase()
  const formel = /encapsulat|verkapsel|spezialchemie|nischenchemie|specialty chemical|specialty ingredient|specialty formula|proprietary formula|performance ingredient|nutritional ingredient|food ingredient|inhaltsstoff|rezeptur|zusatzstoff|\bchelat/.test(t)
  const vermieter = /\blandlord\b|\bland ownership\b|owns the land|\bmieteinnahm|\brental income\b|\bproperty portfolio\b|\bimmobilien(?:gesellschaft|portfolio|bestand)\b/.test(t)
  if (vermieter && !formel) {
    return treiber({
      id: 'land',
      subjekt: 'Land ownership',
      verb: 'drives',
      frage: (name) => `Why does ${name} own the land under every shop?`,
      kontrast: (name) => `Is ${name} a brand or a landlord?`,
      stakes: (name) => `What happens if ${name} loses the land?`,
    })
  }
  if (/\bfranchise/.test(t)) {
    return treiber({
      id: 'franchise',
      subjekt: 'Franchise fees',
      verb: 'drive',
      frage: (name) => `Why do ${name}'s fees outlast the product?`,
      kontrast: (name) => `Is ${name} selling a product or a license?`,
      stakes: (name) => `What happens if partners stop paying ${name}?`,
    })
  }
  if (formel) {
    return treiber({
      id: 'formula',
      subjekt: 'Proprietary formulas',
      verb: 'drive',
      frage: (name) => `Why can't rivals copy ${name}'s formulas?`,
      kontrast: (name) => `Is ${name} a supplier or a locked-in formula?`,
      stakes: (name) => `What happens if customers drop ${name}'s formulas?`,
    })
  }
  if (/pharma|biotech|biotechn|medtech|medizintechnik|medizinprodukt|arznei|wirkstoff|therapeutic|implant|veterin|tierarz|tiergesundheit|animal health|animal-health/.test(t)) {
    const geraet = /implant|device|medizinprodukt|medizintechnik|medtech/.test(t)
    return geraet
      ? treiber({
          id: 'patent',
          subjekt: 'Patented devices',
          verb: 'drive',
          frage: (name) => `Why can ${name} charge for the same device for years?`,
          kontrast: (name) => `Is ${name} a factory or a patent vault?`,
          stakes: (name) => `What happens when ${name}'s patents expire?`,
        })
      : treiber({
          id: 'patent',
          subjekt: 'Patented drugs',
          verb: 'drive',
          frage: (name) => `Why can ${name} charge for the same drug for years?`,
          kontrast: (name) => `Is ${name} a lab or a patent vault?`,
          stakes: (name) => `What happens when ${name}'s patents expire?`,
        })
  }
  if (/zahlungs|payment|kreditkarte|kartenzahlung|card network|interchange|bezahl|acquiring|netzwerkeffekt|network effect/.test(t)) {
    return treiber({
      id: 'network',
      subjekt: 'Network effects',
      verb: 'drive',
      frage: (name) => `Why does every new ${name} customer strengthen the network?`,
      kontrast: (name) => `Is ${name} a product or a network?`,
      stakes: (name) => `What happens if customers leave ${name}'s network?`,
    })
  }
  if (/halbleiter|semiconductor|lithograph|wafer/.test(t)) {
    return treiber({
      id: 'tools',
      subjekt: 'Tool monopoly',
      verb: 'drives',
      frage: (name) => `Why can no fab build chips without ${name}?`,
      kontrast: (name) => `Is ${name} a supplier or the only tool?`,
      stakes: (name) => `What happens if a fab bypasses ${name}?`,
    })
  }
  if (/eisenbahn|railroad|pipeline|flughafen|hafen|netzbetreiber|energieversorg/.test(t)) {
    return treiber({
      id: 'routes',
      subjekt: 'The route network',
      verb: 'drives',
      frage: (name) => `Why can no rival copy ${name}'s routes?`,
      kontrast: (name) => `Is ${name} a carrier or the route itself?`,
      stakes: (name) => `What happens if shippers bypass ${name}?`,
    })
  }
  if (/\b(software|saas|cloud|enterprise|lizenzsoftware|b2b)\b/.test(t)) {
    return treiber({
      id: 'switching',
      subjekt: 'Switching costs',
      verb: 'drive',
      frage: (name) => `Why do ${name}'s customers stay when contracts end?`,
      kontrast: (name) => `Is ${name} software or a system they cannot leave?`,
      stakes: (name) => `What happens if a customer rips ${name} out?`,
    })
  }
  return treiber({
    id: 'barrier',
    subjekt: 'High barriers',
    verb: 'drive',
    frage: (name) => `Why can no rival rebuild what ${name} owns?`,
    kontrast: (name) => `Is ${name}'s lead a product or a barrier?`,
    stakes: (name) => `What happens if a rival rebuilds what ${name} owns?`,
  })
}

const KLASSEN_SATZ: { id: TreiberId; re: RegExp }[] = [
  { id: 'land', re: /\bland ownership\b|\bowns? the land\b|\blandlord\b|\bevery shop\b/i },
  { id: 'franchise', re: /\bfranchise fees?\b|\bfranchis(?:e|or|ee)s?\b/i },
  { id: 'formula', re: /\bproprietary formulas\b|\blocked-in formula\b/i },
  { id: 'patent', re: /\bpatented drugs\b|\bpatented devices\b|\bsame drug\b|\bsame device\b/i },
  { id: 'network', re: /\bnetwork effects\b|\bstrengthen the network\b/i },
  { id: 'tools', re: /\btool monopoly\b|\bno fab\b/i },
  { id: 'routes', re: /\broute network\b|\bcopy \w+'s routes\b/i },
  { id: 'switching', re: /\bswitching costs\b|\bwhen contracts end\b/i },
  { id: 'barrier', re: /\bhigh barriers\b/i },
]

/** Der Satz benutzt den Motor einer anderen Klasse als der Beleg im Unternehmenstext. */
export function fremderKlassenSatz(text: string, kontext: string): boolean {
  const soll = treiberAusText(kontext).id
  return KLASSEN_SATZ.some((m) => m.id !== soll && m.re.test(text))
}

export function frageFuerWinkel(kontext: string, firma: string, winkel: string): string {
  const motor = treiberAusText(kontext)
  const name = firmenwort(firma)
  if (winkel === 'contrast') return motor.kontrast(name)
  if (winkel === 'stakes') return motor.stakes(name)
  return motor.frage(name)
}

/** Karte im Script-Studio: fremde Klasse (Grundstück, Franchise, Netz) wird durch den Motor dieses Unternehmens ersetzt. */
export function hookKarteFuerUnternehmen(opts: {
  winkel: string
  claim: string
  proof: string
  firma: string
  wert: string
  label: string
  id?: string
  kontext: string
}): { frage: string; antwort: string } {
  const paar = hookPaar(opts.claim, opts.proof, opts.firma, opts.wert, opts.label, opts.id ?? '', opts.kontext)
  if (!fremderKlassenSatz(opts.claim, opts.kontext) && !fremderKlassenSatz(opts.proof, opts.kontext)) {
    return { frage: paar.claim, antwort: paar.proof }
  }
  return { frage: frageFuerWinkel(opts.kontext, opts.firma, opts.winkel), antwort: paar.proof }
}

function fragePasstZumTreiber(frage: string, id: TreiberId): boolean {
  const t = frage.toLowerCase()
  if (id === 'land') return /\bland\b|real estate|landlord|property\b/.test(t)
  if (id === 'franchise') return /franchise|royalt|\bfees?\b|\blicen[sc]e\b/.test(t)
  if (id === 'formula') return /formula|encapsul|ingredient|recipe|supplier/.test(t)
  if (id === 'patent') return /patent|drug|device|formula/.test(t)
  if (id === 'network') return /\bnetwork\b/.test(t)
  if (id === 'switching') return /switch|contract|\bstay\b|\bleave\b/.test(t)
  if (id === 'tools') return /machine|\bfab\b|\bchip|\btool\b/.test(t)
  if (id === 'routes') return /route|\brail\b|track|pipeline/.test(t)
  return /\brebuild|\brival\b|\bcopy\b|\bowns\b/.test(t) || fragtNachMachtOderDominanz(frage)
}

function analyseKlausel(label: string, id: string): string {
  const art = hookKennzahlArt(label, id)
  if (art === 'marge') return ', proving unmatched pricing power'
  if (art === 'kapital') return ', proving the market lock'
  return ', proving the lead holds'
}

/** Die Kennzahl steht einmal, der Nebensatz folgt im selben Atemzug. */
function mitAnalyse(satz: string, label: string, id: string): string {
  const t = flussZurZahl(satz)
  if (!t) return t
  if (/,/.test(t) || /\bproving\b/i.test(t)) return /[.!?]$/.test(t) ? t : `${t}.`
  return `${t.replace(/[.]+$/g, '').trim()}${analyseKlausel(label, id)}.`
}

function escapeReg(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** „a 71.5% gross margin“ — Artikel, Zahl, dann der Kennzahlname. */
function kennzahlWendung(wert: string, namen: string[]): RegExp | null {
  const v = wert.trim()
  if (!v) return null
  const namenRe = [...new Set(namen.map((n) => n.trim()).filter((n) => n.length > 2))].map((n) =>
    n.split(/\s+/).map(escapeReg).join('\\s+'),
  )
  if (!namenRe.length) return null
  const kern = `${escapeReg(v)}\\s+(?:${namenRe.join('|')})`
  return new RegExp(`\\b(?:an?|the)\\s+${kern}\\b|\\b${kern}\\b`, 'i')
}

function wendungFuer(wert: string, label: string, id: string): RegExp | null {
  return kennzahlWendung(wert, [label, kennzahlGesprochen(label, id)])
}

/** Zweites Vorkommen derselben Wendung im selben Satz streichen. */
export function satzOhneDoppelteZahl(text: string, wert: string, label: string, id = ''): string {
  const re = wendungFuer(wert, label, id)
  if (!re) return text
  const treffer = text.match(new RegExp(re.source, 'gi'))
  if (!treffer || treffer.length < 2) return text
  let gesehen = 0
  return text
    .replace(new RegExp(re.source, 'gi'), (fund) => (++gesehen === 1 ? fund : ''))
    .replace(/\.\s+(proves|shows|means)\b/i, ', proving')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/,\s*,/g, ',')
    .trim()
}

/**
 * Steht die Wendung schon im Satz davor, fällt sie aus dem nächsten.
 * „A 71.5% gross margin proves pricing power.“ wird zu „That proves pricing power.“
 */
export function ohneDoppelteWendung(vorher: string, zeile: string, wert: string, label: string, id = ''): string {
  const re = wendungFuer(wert, label, id)
  if (!re || !re.test(vorher) || !re.test(zeile)) return zeile
  const roh = zeile.replace(/\s+/g, ' ').trim()
  const amStart = new RegExp(`^(?:${re.source})`, 'i')
  let t = amStart.test(roh) ? roh.replace(amStart, 'That') : roh.replace(re, 'that')
  t = t.replace(/\s+/g, ' ').replace(/\s+([,.;!?])/g, '$1').replace(/,\s*,/g, ',').trim()
  if (!/[.!?]$/.test(t)) t = `${t}.`
  if (t.split(/\s+/).filter(Boolean).length < 4) return zeile
  return t.charAt(0).toUpperCase() + t.slice(1)
}

const GETEILTE_PHRASEN = [
  'pricing power',
  'market lock',
  'land ownership',
  'franchise fees',
  'proprietary formulas',
  'patented drugs',
  'patented devices',
  'network effects',
  'switching costs',
  'tool monopoly',
  'route network',
  'high barriers',
]

/** Dieselbe Inhaltsphrase nicht im nächsten Satz wiederholen. */
export function ohneGeteiltePhrase(vorher: string, zeile: string): string {
  let t = zeile
  const vorherL = vorher.toLowerCase()
  for (const phrase of GETEILTE_PHRASEN) {
    if (!vorherL.includes(phrase)) continue
    const re = new RegExp(`\\b${phrase}\\b`, 'ig')
    if (!re.test(t)) continue
    t = t.replace(new RegExp(`\\b${phrase}\\b`, 'ig'), phrase === 'pricing power' ? 'that edge' : 'that advantage')
  }
  t = t.replace(/\s+/g, ' ').replace(/\bthat that\b/gi, 'that').replace(/\s+([,.;!?])/g, '$1').trim()
  if (!/[.!?]$/.test(t)) t = `${t}.`
  if (t.split(/\s+/).filter(Boolean).length < 4) return zeile
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Steht die Kennzahl schon im Satz davor, heißt sie im nächsten nicht noch einmal beim Namen. */
export function ohneNackteKennzahl(vorher: string, zeile: string, wert: string, label: string, id = ''): string {
  const name = kennzahlGesprochen(label, id).trim()
  if (!wert || !name || !vorher.includes(wert)) return zeile
  if (zeile.includes(wert)) return zeile
  const quelle = `\\b${name.split(/\s+/).map(escapeReg).join('\\s+')}\\b`
  if (!new RegExp(quelle, 'i').test(zeile)) return zeile
  let t = zeile.replace(new RegExp(quelle, 'ig'), 'That figure')
  t = t.replace(/\s+/g, ' ').replace(/\bthat that\b/gi, 'that').replace(/\s+([,.;!?])/g, '$1').trim()
  if (!/[.!?]$/.test(t)) t = `${t}.`
  if (t.split(/\s+/).filter(Boolean).length < 4) return zeile
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function kennzahlVorDerZahl(text: string, wert: string, label: string, id = ''): boolean {
  const idx = text.toLowerCase().indexOf(wert.toLowerCase())
  if (idx < 0) return false
  const kopf = text.slice(0, idx).toLowerCase()
  const namen = kennzahlGesprochen(label, id)
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !['year', 'average', 'return'].includes(w))
  return namen.length > 0 && namen.every((w) => kopf.includes(w))
}

export function antwortFuerKennzahl(wert: string, label: string, id = '', kontext = ''): string {
  const rohName = kennzahlGesprochen(label, id)
  const name = /[a-z]/.test(rohName) ? rohName.toLowerCase() : rohName
  const treiber = treiberAusText(kontext)
  const folge = analyseKlausel(label, id)
  const voll = `${treiber.subjekt} ${treiber.verb} a massive ${wert} ${name}${folge}.`
  const satz = woerter(voll).length <= 12 ? voll : `${treiber.subjekt} ${treiber.verb} a ${wert} ${name}${folge}.`
  return flussZurZahl(mitAnalyse(satz, label, id))
}

function proofIstDruck(text: string, wert: string, label: string, id: string): boolean {
  if (!wert || !text.includes(wert) || satzUnbrauchbar(text) || /\?\s*$/.test(text.trim())) return false
  if (/^\s*because\b/i.test(text)) return false
  if (kennzahlVorDerZahl(text, wert, label, id)) return false
  if (!/\b(?:drives|drive)\b/i.test(text)) return false
  if (!/,/.test(text) && !/\bproving\b/i.test(text)) return false
  return nenntKennzahl(text, label, id)
}

/**
 * Sekunde 0–5: ganzer Satz, und die Antwort begründet genau diese Frage.
 * Marge oder Kapitalrendite nur nach einer Macht- oder Dominanzfrage.
 */
export function hookPaar(
  claim: string,
  proof: string,
  firma: string,
  wert: string,
  label: string,
  id = '',
  kontext = '',
): { claim: string; proof: string } {
  const art = hookKennzahlArt(label, id)
  let frage = frageFuerHook(claim, firma, wert)
  const rohAntwort = proof.replace(/\s+/g, ' ').trim()
  let antwort =
    proofIstDruck(rohAntwort, wert, label, id) && woerter(rohAntwort).length <= 16
      ? `${rohAntwort.replace(/[.]+$/g, '').trim()}.`
      : antwortFuerKennzahl(wert, label, id, kontext)
  const frageKaputt = !/\?\s*$/.test(frage) || satzUnbrauchbar(frage) || Boolean(wert && frage.includes(wert))
  const treiber = treiberAusText(kontext)
  const name = firmenwort(firma)
  const fremd = (satz: string) => fremderKlassenSatz(satz, kontext)

  if (frageKaputt || fremd(frage)) frage = treiber.frage(name)
  else if ((art === 'marge' || art === 'kapital') && !fragePasstZumTreiber(frage, treiber.id) && !fragtNachMachtOderDominanz(frage)) {
    frage = treiber.frage(name)
  }
  if (satzUnbrauchbar(frage)) frage = treiber.frage(name)
  if (fremd(antwort) || !proofIstDruck(antwort, wert, label, id)) antwort = antwortFuerKennzahl(wert, label, id, kontext)
  antwort = flussZurZahl(mitAnalyse(satzOhneDoppelteZahl(antwort, wert, label, id), label, id))
  return { claim: frage, proof: antwort }
}

type MoatSprechProps = Pick<MoatShortProps, 'hook' | 'proof' | 'pillars' | 'crack' | 'closing' | 'metricValue' | 'metricLabel' | 'business'>

/** Gesprochener Text vor ElevenLabs: keine doppelte Kennzahl, kein Punkt vor der Zahl. */
export function sanitiereMoatFuerStimme<T extends MoatSprechProps>(props: T): T {
  const wert = props.metricValue
  const label = props.metricLabel
  let proof = flussZurZahl(satzOhneDoppelteZahl(props.proof, wert, label))
  if (wert && proof.includes(wert) && kennzahlVorDerZahl(proof, wert, label)) {
    proof = antwortFuerKennzahl(wert, label, '', props.business)
  }
  const zeilen = [
    { key: 'hook', text: flussZurZahl(props.hook) },
    { key: 'proof', text: proof },
    ...props.pillars.map((p, i) => ({ key: `p${i}`, text: flussZurZahl(p.line) })),
    { key: 'crack', text: flussZurZahl(props.crack) },
    { key: 'closing', text: flussZurZahl(props.closing) },
  ]
  let vorher = ''
  const rein = zeilen.map((z) => {
    let text = z.text
    if (vorher) {
      text = ohneNackteKennzahl(vorher, ohneGeteiltePhrase(vorher, ohneDoppelteWendung(vorher, text, wert, label)), wert, label)
      text = flussZurZahl(text)
    }
    vorher = text
    return { key: z.key, text }
  })
  const nachKey = new Map(rein.map((z) => [z.key, z.text]))
  return {
    ...props,
    hook: nachKey.get('hook') ?? props.hook,
    proof: nachKey.get('proof') ?? proof,
    pillars: props.pillars.map((p, i) => {
      const line = nachKey.get(`p${i}`) ?? p.line
      return line === p.line ? p : { ...p, line }
    }),
    crack: nachKey.get('crack') ?? props.crack,
    closing: nachKey.get('closing') ?? props.closing,
  }
}

/** Null, wenn aufeinanderfolgende Sätze keine Wendung teilen. */
export function doppelteWendung(props: MoatSprechProps): string | null {
  if (props.metricValue && kennzahlVorDerZahl(props.proof, props.metricValue, props.metricLabel)) {
    return 'Die Kennzahl steht zweimal im selben Satz.'
  }
  const zeilen = [props.hook, props.proof, ...props.pillars.map((p) => p.line), props.crack, props.closing].filter((z) => z.trim())
  let vorher = zeilen[0] ?? ''
  for (let i = 1; i < zeilen.length; i++) {
    const z = zeilen[i] ?? ''
    const neu = ohneNackteKennzahl(
      vorher,
      ohneGeteiltePhrase(vorher, ohneDoppelteWendung(vorher, z, props.metricValue, props.metricLabel)),
      props.metricValue,
      props.metricLabel,
    )
    if (neu.replace(/\s+/g, ' ').trim() !== z.replace(/\s+/g, ' ').trim()) return 'Dieselbe Wendung in zwei Sätzen hintereinander.'
    vorher = z
  }
  return null
}

/** Schätzung vor der Aufnahme. 2,3 Wörter/s bei Tempo 1, mal den Regler. */
export function schaetzeSprechsekunden(texte: string[], tempo = 1.15): number {
  const n = texte.join(' ').split(/\s+/).filter(Boolean).length
  const t = Math.min(1.2, Math.max(0.7, tempo))
  return n / (2.3 * t)
}

const HAUSHALTE = ['Apple', 'Nvidia', 'NVIDIA', 'TSMC', 'Microsoft', 'Google', 'Amazon', 'Tesla', 'Samsung', 'Coca-Cola', 'Nike', 'Disney', 'Netflix', 'Meta', 'Sony', 'Intel', 'Adidas', 'BMW', 'Mercedes', 'Toyota', 'Pfizer', 'Starbucks', 'McDonald']

/** Nur Marken, die im Text dieser Firma wörtlich stehen. Keine wird dazuerfunden. */
export function ankerAusText(text: string, firma: string): string[] {
  const eigene = firma.toLowerCase()
  const treffer: string[] = []
  for (const name of HAUSHALTE) {
    if (!new RegExp(`\\b${name}\\b`, 'i').test(text)) continue
    if (eigene.includes(name.toLowerCase())) continue
    const label = name === 'NVIDIA' ? 'Nvidia' : name
    if (treffer.some((t) => t.toLowerCase() === label.toLowerCase())) continue
    treffer.push(label)
    if (treffer.length === 2) break
  }
  return treffer
}

export function istOffeneBruecke(land: string, value?: string): boolean {
  const t = oeffneSprechende(ohneKiBindestrich(land))
  if (!t || ABSCHIED.test(t) || /\bout of 10\b/i.test(t)) return false
  if (value && t.includes(value)) return false
  if (ZUSAMMENFASSUNG.test(t) && !BRUECKE_ENDE.test(t)) return false
  return BRUECKE_ENDE.test(t)
}

/** Letzter Satz vor dem Restart. Eine kurze Brücke, keine zweite Schlussrunde. */
export function saubererLand(land: string, verdict: MoatShortVerdict, value: string): string {
  const t = oeffneSprechende(ohneKiBindestrich(land))
  const woerter = t.split(/\s+/).filter(Boolean).length
  if (istOffeneBruecke(t, value) && woerter <= 10 && t.length <= 78) return t
  if (
    t &&
    woerter <= 7 &&
    !ABSCHIED.test(t) &&
    !/\bout of 10\b/i.test(t) &&
    !(value && t.includes(value)) &&
    !ZUSAMMENFASSUNG.test(t)
  ) {
    return `${t}, which is why`
  }
  return fallbackLand(verdict, value)
}

export function loopSatz(land: string, hook: string): string {
  return `${oeffneSprechende(land)} ${hook.trim()}`.replace(/\s+/g, ' ').trim()
}

export function verboteneWoerterIn(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `
  return VERBOTENE_WOERTER.filter((w) => lower.includes(` ${w} `) || lower.includes(` ${w}.`) || lower.includes(` ${w},`))
}

function saetze(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function zuLangeSaetze(text: string, max = SATZ_MAX_WOERTER): string[] {
  return saetze(text).filter((s) => woerter(s).length > max)
}

const SCHLECHTES_ENDE = new Set(
  'a an the of and or to for in on with from by at out into that so because which who just than as if when while both every their its this these those next them him her your our per via can could would should might must will shall did does is are was were be been being'.split(
    ' ',
  ),
)

function satzEnde(text: string, bruecke: boolean, frage = false): string {
  const kern = text.replace(/[.!?…,;:\s]+$/u, '').trim()
  if (!kern) return kern
  if (bruecke || BRUECKE_ENDE.test(kern)) return kern
  if (frage || /\?\s*$/.test(text.trim())) return `${kern}?`
  return `${kern}.`
}

function letztesWort(text: string): string {
  const w = woerter(text)
  return (w[w.length - 1] ?? '').replace(/[^A-Za-z]/g, '').toLowerCase()
}

function endetSauber(text: string): boolean {
  const last = letztesWort(text)
  return Boolean(last) && !SCHLECHTES_ENDE.has(last)
}

function haengtPartizip(text: string): boolean {
  return /\b(selling|using|running|building|pulling|training|living)\.?$/i.test(text.trim())
}

/** „losing“ ohne Objekt ist abgeschnitten. „losing market share“ bleibt. */
function endetOhneObjekt(text: string): boolean {
  return /^(losing|gaining|raising|cutting|charging|causing|replacing|earning|saving|seeking|buying|selling|holding|dropping|missing)$/.test(
    letztesWort(text),
  )
}

/** Adjektive, die keinen Satz beenden dürfen. „pay endless“ fehlt das Substantiv. */
const ABGEBROCHENES_ENDE = new Set(
  'endless legal operational massive global institutional financial regulatory competitive significant extreme absolute huge tiny major severe heavy pure gross operating pricing dominant several various ongoing remaining potential existing'.split(
    ' ',
  ),
)

function endetAufAbbruch(text: string): boolean {
  const last = letztesWort(text)
  if (!last || SCHLECHTES_ENDE.has(last)) return true
  if (/^(operating|gross|legal|operational|institutional|regulatory|competitive|financial)$/.test(last)) return true
  const w = woerter(text)
  const prev = (w[w.length - 2] ?? '').replace(/[^A-Za-z]/g, '').toLowerCase()
  if (ABGEBROCHENES_ENDE.has(last) && /^(pay|pays|paying|charge|charges|charging|cause|causes|causing|face|faces|facing|and|or)$/.test(prev)) {
    return true
  }
  return false
}

/** „legal and operational friction“ zählt zwei Adjektive als eine Sache und bleibt ein Stummel. */
function unvollstaendigeAufzaehlung(text: string): boolean {
  return /\b\w+(?:al|ive|ous|ful|less)\s+and\s+\w+(?:al|ive|ous|ful|less)\b/i.test(text)
}

function satzUnbrauchbar(text: string): boolean {
  return endetAufAbbruch(text) || unvollstaendigeAufzaehlung(text) || haengtPartizip(text) || endetOhneObjekt(text)
}

function klingtNachMensch(text: string): boolean {
  if (haengtPartizip(text) || endetAufAbbruch(text) || endetOhneObjekt(text)) return false
  if (/\bselling\s+\w+\.?$/i.test(text.trim())) return false
  if (/\bno\s+\w+\s+can\s+avoid\b/i.test(text)) return false
  if (/\b(operational complexity|ecosystem)\b/i.test(text)) return false
  return endetSauber(text)
}

/** Gestapelte KI-Schlüsse werden zu einem Satz, den man laut sagen kann. */
function sprichNatuerlich(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  const selling = t.match(/^(.*?)\s+selling\s+([A-Za-z][\w-]*)\s+no\s+\w+\s+can\s+avoid\.?$/i)
  if (selling) {
    const kern = selling[1]!.replace(/[,;:\s]+$/g, '')
    const sache = selling[2]!.toLowerCase()
    const mitSache = `${kern}, and companies can't leave the ${sache}.`
    const kurz = `${kern} that companies can't leave.`
    const satz = woerter(mitSache).length <= 12 && mitSache.length <= 78 ? mitSache : kurz
    if (woerter(satz).length >= 7 && satz.length <= 78) return satz
  }
  const dass = t.match(/^(.*?)\s+that\s+no\s+\w+\s+can\s+avoid\.?$/i)
  if (dass) {
    const kern = dass[1]!.replace(/[,;:\s]+$/g, '')
    const satz = `${kern}, and companies can't avoid it.`
    if (woerter(satz).length >= 7 && satz.length <= 78) return satz
  }
  const von = t.match(/^(.*?)\s+of\s+(?:a|an|the)\s+.+?\s+(is|are)\s+((?:a|an|the)\s+)?(nightmare|problem|mess)\.?$/i)
  if (von) {
    const satz = `${von[1]} ${von[2]} a ${von[4]}.`.replace(/\s+/g, ' ')
    if (woerter(satz).length >= 7 && satz.length <= 78) return satz
  }
  return t
}

/** „that already lives“ ist ein abgeschnittener Relativsatz, kein gesprochener Satz. */
function relativStummel(text: string): boolean {
  const rest = text.match(/\b(?:that|which|who)\b\s+([^.]+)$/i)?.[1]
  if (!rest) return false
  return rest.trim().split(/\s+/).filter(Boolean).length <= 3
}

const KUERZ_MUSTER = [
  /\s+no\s+.+$/i,
  /\s+of\s+(?:a|an|the)\s+.+?(?=\s+(?:is|are|was|were)\b)/i,
  /\s+of\s+(?:a|an|the)\s+.+$/i,
  /\s+for\s+(?:a|an|the)\s+.+$/i,
  /\s+just to\s+.+$/i,
  /\s+that\s+.+$/i,
  /\s+which\s+.+$/i,
  /\s+who\s+.+$/i,
  /,\s*so\s+.+$/i,
  /\s+so\s+.+$/i,
  /\s+in\s+(?:one|a|the|this|that)\s+.+$/i,
  /,\s+.+$/,
  /\s+because\s+.+$/i,
  /\s+selling\s+.+$/i,
  /\s+of\s+.+$/i,
]

/** Schneidet Füllphrasen, bis der Satz in Untertitel und Zeitbudget passt. Die Kennzahl bleibt stehen. */
export function kuerzeGesprocheneZeile(
  roh: string,
  opts?: { maxWoerter?: number; maxZeichen?: number; behalten?: string; bruecke?: boolean; frage?: boolean },
): string {
  const maxW = opts?.maxWoerter ?? 12
  const maxC = opts?.maxZeichen ?? 78
  const bruecke = Boolean(opts?.bruecke)
  let start = ohneKiBindestrich(roh).replace(/\s+/g, ' ').trim()
  if (!bruecke) start = sprichNatuerlich(start)
  if (bruecke) start = oeffneSprechende(start)
  const behalten = opts?.behalten?.trim()
  const muss = behalten && start.includes(behalten) ? behalten : undefined
  const fertig = (s: string) => satzEnde(s, bruecke, Boolean(opts?.frage))
  const gueltig = (s: string) => {
    const out = fertig(s)
    return (
      woerter(out).length >= 7 &&
      woerter(out).length <= maxW &&
      out.length <= maxC &&
      klingtNachMensch(out) &&
      (!muss || out.includes(muss))
    )
  }
  if (gueltig(start)) return fertig(start)

  const nachbarn = (basis: string): { text: string; art: 'muster' | 'wort' }[] => {
    const rohBasis = basis.replace(/[.!?…]+$/u, '').trim()
    const aus: { text: string; art: 'muster' | 'wort' }[] = []
    const merke = (next: string, art: 'muster' | 'wort') => {
      const s = next.replace(/[,;:\s]+$/g, '').replace(/\s+/g, ' ').trim()
      if (s && s !== rohBasis) aus.push({ text: s, art })
    }
    merke(rohBasis.replace(/\b(?:both|just|already|still|really|actually|very)\b/i, ''), 'muster')
    for (const re of KUERZ_MUSTER) {
      if (!re.test(rohBasis)) continue
      merke(rohBasis.replace(re, ''), 'muster')
    }
    const teile = rohBasis.split(/\s+/).filter(Boolean)
    if (teile.length > 7) merke(teile.slice(0, -1).join(' '), 'wort')
    return aus
  }

  let wahl: { text: string; art: 'muster' | 'wort' } | null = null
  const queue = [start]
  const gesehen = new Set<string>([start])
  let schritte = 0
  while (queue.length && schritte < 48) {
    const basis = queue.shift()!
    schritte += 1
    for (const v of nachbarn(basis)) {
      if (gesehen.has(v.text)) continue
      gesehen.add(v.text)
      if (woerter(v.text).length < 7) continue
      if (muss && !v.text.includes(muss)) continue
      queue.push(v.text)
      if (!gueltig(v.text)) continue
      if (!wahl) {
        wahl = v
        continue
      }
      const neuSt = relativStummel(v.text)
      const altSt = relativStummel(wahl.text)
      const besser =
        (altSt && !neuSt) ||
        (altSt === neuSt &&
          ((v.art === 'muster' && wahl.art === 'wort') ||
            (v.art === wahl.art && woerter(v.text).length > woerter(wahl.text).length)))
      if (besser) wahl = v
    }
  }
  return fertig(wahl?.text ?? start)
}

export function scriptTonWarnungen(texte: string[]): string[] {
  const w: string[] = []
  const alles = texte.filter(Boolean).join(' ')
  const verboten = verboteneWoerterIn(alles)
  if (verboten.length) w.push(`KI-Ton im Script: ${verboten.join(', ')}. Ersetzen.`)
  const kauder = FIRMENSPRECH.filter((p) => alles.toLowerCase().includes(p))
  if (kauder.length) w.push(`Firmensprech: „${kauder[0]}“. Sag es wie am Tisch, nicht wie im Memo.`)
  const memo = texte.flatMap((t) => saetze(t)).find((s) => memoTreffer(s) >= 2)
  if (memo && !kauder.length) w.push(`Memo-Satz, keine Tischsprache: „${memo}“`)
  if (/[—–]|\s-\s/.test(alles)) w.push('Gedankenstriche im Script. Komma oder ganzer Satz, kein Bindestrich.')
  const lang = texte.flatMap((t) => zuLangeSaetze(t))
  if (lang.length) w.push(`Sätze über ${SATZ_MAX_WOERTER} Wörter: „${lang[0]}“`)
  const fetzen = texte
    .flatMap((t) => saetze(t))
    .filter((s) => {
      const n = woerter(s).length
      return n > 0 && n < SATZ_MIN_WOERTER && !/[?]$/.test(s) && !BRUECKE_ENDE.test(oeffneSprechende(s))
    })
  if (fetzen.length) w.push(`Zu kurz, klingt nach Slogan: „${fetzen[0]}“`)
  const zuLang = texte.find((t) => {
    const s = t.replace(/\s+/g, ' ').trim()
    const deckel = /\bproving\b/i.test(s) && /\d/.test(s) ? 110 : 78
    return s.length > deckel
  })
  if (zuLang) w.push(`Zu lang, der Untertitel bricht: „${zuLang}“`)
  const feld = alles.match(/\b[a-z][a-z0-9]*_[a-z0-9_]+\b/)
  if (feld) w.push(`Interner Feldname im Satz: „${feld[0]}“. Sag die Kennzahl auf Englisch.`)
  return w
}

export function hashtagTicker(ticker: string): string {
  const t = ticker.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return t || 'STOCKS'
}

const TITEL_MIN = 40
const TITEL_MAX = 60

function saubererTitelKern(roh: string): string {
  let t = roh.replace(/#\w+/g, ' ').replace(/\s+/g, ' ').replace(/!{2,}/g, '').replace(/\?{2,}/g, '?').trim()
  if (t.length > 8 && t === t.toUpperCase()) t = `${t.charAt(0)}${t.slice(1).toLowerCase()}`
  return t
}

function kuerzeTitel(t: string): string {
  if (t.length <= TITEL_MAX) return t
  return t.slice(0, TITEL_MAX).replace(/\s+\S*$/, '').replace(/[-–:,]+$/u, '').trim()
}

const FLAUSCH =
  /\b(unmatched|discover the|key numbers|game-changer|delve|in this video|ultimate|you won't believe|incredible|massive|the tell)\b/i

function wortVorne(t: string, wort: string): boolean {
  return t.toLowerCase().startsWith(wort.toLowerCase())
}

function titelScore(t: string, ticker: string, name: string): number {
  let s = 0
  if (name.length >= 4 && wortVorne(t, name)) s += 6
  else if (new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(t)) s += 4
  else if (wortVorne(t, ticker)) s += 2
  if (/\b(why|what|is|moat)\b/i.test(t)) s += 3
  if (/\d/.test(t)) s += 2
  if (t.length >= TITEL_MIN && t.length <= TITEL_MAX) s += 4
  else s -= 6
  if (t.includes(':') || FLAUSCH.test(t) || /\b(back on track|stock analysis|breakdown|explained)\b/i.test(t)) s -= 8
  if (/\bstock price\b/i.test(t) || /\bbuy now\b/i.test(t)) s -= 8
  if (/^(how to download|watch|official)/i.test(t)) s -= 6
  return s
}

function labelKurz(label: string): string {
  return label.replace(/\b(ltm|ttm|trailing|last twelve months)\b/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** „an eight / an eleven“, sonst „a“. */
function artikelVorZahl(metrik: string): 'a' | 'an' {
  const z = metrik.trim().replace(/^[^0-9]+/, '')
  return /^(8|11|18)(\D|$)/.test(z) ? 'an' : 'a'
}

/** Shorts: eine gesprochene Zeile, 40–60 Zeichen, kein Doppelpunkt, kein Memo. */
export function titelFuerUpload(
  roh: string,
  ticker: string,
  metrik: string,
  suchphrasen: string[] = [],
  opts?: { firmenname?: string; metrikLabel?: string },
): string {
  const name = firmenKurzname(opts?.firmenname || '') || ticker
  const label = labelKurz(opts?.metrikLabel || 'margin') || 'margin'
  const gebaut = kuerzeTitel(`Why ${name}'s ${metrik} ${label} is the moat`)
  const zweiter = kuerzeTitel(`Is ${name}'s ${metrik} ${label} a real moat?`)
  const dritter = kuerzeTitel(`What keeps ${name}'s ${metrik} ${label}?`)
  const ki = saubererTitelKern(roh)
  const kandidaten = [ki, gebaut, zweiter, dritter].filter((t) => t.length >= 8 && !t.includes(':'))
  for (const p of suchphrasen) {
    const kern = saubererTitelKern(p)
    if (kern.length >= TITEL_MIN && phrasePasst(kern, ticker, name)) kandidaten.push(kern)
  }
  let best = gebaut.length >= TITEL_MIN ? gebaut : zweiter
  let bestScore = -99
  for (const t of kandidaten.map(kuerzeTitel)) {
    const sc = titelScore(t, ticker, name)
    if (sc > bestScore) {
      best = t
      bestScore = sc
    }
  }
  if (best.length < TITEL_MIN) best = kuerzeTitel(`Why ${name}'s ${metrik} ${label} still holds`)
  return best.charAt(0).toUpperCase() + best.slice(1)
}

function satzeOhneMeta(roh: string): string[] {
  return roh
    .replace(/#\w+/g, ' ')
    .replace(/not investment advice\.?/gi, ' ')
    .replace(/altered or synthetic media\.?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12)
}

function satzGross(s: string): string {
  const t = s.replace(/\s+[—–]\s+/g, ', ').replace(/\s+/g, ' ').trim()
  if (!t) return t
  const mitPunkt = /[.!?]$/.test(t) ? t : `${t}.`
  return mitPunkt.charAt(0).toUpperCase() + mitPunkt.slice(1)
}

function saubereSaetze(roh: string): string[] {
  return satzeOhneMeta(roh)
    .map(satzGross)
    .filter((s) => s.length > 12 && s.length < 180 && !FLAUSCH.test(s) && /^[A-Z0-9"']/.test(s))
}

/** Zeile 1 = echte Suchphrase. Danach zwei korrekte Sätze. Hashtags am Ende. */
export function beschreibungFuerUpload(
  roh: string,
  firmenname: string,
  ticker: string,
  metrik: string,
  titel = '',
  suchphrasen: string[] = [],
  metrikLabel = 'margin',
): string {
  const name = firmenKurzname(firmenname) || ticker
  const label = labelKurz(metrikLabel) || 'margin'
  const suche =
    suchphrasen.find((p) => phrasePasst(p, ticker, firmenname) && /\b(moat|stock|monopoly)\b/i.test(p)) ??
    `${name} moat`
  const erste = satzGross(`${suche} comes down to ${artikelVorZahl(metrik)} ${metrik} ${label}`)
  const titelNorm = titel.replace(/\s+/g, ' ').trim().toLowerCase()
  const kern = saubereSaetze(roh)
    .filter((s) => s.toLowerCase() !== titelNorm && !s.toLowerCase().startsWith(suche.toLowerCase()))
    .slice(0, 2)
    .join(' ')
  const mitte = kern || satzGross(`The question is whether that ${label} is a moat or just a good year`)
  const hash = `#Shorts #${hashtagTicker(ticker)} #moat`
  return `${erste}\n\n${mitte}\n\nNot investment advice. Altered or synthetic media.\n${hash}`
}

export function kommentarFuerUpload(roh: string, verdict: MoatShortVerdict, ticker: string): string {
  const t = roh.replace(/\s+/g, ' ').replace(/#\w+/g, '').trim()
  if (t && !/\b(subscribe|follow|like this)\b/i.test(t) && t.length <= 80) return t
  if (verdict === 'wide') return `Is ${ticker} a wide moat, or just the only shop in town?`
  if (verdict === 'narrow') return `${ticker}: narrow moat. Durable, or one shock away?`
  return `${ticker}: no moat. Agree, or am I missing the lock-in?`
}

export function scriptLoopWarnungen(hook: string, land: string, value: string, proof = '', label = ''): string[] {
  const w: string[] = []
  const zahl = proof.trim() ? proof : hook
  if (value && !zahl.includes(value)) w.push(`Die Antwort nennt ${value} nicht wörtlich.`)
  if (value && proof.trim() && hook.includes(value)) w.push(`Die Frage nennt ${value}. Die Zahl kommt erst als Antwort.`)
  if (proof.trim() && satzUnbrauchbar(hook)) {
    w.push('Die Frage ist kein ganzer Satz. Nicht auf einem Adjektiv enden, und keine halbe Aufzählung wie „legal and operational“.')
  }
  if (proof.trim() && satzUnbrauchbar(proof)) {
    w.push('Die Antwort ist kein ganzer Satz. Das Substantiv muss stehen, zum Beispiel „endless fees“, nicht „endless“.')
  }
  const art = hookKennzahlArt(label)
  if (proof.trim() && (art === 'marge' || art === 'kapital') && !fragtNachMachtOderDominanz(hook) && !/\b(land|real estate|property|franchise|royalt|fees?|patent|drug|device|network|switch|contract|machine|fab|chip|tool|route|rail|rebuild|rival)\b/i.test(hook)) {
    w.push('Die Frage muss den ökonomischen Motor treffen, zum Beispiel Grundbesitz, Franchise, Patent oder Netz, nicht den Verkauf des Endprodukts.')
  }
  if (proof.trim() && /^\s*because\b/i.test(proof)) {
    w.push('Die Antwort stellt Because vor die Kennzahl. Erst der Treiber, dann die Zahl, dann die Folge.')
  }
  if (proof.trim() && kennzahlVorDerZahl(proof, value, label)) {
    w.push('Die Antwort benutzt die Kennzahl als Ursache. Nicht „Operating margin … operating margin“. Der Treiber ist das Geschäftsmodell.')
  }
  if (proof.trim() && !/\b(?:drives|drive)\b/i.test(proof)) {
    w.push('Die Antwort muss lauten: Treiber, dann „drives a“, dann die Kennzahl, dann „proving …“. Kein Punkt vor der Zahl.')
  }
  if (value && land.includes(value)) {
    w.push(`Die Landung wiederholt ${value} — der Restart stottert. Zahl nur in der Antwort.`)
  }
  if (proof.trim() && !/\?\s*$/.test(hook.trim())) w.push('Der Einstieg ist keine Frage. Die erste Zeile muss eine Frage sein.')
  if (ABSCHIED.test(land) || /\bout of 10\b/i.test(land) || ZUSAMMENFASSUNG.test(land)) {
    w.push('Die Landung ist ein Schlusssatz. Mach eine offene Brücke, die in den Hook mündet.')
  }
  if (!istOffeneBruecke(land, value)) {
    w.push(`Loop prüfen: „${loopSatz(land, hook)}“ muss als ein Satz klingen.`)
  }
  return w
}

export function scriptStoryWarnungen(hookLoop: string, crack: string): string[] {
  if (!hookLoop.trim() || !crack.trim()) return []
  if (istSpannungOhneSpoiler(hookLoop, crack)) return []
  return ['Der Spannungssatz spoilt die Bedrohung. Erst die Säulen, dann der Bruch, einmal.']
}
