/**
 * Grober Branchenanker für Satz 2. Eine Klasse, kein Ticker.
 * Dieselbe Zahl steht im Satz und unter der Hero-Kennzahl.
 */

export type BranchenAnker = {
  peers: string
  value: string
  subLabel: string
}

type Klasse = {
  peers: string
  muster: RegExp
  roic: number
  gross: number
  operating: number
  fcf: number
}

const KLASSEN: Klasse[] = [
  { peers: 'payment networks', muster: /payment|card network|kreditkarte|zahlungs/i, roic: 20, gross: 75, operating: 45, fcf: 35 },
  { peers: 'chip-tool makers', muster: /semiconductor|halbleiter|chip equipment|wafer|lithograph/i, roic: 15, gross: 45, operating: 22, fcf: 18 },
  { peers: 'drug makers', muster: /pharma|biotech|arznei|\bdrug/i, roic: 12, gross: 65, operating: 18, fcf: 16 },
  { peers: 'software firms', muster: /software|saas|\bcloud\b/i, roic: 15, gross: 70, operating: 18, fcf: 22 },
  { peers: 'luxury houses', muster: /luxury|luxus|lederwaren/i, roic: 15, gross: 65, operating: 22, fcf: 18 },
  { peers: 'railroads', muster: /railroad|eisenbahn|\brail\b/i, roic: 10, gross: 40, operating: 28, fcf: 16 },
  { peers: 'health firms', muster: /healthcare|medtech|medizin|hospital|krankenhaus/i, roic: 10, gross: 45, operating: 12, fcf: 10 },
  {
    peers: 'retailers',
    muster: /retail|einzelhandel|discounter|discount|grocery|supermarket|warenhaus|verbraucher|lebensmittel|warehouse club|fachmarkt/i,
    roic: 8,
    gross: 25,
    operating: 5,
    fcf: 4,
  },
]

const STANDARD: Omit<Klasse, 'muster'> = { peers: 'rivals', roic: 10, gross: 35, operating: 12, fcf: 10 }

function klasseAus(text: string): Omit<Klasse, 'muster'> {
  return KLASSEN.find((k) => k.muster.test(text)) ?? STANDARD
}

function feld(metricId: string): 'roic' | 'gross' | 'operating' | 'fcf' {
  const id = metricId.toLowerCase()
  if (/brutto|gross/.test(id)) return 'gross'
  if (/ebit|operating/.test(id)) return 'operating'
  if (/fcf|cash/.test(id)) return 'fcf'
  return 'roic'
}

function prozent(n: number): string {
  return `${Number.isInteger(n) ? n : n}%`
}

/** Typischer Branchenwert zur Hero-Kennzahl. Retail-ROIC ist 8 %, wie im Satzmuster. */
export function branchenAnker(kontext: string, metricId: string): BranchenAnker {
  const klasse = klasseAus(kontext)
  const value = prozent(klasse[feld(metricId)])
  return { peers: klasse.peers, value, subLabel: `vs. ${value} industry avg.` }
}

/** Die andere Prozentzahl im Satz, unter der Hero-Zahl. */
export function subLabelAusBeweis(proof: string, heroValue: string): string | null {
  const hero = heroValue.replace('%', '').trim()
  const peer = [...proof.matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => m[1]!).find((n) => n !== hero)
  if (!peer) return null
  return `vs. ${peer}% industry avg.`
}
