/**
 * Adaptive Historie für Scorecards: kein starres 10J-Fenster.
 *
 * Viele Titel (IPO, Spin-off, Restatement) haben keine vergleichbare Dekade.
 * Wir nehmen die längste *saubere* Reihe (3–10 GJ), beschriften sie ehrlich
 * und werten fehlende 10J-Werte nicht als 0.
 */
import { cagrProzent, werteOhneNiveauSprung } from '@/lib/portfolio-analyse/fundamentaldaten-format'

export type HorizontStufe = 'lang' | 'mittel' | 'kurz' | 'duenn'

export type AdaptiverCagr = {
  pct: number
  jahre: number
  /** Wie die Zahl zustande kam — für Label/Fußnote. */
  methode: 'cagr' | 'yoy-mittel'
}

const MIN_CAGR_JAHRE = 3
const MAX_CAGR_JAHRE = 10

export function horizontStufe(geschaeftsjahre: number): HorizontStufe {
  if (geschaeftsjahre >= 9) return 'lang'
  if (geschaeftsjahre >= 6) return 'mittel'
  if (geschaeftsjahre >= 3) return 'kurz'
  return 'duenn'
}

export function horizontStufeLabel(stufe: HorizontStufe): string {
  switch (stufe) {
    case 'lang':
      return 'lange Historie'
    case 'mittel':
      return 'mittlere Historie'
    case 'kurz':
      return 'kurze Historie'
    case 'duenn':
      return 'sehr kurze Historie'
  }
}

export function wachstumLabel(basis: string, jahre: number | null): string {
  if (jahre == null) return basis
  return `${basis} ${jahre}J`
}

/** Aufeinanderfolgende positive Werte vom jüngsten Jahr rückwärts. */
export function positiverSchwanz(werte: number[]): number[] {
  const out: number[] = []
  for (let i = werte.length - 1; i >= 0; i--) {
    const v = werte[i]
    if (v == null || !Number.isFinite(v) || v <= 0) break
    out.unshift(v)
  }
  return out
}

function cagrAufFenster(werte: number[], jahre: number): number | null {
  if (jahre < MIN_CAGR_JAHRE) return null
  const slice = werte.slice(-(jahre + 1))
  if (slice.length < jahre + 1) return null
  return cagrProzent(slice, jahre)
}

function yoyMittel(werte: number[], maxPaare = 5): { pct: number; jahre: number } | null {
  const rates: number[] = []
  const start = Math.max(1, werte.length - maxPaare)
  for (let i = start; i < werte.length; i++) {
    const a = werte[i - 1]
    const b = werte[i]
    if (a == null || b == null || a <= 0 || b <= 0) continue
    rates.push(((b - a) / a) * 100)
  }
  if (rates.length < 2) return null
  const pct = rates.reduce((s, r) => s + r, 0) / rates.length
  return Number.isFinite(pct) ? { pct, jahre: rates.length } : null
}

/**
 * Längstes CAGR-Fenster am aktuellen Ende (10→3), nur durchgehend positive Jahre.
 * Verlustjahre und IPO-Kanten kürzen das Fenster — sie werden nicht überbrückt.
 * Letzter Ausweg: mittleres YoY über positive Paare (kein erfundenes 10J).
 */
export function adaptiverCagr(werte: number[]): AdaptiverCagr | null {
  const finite = werte.filter((v) => Number.isFinite(v))
  if (finite.length < 2) return null

  const schwanz = positiverSchwanz(finite)
  const clean = werteOhneNiveauSprung(schwanz)
  const serie = clean.length >= MIN_CAGR_JAHRE + 1 ? clean : schwanz
  const maxJ = Math.min(MAX_CAGR_JAHRE, serie.length - 1)
  for (let j = maxJ; j >= MIN_CAGR_JAHRE; j--) {
    const pct = cagrAufFenster(serie, j)
    if (pct != null) return { pct, jahre: j, methode: 'cagr' }
  }

  const yoy = yoyMittel(schwanz.length >= 2 ? schwanz : finite, 5)
  if (yoy) return { pct: yoy.pct, jahre: yoy.jahre, methode: 'yoy-mittel' }
  return null
}

export function zaehleGeschaeftsjahre(
  perioden: { iso: string; istLtm?: boolean; istNtm?: boolean; istSchaetzung?: boolean }[] | undefined,
): number {
  return (
    perioden?.filter(
      (p) =>
        !p.istLtm &&
        !p.istNtm &&
        !p.istSchaetzung &&
        /^\d{4}-\d{2}-\d{2}$/.test(p.iso),
    ).length ?? 0
  )
}

export function historieBadge(geschaeftsjahre: number): string {
  const stufe = horizontStufe(geschaeftsjahre)
  return `${geschaeftsjahre} GJ · ${horizontStufeLabel(stufe)}`
}

export function historieFussnote(geschaeftsjahre: number): string {
  const stufe = horizontStufe(geschaeftsjahre)
  switch (stufe) {
    case 'lang':
      return 'CAGR und Stabilität über die längste saubere Historie (bis 10 Jahre). Fehlende Balken zählen nicht als 0.'
    case 'mittel':
      return `${geschaeftsjahre} GJ Historie — kein 10J-Zwang. Qualitätsscore nur aus vorhandenen Balken.`
    case 'kurz':
      return `Kurze Börsenhistorie (${geschaeftsjahre} GJ): Fenster 3–5 Jahre. Kein Malus für fehlende Dekade.`
    case 'duenn':
      return `Sehr kurze Historie (${geschaeftsjahre} GJ): CAGR oft erst ab 3 Jahren. Score aus den übrigen Kennzahlen.`
  }
}

export function letzterWert(werte: number[]): number | null {
  for (let i = werte.length - 1; i >= 0; i--) {
    const v = werte[i]
    if (v != null && Number.isFinite(v)) return v
  }
  return null
}

/**
 * Stabilität relativ zur verfügbaren Dividendenhistorie — nicht 25-Jahre-Aristokraten-Maßstab
 * für einen Zahler seit 4 Jahren.
 */
export function dividendenStabilitaetPosition(streakJahre: number, historieJahre: number): number {
  const hist = Math.max(historieJahre, streakJahre, 1)
  const relativ = Math.min(1, streakJahre / hist)
  const absolut = Math.max(0, Math.min(1, streakJahre / 20))
  if (hist < 8) return Math.max(0, Math.min(1, 0.72 * relativ + 0.28 * absolut))
  return Math.max(0, Math.min(1, 0.4 * relativ + 0.6 * absolut))
}

export type ScoreBalkenGewicht = { position: number | null; gewicht: number }

/**
 * Fehlende Balken fließen nicht als 0 ein — Gewichte der vorhandenen werden neu skaliert.
 * Mindestens 2 Balken, sonst kein Score (statt starrer 3-von-5-Pflicht inkl. 10J-CAGR).
 */
export function score1bis10Renorm(balken: ScoreBalkenGewicht[]): number | null {
  let acc = 0
  let wSum = 0
  let n = 0
  for (const b of balken) {
    if (b.position == null || b.gewicht <= 0) continue
    acc += b.position * b.gewicht
    wSum += b.gewicht
    n++
  }
  if (n < 2 || wSum < 0.2) return null
  return Math.max(1, Math.min(10, Math.round(1 + (acc / wSum) * 9)))
}
