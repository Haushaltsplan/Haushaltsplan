import { formatFundamentalWert } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import type { SecSegmentEintrag } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { segmentFarben } from '@/lib/portfolio-analyse/fundamentaldaten-struktur-hilfen'
import {
  FUNDAMENTAL_TTM_KEY,
  type FundamentaldatenPaket,
  type FundamentalMetrikZeile,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

export type GewinnflussSegmentArt = 'produkt' | 'geo'

export type GewinnflussKnotenArt = 'umsatz' | 'gewinn' | 'aufwand' | 'segment'

export type GewinnflussJahr = {
  iso: string
  jahr: number
  label: string
}

export type GewinnflussKnoten = {
  id: string
  label: string
  wertMio: number
  spalte: number
  farbe: string
  art: GewinnflussKnotenArt
}

export type GewinnflussKante = {
  von: string
  nach: string
  wertMio: number
  farbe: string
}

export type GewinnflussModell = {
  jahre: GewinnflussJahr[]
  knoten: GewinnflussKnoten[]
  kanten: GewinnflussKante[]
  hatSegmente: boolean
  segmentArt: GewinnflussSegmentArt | null
  umsatzMio: number
}

export type GewinnflussLayoutKnoten = GewinnflussKnoten & {
  x: number
  y: number
  hoehe: number
  breite: number
}

export type GewinnflussLayoutKante = GewinnflussKante & {
  d: string
}

const FARBE_UMSATZ = '#38bdf8'
const FARBE_GEWINN = '#22c55e'
const FARBE_AUFWAND = '#f87171'
const FARBE_STEUERN = '#fb7185'

function jahrAusIso(iso: string): number | null {
  const m = iso.match(/^(\d{4})-/)
  return m ? Number(m[1]) : null
}

function istIstPeriode(p: FundamentalPeriode): boolean {
  return !p.istLtm && !p.istNtm && !p.istSchaetzung && p.iso !== FUNDAMENTAL_TTM_KEY
}

function zeile(paket: FundamentaldatenPaket, id: string): FundamentalMetrikZeile | undefined {
  return paket.zeilen.find((z) => z.id === id)
}

function wertMio(paket: FundamentaldatenPaket, id: string, iso: string): number | null {
  const v = zeile(paket, id)?.werte[iso]
  if (v == null || !Number.isFinite(v) || v === 0) return null
  return v
}

function pos(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(v) || v <= 0) return 0
  return v
}

function fmtMio(v: number): string {
  return formatFundamentalWert(v, 'waehrung_usd_mio')
}

export function gewinnflussJahre(paket: FundamentaldatenPaket): GewinnflussJahr[] {
  const out: GewinnflussJahr[] = []
  for (const p of paket.perioden) {
    if (!istIstPeriode(p)) continue
    const umsatz = wertMio(paket, 'umsatz', p.iso)
    if (umsatz == null || umsatz <= 0) continue
    const jahr = jahrAusIso(p.iso)
    if (jahr == null) continue
    out.push({ iso: p.iso, jahr, label: String(jahr) })
  }
  return out
}

function segmenteFuerJahr(
  paket: FundamentaldatenPaket,
  jahr: number,
  art: GewinnflussSegmentArt,
): SecSegmentEintrag[] {
  const hist = art === 'geo' ? paket.erweitert?.secSegmentHistorie?.geo : paket.erweitert?.secSegmentHistorie?.produkt
  return hist?.jahre.find((j) => j.jahr === jahr)?.segmente ?? []
}

export function verfuegbareGewinnflussSegmentArt(paket: FundamentaldatenPaket): GewinnflussSegmentArt[] {
  const out: GewinnflussSegmentArt[] = []
  if ((paket.erweitert?.secSegmentHistorie?.produkt?.jahre.length ?? 0) > 0) out.push('produkt')
  if ((paket.erweitert?.secSegmentHistorie?.geo?.jahre.length ?? 0) > 0) out.push('geo')
  return out
}

function knoten(
  id: string,
  label: string,
  wertMioVal: number,
  spalte: number,
  farbe: string,
  art: GewinnflussKnotenArt,
): GewinnflussKnoten | null {
  if (!(wertMioVal > 0.05)) return null
  return { id, label, wertMio: wertMioVal, spalte, farbe, art }
}

