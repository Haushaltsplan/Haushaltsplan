/**
 * Jahrescharts für das Zahlen-Kapitel. Nur abgeschlossene Geschäftsjahre und
 * Schätzjahre, die in der JSON schon eine Zahl haben. Nichts wird erfunden.
 */
import type { FundamentaldatenPaket, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { istFundamentalSchaetzungIso } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { pct, usd } from '@/lib/youtube/longform/longform-format'
import type {
  LongformEinheit,
  LongformJahreslinie,
  LongformJahrespunkt,
  LongformJahresreihe,
  LongformJahresreiheId,
} from '@/lib/youtube/longform/longform-types'

/** Unter einem Prozent gilt die Aktienzahl als unverändert. */
export const AKTIEN_STABIL_ANTEIL = 0.01

const MIN_JAHRE = 3

const QUELLE: Record<string, string> = {
  yahoo: 'Yahoo Finance',
  macrotrends: 'Macrotrends',
  sec: 'Company filings',
  marketscreener: 'MarketScreener',
  eu: 'Company filings',
}

const SCHAETZ: Record<string, string> = {
  stockanalysis: 'StockAnalysis',
  marketscreener: 'MarketScreener',
  wallstreet: 'Wall Street consensus',
  finnhub: 'Finnhub',
  yahoo: 'Yahoo Finance',
  kombiniert: 'consensus',
}

export type ReihenFakt = {
  id: string
  label: string
  wert: number | null
  text: string
  einheit: LongformEinheit
  quelle: string
}

type Punkt = LongformJahrespunkt

function jahrVonPeriode(p: FundamentalPeriode): { jahr: number; schaetzung: boolean } | null {
  if (p.istLtm || p.istNtm) return null
  if (/^__\d{4}q[1-4]e__$/.test(p.iso)) return null
  const isoJahr = p.iso.match(/^(\d{4})-\d{2}-\d{2}/)
  const schaetzung = Boolean(p.istSchaetzung) || istFundamentalSchaetzungIso(p.iso)
  if (isoJahr && !schaetzung) return { jahr: Number(isoJahr[1]), schaetzung: false }
  if (!schaetzung) return null
  const ausLabel = p.label.match(/FY(\d{2})E/i)
  if (ausLabel) return { jahr: 2000 + Number(ausLabel[1]), schaetzung: true }
  const ausIso = p.iso.match(/^__fy(\d{4})e__$/)
  if (ausIso) return { jahr: Number(ausIso[1]), schaetzung: true }
  return null
}

function quellenZeile(paket: FundamentaldatenPaket, hatSchaetzung: boolean): string {
  const basis = QUELLE[paket.guvQuelle ?? paket.quelle] ?? 'Company filings'
  if (!hatSchaetzung) return basis
  const name = paket.schaetzungQuelle ? SCHAETZ[paket.schaetzungQuelle] : null
  return name ? `${basis} · estimates ${name}` : basis
}

function metaAusSchluessel(iso: string, periode: FundamentalPeriode | undefined): { jahr: number; schaetzung: boolean } | null {
  if (periode) return jahrVonPeriode(periode)
  if (iso === '__ttm__' || iso === '__ntm__' || /^__\d{4}q[1-4]e__$/.test(iso)) return null
  if (istFundamentalSchaetzungIso(iso)) {
    const ausIso = iso.match(/^__fy(\d{4})e__$/)
    return ausIso ? { jahr: Number(ausIso[1]), schaetzung: true } : null
  }
  const isoJahr = iso.match(/^(\d{4})-\d{2}-\d{2}/)
  return isoJahr ? { jahr: Number(isoJahr[1]), schaetzung: false } : null
}

/** Ein Punkt je Jahr. Ist schlägt Schätzung, wenn beide dasselbe Jahr haben. */
function punkteAus(paket: FundamentaldatenPaket, zeileId: string, betrag = false): Punkt[] | null {
  const z = paket.zeilen.find((r) => r.id === zeileId)
  if (!z) return null
  const periodeNachIso = new Map(paket.perioden.map((p) => [p.iso, p]))
  const byJahr = new Map<number, { punkt: Punkt; iso: string }>()
  for (const iso of new Set([...periodeNachIso.keys(), ...Object.keys(z.werte)])) {
    const meta = metaAusSchluessel(iso, periodeNachIso.get(iso))
    if (!meta) continue
    const roh = z.werte[iso]
    if (roh == null || !Number.isFinite(roh)) continue
    const punkt: Punkt = { jahr: meta.jahr, wert: betrag ? Math.abs(roh) : roh, schaetzung: meta.schaetzung }
    const alt = byJahr.get(meta.jahr)
    if (!alt || (alt.punkt.schaetzung && !punkt.schaetzung) || (!punkt.schaetzung && !alt.punkt.schaetzung && iso > alt.iso)) {
      byJahr.set(meta.jahr, { punkt, iso })
    }
  }
  const punkte = [...byJahr.values()].map((x) => x.punkt).sort((a, b) => a.jahr - b.jahr)
  if (punkte.filter((p) => !p.schaetzung).length < MIN_JAHRE) return null
  return punkte
}

function ist(punkte: Punkt[]): Punkt[] {
  return punkte.filter((p) => !p.schaetzung)
}

function letzterIst(punkte: Punkt[]): Punkt | null {
  const fertig = ist(punkte)
  return fertig[fertig.length - 1] ?? null
}

function geldGross(punkte: Punkt[]) {
  const l = letzterIst(punkte)
  if (!l) return null
  return { text: usd(l.wert * 1_000_000), wert: l.wert, farbig: 'neutral' as const }
}

function hatSchaetzung(linien: LongformJahreslinie[]): boolean {
  return linien.some((l) => l.punkte.some((p) => p.schaetzung))
}

function reihe(
  id: LongformJahresreiheId,
  label: string,
  einheit: LongformJahresreihe['einheit'],
  art: LongformJahresreihe['art'],
  linien: LongformJahreslinie[],
  quelle: string,
  gross: LongformJahresreihe['gross'],
  wacc: number | null = null,
): LongformJahresreihe {
  return { id, label, einheit, art, linien, wacc, quelle, gross }
}

export function reihenAusZeilen(paket: FundamentaldatenPaket): LongformJahresreihe[] {
  const out: LongformJahresreihe[] = []

  const geld = (id: LongformJahresreiheId, label: string, zeileId: string, betrag = false) => {
    const punkte = punkteAus(paket, zeileId, betrag)
    if (!punkte) return
    const linien = [{ id, label, punkte }]
    out.push(reihe(id, label, 'usd', 'balken', linien, quellenZeile(paket, hatSchaetzung(linien)), geldGross(punkte)))
  }

  geld('umsatz', 'Revenue', 'umsatz')
  geld('gewinn', 'Net income', 'nettogewinn')
  geld('fcf', 'Free cash flow', 'fcf')

  const margen: { id: string; label: string; zeile: string }[] = [
    { id: 'brutto', label: 'Gross margin', zeile: 'bruttomarge' },
    { id: 'ebit', label: 'Operating margin', zeile: 'ebit_marge' },
    { id: 'netto', label: 'Net margin', zeile: 'nettomarge' },
  ]
  const margenLinien = margen.flatMap((m) => {
    const punkte = punkteAus(paket, m.zeile)
    return punkte ? [{ id: m.id, label: m.label, punkte }] : []
  })
  if (margenLinien.length) {
    out.push(reihe('marge', 'Margins', 'pct', 'linien', margenLinien, quellenZeile(paket, hatSchaetzung(margenLinien)), null))
  }

  const roi = punkteAus(paket, 'roi')
  const waccRoh = paket.keyMetrics.find((k) => k.id === 'wacc')?.zahl
  const wacc = waccRoh != null && Number.isFinite(waccRoh) ? waccRoh : null
  if (roi) {
    const l = letzterIst(roi)
    const linien = [{ id: 'roic', label: 'ROIC', punkte: roi }]
    out.push(
      reihe(
        'roic',
        'ROIC and WACC',
        'pct',
        'roic',
        linien,
        quellenZeile(paket, hatSchaetzung(linien)),
        l ? { text: pct(l.wert), wert: l.wert, farbig: 'vorzeichen' } : null,
        wacc,
      ),
    )
  }

  geld('capex', 'Capital spending', 'capex', true)

  const schuld = punkteAus(paket, 'gesamtverschuldung')
  const cash = punkteAus(paket, 'bargeld')
  if (schuld && cash) {
    const cashNachJahr = new Map(cash.map((p) => [p.jahr, p]))
    const gemeinsam = schuld.filter((p) => {
      const c = cashNachJahr.get(p.jahr)
      return c != null && c.schaetzung === p.schaetzung
    })
    const fertig = gemeinsam.filter((p) => !p.schaetzung && !cashNachJahr.get(p.jahr)!.schaetzung)
    if (fertig.length >= MIN_JAHRE) {
      const debtPunkte = gemeinsam.map((p) => {
        const c = cashNachJahr.get(p.jahr)!
        return { jahr: p.jahr, wert: p.wert, schaetzung: p.schaetzung || c.schaetzung }
      })
      const cashPunkte = gemeinsam.map((p) => {
        const c = cashNachJahr.get(p.jahr)!
        return { jahr: p.jahr, wert: c.wert, schaetzung: p.schaetzung || c.schaetzung }
      })
      const linien = [
        { id: 'schulden', label: 'Debt', punkte: debtPunkte },
        { id: 'bargeld', label: 'Cash', punkte: cashPunkte },
      ]
      const deckung = deckungVon(debtPunkte, cashPunkte)
      out.push(
        reihe(
          'schulden',
          'Debt and cash',
          'usd',
          'doppel',
          linien,
          quellenZeile(paket, hatSchaetzung(linien)),
          deckung ? { text: pct(deckung.pct), wert: deckung.pct, farbig: 'deckung' } : null,
        ),
      )
    }
  }

  const aktien = punkteAus(paket, 'aktien')
  if (aktien) {
    const linien = [{ id: 'aktien', label: 'Shares outstanding', punkte: aktien }]
    const a = aktienAenderung(aktien)
    out.push(
      reihe(
        'aktien',
        'Shares outstanding',
        'aktien',
        'linien',
        linien,
        quellenZeile(paket, hatSchaetzung(linien)),
        a ? { text: a.gross, wert: a.deltaMio, farbig: 'hell' } : null,
      ),
    )
  }

  return out
}

function deckungVon(debt: Punkt[], cash: Punkt[]): { jahr: number; pct: number } | null {
  const cashNachJahr = new Map(cash.map((p) => [p.jahr, p]))
  const fertig = ist(debt).filter((p) => {
    const c = cashNachJahr.get(p.jahr)
    return c && !c.schaetzung && p.wert > 0
  })
  const l = fertig[fertig.length - 1]
  const c = l ? cashNachJahr.get(l.jahr) : null
  if (!l || !c) return null
  return { jahr: l.jahr, pct: Math.round((c.wert / l.wert) * 1000) / 10 }
}

function mio(n: number): string {
  const abs = Math.abs(n)
  const gerundet = abs >= 100 ? Math.round(abs) : Math.round(abs * 10) / 10
  return `${n < 0 ? '-' : ''}${gerundet.toLocaleString('en-US')} million`
}

export function aktienAenderung(punkte: Punkt[]): { deltaMio: number; gross: string; label: string; text: string } | null {
  const fertig = ist(punkte)
  const erster = fertig[0]
  const letzter = fertig[fertig.length - 1]
  if (!erster || !letzter || erster.jahr === letzter.jahr) return null
  const delta = Math.round((letzter.wert - erster.wert) * 10) / 10
  const basis = Math.abs(erster.wert)
  const stabil = basis > 0 && Math.abs(delta) / basis < AKTIEN_STABIL_ANTEIL
  if (stabil) {
    return {
      deltaMio: delta,
      gross: 'flat',
      label: 'Share count roughly unchanged. Each share is about the same slice.',
      text: `roughly unchanged, from ${mio(erster.wert)} to ${mio(letzter.wert)}`,
    }
  }
  if (delta > 0) {
    return {
      deltaMio: delta,
      gross: `+${mio(delta)}`,
      label: 'Share count rose. Each existing share is a smaller slice of the company.',
      text: `rose by ${mio(delta)}`,
    }
  }
  return {
    deltaMio: delta,
    gross: mio(delta),
    label: 'Share count fell. Each existing share is a larger slice of the company.',
    text: `fell by ${mio(Math.abs(delta))}`,
  }
}

function geldText(mioWert: number): { wert: number; text: string } {
  return { wert: mioWert * 1_000_000, text: usd(mioWert * 1_000_000) }
}

function faktenEinerLinie(
  prefix: string,
  name: string,
  einheit: 'usd' | 'pct' | 'aktien',
  punkte: Punkt[],
  quelle: string,
  vorzeichen = false,
): ReihenFakt[] {
  const fertig = ist(punkte)
  const erster = fertig[0]
  const letzter = fertig[fertig.length - 1]
  if (!erster || !letzter) return []
  const tief = fertig.reduce((m, p) => (p.wert < m.wert ? p : m), fertig[0]!)
  const hoch = fertig.reduce((m, p) => (p.wert > m.wert ? p : m), fertig[0]!)
  const out: ReihenFakt[] = []
  const push = (id: string, label: string, p: Punkt) => {
    if (einheit === 'usd') {
      const g = geldText(p.wert)
      out.push({ id, label, wert: g.wert, text: g.text, einheit: 'usd', quelle })
    } else if (einheit === 'pct') {
      out.push({ id, label, wert: p.wert, text: pct(p.wert, { vorzeichen }), einheit: 'pct', quelle })
    } else {
      out.push({ id, label, wert: p.wert, text: mio(p.wert), einheit: 'zahl', quelle })
    }
  }
  push(prefix, `${name}, last finished year ${letzter.jahr}`, letzter)
  push(`${prefix}.anfang`, `${name}, first year ${erster.jahr}`, erster)
  out.push({ id: `${prefix}.anfang_jahr`, label: `${name}, first year`, wert: null, text: String(erster.jahr), einheit: 'text', quelle })
  out.push({ id: `${prefix}.ende_jahr`, label: `${name}, last finished year`, wert: null, text: String(letzter.jahr), einheit: 'text', quelle })
  push(`${prefix}.tief`, `${name}, low, ${tief.jahr}`, tief)
  push(`${prefix}.hoch`, `${name}, high, ${hoch.jahr}`, hoch)
  for (const e of punkte.filter((p) => p.schaetzung)) {
    push(`${prefix}.e.${e.jahr}`, `${name}, ${e.jahr} estimate`, e)
  }
  return out
}

export function faktenAusReihen(reihen: LongformJahresreihe[], paket: FundamentaldatenPaket): ReihenFakt[] {
  const out: ReihenFakt[] = []
  for (const reihe of reihen) {
    const q = reihe.quelle
    if (reihe.id === 'marge') {
      for (const linie of reihe.linien) {
        out.push(...faktenEinerLinie(`reihe.marge.${linie.id}`, linie.label, 'pct', linie.punkte, q))
      }
      const ebit = reihe.linien.find((l) => l.id === 'ebit')
      const letzte = ebit ? letzterIst(ebit.punkte) : null
      if (letzte) {
        out.push({
          id: 'reihe.marge',
          label: `Operating margin, last finished year ${letzte.jahr}`,
          wert: letzte.wert,
          text: pct(letzte.wert),
          einheit: 'pct',
          quelle: q,
        })
      }
      continue
    }
    if (reihe.id === 'schulden') {
      const debt = reihe.linien.find((l) => l.id === 'schulden')
      const cash = reihe.linien.find((l) => l.id === 'bargeld')
      if (debt) out.push(...faktenEinerLinie('reihe.schulden', 'Debt', 'usd', debt.punkte, q))
      if (cash) out.push(...faktenEinerLinie('reihe.schulden.bargeld', 'Cash and equivalents', 'usd', cash.punkte, q))
      if (debt && cash) {
        const d = deckungVon(debt.punkte, cash.punkte)
        if (d) {
          out.push({
            id: 'reihe.schulden.deckung',
            label:
              d.pct >= 100
                ? `Cash covers the debt in ${d.jahr}. Cash and equivalents only, not factories or securities.`
                : `Cash does not cover the debt in ${d.jahr}. Cash and equivalents only, not factories or securities.`,
            wert: d.pct,
            text: pct(d.pct),
            einheit: 'pct',
            quelle: q,
          })
        }
      }
      continue
    }
    if (reihe.id === 'aktien') {
      const linie = reihe.linien[0]
      if (!linie) continue
      out.push(...faktenEinerLinie('reihe.aktien', 'Shares outstanding', 'aktien', linie.punkte, q))
      const a = aktienAenderung(linie.punkte)
      if (a) {
        out.push({ id: 'reihe.aktien.aenderung', label: a.label, wert: a.deltaMio, text: a.text, einheit: 'zahl', quelle: q })
      }
      continue
    }
    if (reihe.id === 'roic') {
      const linie = reihe.linien[0]
      if (!linie) continue
      out.push(...faktenEinerLinie('reihe.roic', 'ROIC', 'pct', linie.punkte, q))
      if (reihe.wacc != null) {
        out.push({
          id: 'reihe.roic.wacc',
          label: 'WACC, one current estimate of what the capital costs. Not a yearly history.',
          wert: reihe.wacc,
          text: pct(reihe.wacc),
          einheit: 'pct',
          quelle: 'keyMetrics.wacc, current CAPM estimate',
        })
        const spreads = linie.punkte.map((p) => ({
          jahr: p.jahr,
          wert: Math.round((p.wert - reihe.wacc!) * 10) / 10,
          schaetzung: p.schaetzung,
        }))
        out.push(
          ...faktenEinerLinie(
            'reihe.roic.spread',
            'Value spread, that year\'s ROIC minus the current WACC',
            'pct',
            spreads,
            'ROIC of that year minus keyMetrics.wacc',
            true,
          ),
        )
      }
      const ltm = paket.keyMetrics.find((k) => k.id === 'ltm_value_spread')?.zahl
      if (ltm != null && Number.isFinite(ltm)) {
        out.push({
          id: 'reihe.roic.spread.ltm',
          label: 'Latest published value spread. The current figure, not one year of the chart.',
          wert: ltm,
          text: pct(ltm, { vorzeichen: true }),
          einheit: 'pct',
          quelle: 'keyMetrics.ltm_value_spread',
        })
      }
      continue
    }
    const linie = reihe.linien[0]
    if (!linie) continue
    out.push(...faktenEinerLinie(`reihe.${reihe.id}`, reihe.label, 'usd', linie.punkte, q))
  }
  return out
}