function kante(von: string, nach: string, wertMioVal: number, farbe: string): GewinnflussKante | null {
  if (!(wertMioVal > 0.05)) return null
  return { von, nach, wertMio: wertMioVal, farbe }
}

export function baueGewinnfluss(
  paket: FundamentaldatenPaket,
  iso: string,
  segmentArt: GewinnflussSegmentArt | null,
): GewinnflussModell | null {
  const umsatz = wertMio(paket, 'umsatz', iso)
  if (umsatz == null || umsatz <= 0) return null
  const jahr = jahrAusIso(iso)
  const brutto = pos(wertMio(paket, 'bruttogewinn', iso))
  const ebit = pos(wertMio(paket, 'ebit', iso))
  const netto = pos(wertMio(paket, 'nettogewinn', iso))
  const rd = pos(wertMio(paket, 'rd', iso))
  const sga = pos(wertMio(paket, 'sga', iso))

  const cogs = brutto > 0 && brutto < umsatz ? umsatz - brutto : 0
  const gp = brutto > 0 && brutto <= umsatz ? brutto : 0
  const opex = gp > 0 && ebit > 0 && ebit < gp ? gp - ebit : 0
  const restNachEbit = ebit > 0 && netto > 0 && netto < ebit ? ebit - netto : 0

  const hatSegmenteQuelle = segmentArt != null && jahr != null && segmenteFuerJahr(paket, jahr, segmentArt).length > 0
  const offset = hatSegmenteQuelle ? 1 : 0

  const knotenListe: GewinnflussKnoten[] = []
  const kantenListe: GewinnflussKante[] = []

  if (hatSegmenteQuelle && jahr != null && segmentArt) {
    const segs = segmenteFuerJahr(paket, jahr, segmentArt)
    const farben = segmentFarben(Math.max(segs.length, 1))
    let sumSeg = 0
    const aufbereitet = segs
      .map((s, i) => {
        const mio =
          s.umsatzMio != null && s.umsatzMio > 0
            ? s.umsatzMio
            : s.anteilPct != null && s.anteilPct > 0
              ? (umsatz * s.anteilPct) / 100
              : 0
        return { s, i, mio }
      })
      .filter((x) => x.mio > 0)
      .sort((a, b) => b.mio - a.mio)

    const cap = umsatz * 1.02
    for (const { s, i, mio } of aufbereitet) {
      const clipped = Math.min(mio, Math.max(0, cap - sumSeg))
      if (clipped < umsatz * 0.015 && aufbereitet.length > 6) continue
      const k = knoten(`seg-${i}`, s.name, clipped, 0, farben[i % farben.length]!, 'segment')
      if (!k) continue
      knotenListe.push(k)
      const ka = kante(k.id, 'umsatz', clipped, k.farbe)
      if (ka) kantenListe.push(ka)
      sumSeg += clipped
    }
    const rest = umsatz - sumSeg
    if (rest > umsatz * 0.03) {
      const k = knoten('seg-rest', 'Sonstiges', rest, 0, '#64748b', 'segment')
      if (k) {
        knotenListe.push(k)
        const ka = kante(k.id, 'umsatz', rest, k.farbe)
        if (ka) kantenListe.push(ka)
      }
    }
  }

  const kUmsatz = knoten('umsatz', 'Umsatz', umsatz, offset, FARBE_UMSATZ, 'umsatz')
  if (kUmsatz) knotenListe.push(kUmsatz)

  if (gp > 0) {
    if (cogs > 0) {
      const kCogs = knoten('cogs', 'Umsatzkosten', cogs, offset + 1, FARBE_AUFWAND, 'aufwand')
      if (kCogs) knotenListe.push(kCogs)
      const a1 = kante('umsatz', 'cogs', cogs, FARBE_AUFWAND)
      if (a1) kantenListe.push(a1)
    }
    const kGp = knoten('brutto', 'Bruttogewinn', gp, offset + 1, FARBE_GEWINN, 'gewinn')
    if (kGp) knotenListe.push(kGp)
    const a2 = kante('umsatz', 'brutto', gp, FARBE_GEWINN)
    if (a2) kantenListe.push(a2)
  } else {
    const aufwand = umsatz - (ebit > 0 ? ebit : netto)
    if (aufwand > 0) {
      const kA = knoten('aufwand', 'Aufwand', aufwand, offset + 1, FARBE_AUFWAND, 'aufwand')
      if (kA) knotenListe.push(kA)
      const ka = kante('umsatz', 'aufwand', aufwand, FARBE_AUFWAND)
      if (ka) kantenListe.push(ka)
    }
    const gewinn = ebit > 0 ? ebit : netto
    if (gewinn > 0) {
      const kG = knoten(
        ebit > 0 ? 'ebit' : 'netto',
        ebit > 0 ? 'EBIT' : 'Nettogewinn',
        gewinn,
        offset + 1,
        FARBE_GEWINN,
        'gewinn',
      )
      if (kG) {
        knotenListe.push(kG)
        const ka = kante('umsatz', kG.id, gewinn, FARBE_GEWINN)
        if (ka) kantenListe.push(ka)
      }
    }
  }

  const gpQuelle = knotenListe.some((k) => k.id === 'brutto') ? 'brutto' : null
  if (gpQuelle && opex > 0) {
    const teile: { id: string; label: string; v: number }[] = []
    let rest = opex
    const add = (id: string, label: string, v: number) => {
      if (v <= 0 || rest <= 0) return
      const take = Math.min(v, rest)
      teile.push({ id, label, v: take })
      rest -= take
    }
    add('rd', 'F&E', rd)
    add('sga', 'SG&A', sga)
    if (rest > opex * 0.04) add('opex-rest', 'Sonstiger Aufwand', rest)

    const opexCol = offset + 2
    for (const t of teile) {
      const k = knoten(t.id, t.label, t.v, opexCol, FARBE_AUFWAND, 'aufwand')
      if (!k) continue
      knotenListe.push(k)
      const ka = kante(gpQuelle, t.id, t.v, FARBE_AUFWAND)
      if (ka) kantenListe.push(ka)
    }
    if (ebit > 0) {
      const kEbit = knoten('ebit', 'EBIT', ebit, opexCol, FARBE_GEWINN, 'gewinn')
      if (kEbit) knotenListe.push(kEbit)
      const ka = kante(gpQuelle, 'ebit', ebit, FARBE_GEWINN)
      if (ka) kantenListe.push(ka)
    }
  } else if (gpQuelle && ebit > 0) {
    const kEbit = knoten('ebit', 'EBIT', ebit, offset + 2, FARBE_GEWINN, 'gewinn')
    if (kEbit) knotenListe.push(kEbit)
    const ka = kante(gpQuelle, 'ebit', ebit, FARBE_GEWINN)
    if (ka) kantenListe.push(ka)
  }

  const ebitQuelle = knotenListe.some((k) => k.id === 'ebit') ? 'ebit' : null
  if (ebitQuelle) {
    const lastCol = Math.max(...knotenListe.map((k) => k.spalte), 0) + 1
    if (restNachEbit > 0) {
      const kR = knoten('steuern', 'Zinsen & Steuern', restNachEbit, lastCol, FARBE_STEUERN, 'aufwand')
      if (kR) knotenListe.push(kR)
      const ka = kante('ebit', 'steuern', restNachEbit, FARBE_STEUERN)
      if (ka) kantenListe.push(ka)
    }
    if (netto > 0) {
      const kN = knoten('netto', 'Nettogewinn', netto, lastCol, FARBE_GEWINN, 'gewinn')
      if (kN) knotenListe.push(kN)
      const ka = kante('ebit', 'netto', Math.min(netto, ebit), FARBE_GEWINN)
      if (ka) kantenListe.push(ka)
    }
  }

  const ids = new Set(knotenListe.map((k) => k.id))
  const kantenOk = kantenListe.filter((k) => ids.has(k.von) && ids.has(k.nach))

  return {
    jahre: gewinnflussJahre(paket),
    knoten: knotenListe,
    kanten: kantenOk,
    hatSegmente: hatSegmenteQuelle,
    segmentArt: hatSegmenteQuelle ? segmentArt : null,
    umsatzMio: umsatz,
  }
}

export function knotenBeschriftung(k: GewinnflussKnoten): string {
  const name = k.art === 'segment' && k.label.length > 24 ? `${k.label.slice(0, 23)}…` : k.label
  return `${name} · ${fmtMio(k.wertMio)}`
}

export const GEWINNFLUSS_VIEW_W = 1120
export const GEWINNFLUSS_VIEW_H = 480

function ribbonPath(x0: number, y0: number, h0: number, x1: number, y1: number, h1: number): string {
  const mid = (x0 + x1) / 2
  const h0c = Math.max(1.5, h0)
  const h1c = Math.max(1.5, h1)
  return [
    `M ${x0} ${y0}`,
    `C ${mid} ${y0}, ${mid} ${y1}, ${x1} ${y1}`,
    `L ${x1} ${y1 + h1c}`,
    `C ${mid} ${y1 + h1c}, ${mid} ${y0 + h0c}, ${x0} ${y0 + h0c}`,
    'Z',
  ].join(' ')
}

export function layoutGewinnfluss(
  modell: GewinnflussModell,
  width = GEWINNFLUSS_VIEW_W,
  height = GEWINNFLUSS_VIEW_H,
): { knoten: GewinnflussLayoutKnoten[]; kanten: GewinnflussLayoutKante[] } {
  const padL = modell.hatSegmente ? 210 : 150
  const padR = 200
  const padY = 20
  const nodeW = 16
  const gapY = 5
  const spalten = [...new Set(modell.knoten.map((k) => k.spalte))].sort((a, b) => a - b)
  if (spalten.length === 0) return { knoten: [], kanten: [] }

  const innerW = Math.max(200, width - padL - padR - nodeW)
  const colGap = spalten.length > 1 ? innerW / (spalten.length - 1) : 0
  const innerH = Math.max(80, height - padY * 2)

  const colCounts = new Map<number, number>()
  const colSum = new Map<number, number>()
  for (const k of modell.knoten) {
    colCounts.set(k.spalte, (colCounts.get(k.spalte) ?? 0) + 1)
    colSum.set(k.spalte, (colSum.get(k.spalte) ?? 0) + k.wertMio)
  }
  const maxGaps = Math.max(0, ...[...colCounts.values()].map((n) => n - 1))
  const maxSum = Math.max(...colSum.values(), modell.umsatzMio, 1)
  const scale = (innerH - maxGaps * gapY) / maxSum

  const layoutKnoten: GewinnflussLayoutKnoten[] = []
  const byId = new Map<string, GewinnflussLayoutKnoten>()

  for (const sp of spalten) {
    const nodes = modell.knoten.filter((k) => k.spalte === sp)
    let y = padY
    const x = padL + (sp - spalten[0]!) * colGap
    for (const n of nodes) {
      const hoehe = Math.max(2, n.wertMio * scale)
      const lk: GewinnflussLayoutKnoten = { ...n, x, y, hoehe, breite: nodeW }
      layoutKnoten.push(lk)
      byId.set(n.id, lk)
      y += hoehe + gapY
    }
  }

  const srcUsed = new Map<string, number>()
  const tgtUsed = new Map<string, number>()
  const ordered = [...modell.kanten].sort((a, b) => {
    const sa = byId.get(a.von)?.y ?? 0
    const sb = byId.get(b.von)?.y ?? 0
    if (sa !== sb) return sa - sb
    return (byId.get(a.nach)?.y ?? 0) - (byId.get(b.nach)?.y ?? 0)
  })

  const layoutKanten: GewinnflussLayoutKante[] = []
  for (const k of ordered) {
    const src = byId.get(k.von)
    const tgt = byId.get(k.nach)
    if (!src || !tgt) continue
    const srcLeft = Math.max(0, src.hoehe - (srcUsed.get(src.id) ?? 0))
    const tgtLeft = Math.max(0, tgt.hoehe - (tgtUsed.get(tgt.id) ?? 0))
    const h0 = Math.min(Math.max(1.5, k.wertMio * scale), srcLeft || src.hoehe)
    const h1 = Math.min(Math.max(1.5, k.wertMio * scale), tgtLeft || tgt.hoehe)
    const y0 = src.y + (srcUsed.get(src.id) ?? 0)
    const y1 = tgt.y + (tgtUsed.get(tgt.id) ?? 0)
    srcUsed.set(src.id, (srcUsed.get(src.id) ?? 0) + h0)
    tgtUsed.set(tgt.id, (tgtUsed.get(tgt.id) ?? 0) + h1)
    layoutKanten.push({
      ...k,
      d: ribbonPath(src.x + src.breite, y0, h0, tgt.x, y1, h1),
    })
  }

  return { knoten: layoutKnoten, kanten: layoutKanten }
}
