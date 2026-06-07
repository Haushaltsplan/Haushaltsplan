import {
  INVESTMENT_MANTRA,
  SEKTOR_MANTRAS,
  type MantraZeile,
} from '@/lib/investment-mantra-data'
import { cagrProzent, formatFundamentalWert } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import type { YahooFundamentalKennzahlen } from '@/lib/portfolio-analyse/fundamentaldaten-key-metrics'
import type { FundamentalSchaetzungenRoh } from '@/lib/portfolio-analyse/fundamentaldaten-schaetzungen-server'
import type {
  FundamentalMantraAudit,
  FundamentalMetrikZeile,
  FundamentalPeriode,
  MantraAuditErgebnis,
  MantraAuditStatus,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { FUNDAMENTAL_TTM_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type { MacrotrendsFundamentalRoh } from '@/lib/portfolio-analyse/macrotrends-scraper-server'

type MantraKontext = {
  yahoo: YahooFundamentalKennzahlen | null
  roh: MacrotrendsFundamentalRoh | null
  schaetzungen: FundamentalSchaetzungenRoh
}

function wertAnPeriode(z: FundamentalMetrikZeile | undefined, key: string): number | null {
  return z?.werte[key] ?? null
}

function letzterGeschaeftsjahresKey(perioden: FundamentalPeriode[] | undefined): string | null {
  const keys = perioden?.filter((p) => !p.istLtm && !p.istSchaetzung).map((p) => p.iso) ?? []
  return keys.length > 0 ? keys[keys.length - 1]! : null
}

function letzterGeschaeftsjahresWert(
  zeile: FundamentalMetrikZeile | undefined,
  perioden: FundamentalPeriode[] | undefined,
): number | null {
  if (!zeile) return null
  const ttm = zeile.werte[FUNDAMENTAL_TTM_KEY]
  if (ttm != null) return ttm
  const lastKey = letzterGeschaeftsjahresKey(perioden)
  return lastKey ? wertAnPeriode(zeile, lastKey) : null
}

function historischeWerte(
  zeile: FundamentalMetrikZeile | undefined,
  perioden: FundamentalPeriode[] | undefined,
): number[] {
  const keys = perioden?.filter((p) => !p.istLtm && !p.istSchaetzung).map((p) => p.iso) ?? []
  return keys.map((k) => zeile?.werte[k]).filter((v): v is number => v != null)
}

function berechneMargePct(zaehler: number | null, nenner: number | null): number | null {
  if (zaehler == null || nenner == null || nenner === 0) return null
  return (zaehler / nenner) * 100
}

function pct(v: number | null | undefined): string {
  return v != null && Number.isFinite(v) ? formatFundamentalWert(v, 'prozent') : '–'
}

function mult(v: number | null | undefined): string {
  return v != null && Number.isFinite(v) ? formatFundamentalWert(v, 'multiple') : '–'
}

function keineDaten(hinweis?: string) {
  return { istWert: null as string | null, status: 'keine_daten' as MantraAuditStatus, hinweis }
}

function erfuellt(istWert: string, numerisch?: number | null, hinweis?: string) {
  return { istWert, status: 'erfuellt' as MantraAuditStatus, numerisch: numerisch ?? null, hinweis }
}

function nichtErfuellt(istWert: string, numerisch?: number | null, hinweis?: string) {
  return { istWert, status: 'nicht_erfuellt' as MantraAuditStatus, numerisch: numerisch ?? null, hinweis }
}

function qualitativ(istWert: string | null, status: MantraAuditStatus, hinweis?: string) {
  return { istWert, status, hinweis }
}

function baueKontextWerte(ctx: MantraKontext) {
  const perioden = ctx.roh?.perioden
  const zeile = (id: string) => ctx.roh?.zeilen.find((z) => z.id === id)

  const umsatzZeile = zeile('umsatz')
  const bruttoGewinnZeile = zeile('bruttogewinn')
  const bruttoMargeZeile = zeile('bruttomarge')
  const ebitZeile = zeile('ebit')
  const ebitMargeZeile = zeile('ebit_marge')
  const ebitdaZeile = zeile('ebitda')
  const ebitdaMargeZeile = zeile('ebitda_marge')
  const nettoZeile = zeile('nettogewinn')
  const epsZeile = zeile('eps')
  const fcfZeile = zeile('fcf')
  const capexZeile = zeile('capex')
  const roiZeile = zeile('roi')
  const roeZeile = zeile('roe')
  const kapitalumschlagZeile = zeile('kapitalumschlag')
  const aktienZeile = zeile('aktien')

  const umsatzMio = letzterGeschaeftsjahresWert(umsatzZeile, perioden)
  const fcfMio = letzterGeschaeftsjahresWert(fcfZeile, perioden)
  const nettoMio = letzterGeschaeftsjahresWert(nettoZeile, perioden)
  const capexMio = letzterGeschaeftsjahresWert(capexZeile, perioden)
  const ebitdaMio = letzterGeschaeftsjahresWert(ebitdaZeile, perioden)

  const bruttoMarge =
    letzterGeschaeftsjahresWert(bruttoMargeZeile, perioden) ??
    berechneMargePct(letzterGeschaeftsjahresWert(bruttoGewinnZeile, perioden), umsatzMio) ??
    (ctx.yahoo?.grossMargins != null ? ctx.yahoo.grossMargins * 100 : null)

  const ebitMarge =
    letzterGeschaeftsjahresWert(ebitMargeZeile, perioden) ??
    berechneMargePct(letzterGeschaeftsjahresWert(ebitZeile, perioden), umsatzMio) ??
    (ctx.yahoo?.operatingMargins != null ? ctx.yahoo.operatingMargins * 100 : null)

  const ebitdaMarge =
    letzterGeschaeftsjahresWert(ebitdaMargeZeile, perioden) ??
    berechneMargePct(ebitdaMio, umsatzMio) ??
    (ctx.yahoo?.ebitdaMargins != null ? ctx.yahoo.ebitdaMargins * 100 : null)

  const fcfMarge = berechneMargePct(fcfMio, umsatzMio)
  const capexSales =
    umsatzMio != null && capexMio != null && umsatzMio > 0 ? (Math.abs(capexMio) / umsatzMio) * 100 : null
  const fcfConversion =
    nettoMio != null && fcfMio != null && nettoMio > 0 ? (fcfMio / nettoMio) * 100 : null

  const roic = letzterGeschaeftsjahresWert(roiZeile, perioden)
  const roe =
    letzterGeschaeftsjahresWert(roeZeile, perioden) ??
    (ctx.yahoo?.returnOnEquity != null ? ctx.yahoo.returnOnEquity * 100 : null)

  const netDebt =
    ctx.yahoo?.totalDebt != null && ctx.yahoo?.totalCash != null
      ? ctx.yahoo.totalDebt - ctx.yahoo.totalCash
      : null
  const netDebtEbitda =
    netDebt != null && ebitdaMio != null && ebitdaMio > 0 ? netDebt / (ebitdaMio * 1_000_000) : null

  const umsatzHist = historischeWerte(umsatzZeile, perioden)
  const epsHist = historischeWerte(epsZeile, perioden)
  const ebitMargeHist = historischeWerte(ebitMargeZeile, perioden)
  const aktienHist = historischeWerte(aktienZeile, perioden)

  const umsatzCagr3 =
    umsatzHist.length >= 2 ? cagrProzent(umsatzHist.slice(-4), Math.min(3, umsatzHist.length - 1)) : null
  const epsCagr3 = epsHist.length >= 2 ? cagrProzent(epsHist.slice(-4), Math.min(3, epsHist.length - 1)) : null

  const revGrowthPct =
    ctx.yahoo?.revenueGrowth != null ? ctx.yahoo.revenueGrowth * 100 : umsatzCagr3

  const ruleOf40 =
    revGrowthPct != null && fcfMarge != null ? revGrowthPct + fcfMarge : null

  const assetTurnover = letzterGeschaeftsjahresWert(kapitalumschlagZeile, perioden)

  const payoutPct = ctx.yahoo?.payoutRatio != null ? ctx.yahoo.payoutRatio * 100 : null
  const pb = ctx.yahoo?.priceToBook ?? null

  const aktienSinkend =
    aktienHist.length >= 2 ? aktienHist[aktienHist.length - 1]! < aktienHist[0]! : null

  return {
    bruttoMarge,
    ebitMarge,
    ebitdaMarge,
    fcfMarge,
    capexSales,
    fcfConversion,
    roic,
    roe,
    netDebt,
    netDebtEbitda,
    umsatzCagr3,
    epsCagr3,
    revGrowthPct,
    ruleOf40,
    assetTurnover,
    payoutPct,
    pb,
    aktienSinkend,
    ebitMargeHist,
    bruttoMargeHist: historischeWerte(bruttoMargeZeile, perioden),
  }
}

export function waehleSektorMantraId(sektor: string | null, branche: string | null): string | null {
  const text = `${sektor ?? ''} ${branche ?? ''}`.toLowerCase()

  if (/reit|immobilien|real estate/.test(text)) return 'reits'

  if (
    /finanz|financial|bank|versicher|insurance|kredit|credit service|kapitalmark|vermögensverwaltung|asset management|börse|exchange/.test(
      text,
    )
  ) {
    return 'financial-services'
  }

  if (/gesundheit|health|pharma|biotech|medizin|medical|diagnostik|drug|pharmazeut/.test(text)) {
    return 'healthcare'
  }

  if (/software|saas|internet|cloud|it-dienst|information technology|anwendung|infrastruktur/.test(text)) {
    return 'software-saas'
  }

  if (
    /industrie|industrial|manufacturing|maschinen|automobil|automotive|engineering|aerospace|defense|verteidigung|luft-.*raumfahrt|construction|bauwesen|elektrotechnik|zulieferer/.test(
      text,
    )
  ) {
    return 'industrials'
  }

  if (/technologie|technology/.test(text) && !/hardware|semiconductor|halbleiter|chip/.test(text)) {
    return 'software-saas'
  }

  return null
}

function evaluiereZeile(zeile: MantraZeile, ctx: MantraKontext, w: ReturnType<typeof baueKontextWerte>): {
  istWert: string | null
  status: MantraAuditStatus
  hinweis?: string
} {
  const k = zeile.kennzahl.toLowerCase()

  if (k.includes('roic') && k.includes('ltm')) {
    if (w.roic == null) return keineDaten()
    return w.roic >= 15 ? erfuellt(pct(w.roic), w.roic) : nichtErfuellt(pct(w.roic), w.roic)
  }

  if (k.includes('value spread') || k.includes('incremental roic')) {
    return keineDaten('ROIC/WACC-Spread und Incremental ROIC sind ohne WACC bzw. Investitionsdaten nicht verfügbar.')
  }

  if (k.includes('gross margin')) {
    if (w.bruttoMarge == null) return keineDaten()
    const min = zeile.zielwert.includes('70') ? 70 : 40
    return w.bruttoMarge >= min
      ? erfuellt(pct(w.bruttoMarge), w.bruttoMarge)
      : nichtErfuellt(pct(w.bruttoMarge), w.bruttoMarge)
  }

  if (k.includes('sbc-adj') && k.includes('fcf margin')) {
    if (w.fcfMarge == null) return keineDaten()
    return w.fcfMarge >= 10
      ? erfuellt(pct(w.fcfMarge), w.fcfMarge, 'FCF-Marge ohne SBC-Korrektur (Proxy)')
      : nichtErfuellt(pct(w.fcfMarge), w.fcfMarge, 'FCF-Marge ohne SBC-Korrektur (Proxy)')
  }

  if (k.includes('organic rev') || k.includes('organisches umsatz')) {
    const v = w.umsatzCagr3 ?? w.revGrowthPct
    if (v == null) return keineDaten()
    const min = zeile.zielwert.includes('5') && !zeile.zielwert.includes('15') ? 5 : 7
    return v >= min ? erfuellt(pct(v), v) : nichtErfuellt(pct(v), v)
  }

  if (k.includes('eps cagr')) {
    if (w.epsCagr3 == null) return keineDaten()
    const ok = w.epsCagr3 >= 10
    const leverage =
      w.umsatzCagr3 != null && w.epsCagr3 > w.umsatzCagr3 ? ' EPS wächst schneller als Umsatz.' : ''
    return ok
      ? erfuellt(pct(w.epsCagr3), w.epsCagr3, leverage || undefined)
      : nichtErfuellt(pct(w.epsCagr3), w.epsCagr3, leverage || undefined)
  }

  if (k.includes('cash conversion cycle')) {
    return keineDaten('Cash Conversion Cycle ist in Macrotrends/Yahoo nicht enthalten.')
  }

  if (k.includes('fcf conversion')) {
    if (w.fcfConversion == null) return keineDaten()
    const min = zeile.zielwert.includes('80') ? 80 : 90
    const proxy = zeile.zielwert.includes('sbc') ? ' Net Income/FCF ohne SBC-Korrektur (Proxy).' : undefined
    return w.fcfConversion >= min
      ? erfuellt(pct(w.fcfConversion), w.fcfConversion, proxy)
      : nichtErfuellt(pct(w.fcfConversion), w.fcfConversion, proxy)
  }

  if (k.includes('capex') && k.includes('sales')) {
    if (w.capexSales == null) return keineDaten()
    const max = zeile.zielwert.includes('3') ? 3 : 5
    const proxy = k.includes('maintenance') ? ' Gesamt-Capex als Obergrenze (Maintenance nicht separiert).' : undefined
    return w.capexSales < max
      ? erfuellt(pct(w.capexSales), w.capexSales, proxy)
      : nichtErfuellt(pct(w.capexSales), w.capexSales, proxy)
  }

  if (k.includes('sbc') && k.includes('fcf')) {
    return keineDaten('Stock-Based Compensation ist in den Fundamentaldaten nicht enthalten.')
  }

  if (k.includes('net debt') && k.includes('ebitda')) {
    if (w.netDebtEbitda == null) return keineDaten()
    const max = zeile.zielwert.includes('6') ? 6 : zeile.zielwert.includes('1,5') || zeile.zielwert.includes('1.5') ? 1.5 : 2
    return w.netDebtEbitda < max
      ? erfuellt(mult(w.netDebtEbitda), w.netDebtEbitda)
      : nichtErfuellt(mult(w.netDebtEbitda), w.netDebtEbitda)
  }

  if (k.includes('interest coverage')) {
    return keineDaten('Interest Coverage ist in den Fundamentaldaten nicht enthalten.')
  }

  if (k.includes('buyback yield')) {
    if (w.aktienSinkend == null) return keineDaten()
    return w.aktienSinkend
      ? erfuellt('Sinkende Aktienanzahl', null, 'Trend über verfügbare Geschäftsjahre.')
      : nichtErfuellt('Steigende/stabile Aktienanzahl', null, 'Trend über verfügbare Geschäftsjahre.')
  }

  if (k.includes('rule of 40')) {
    if (w.ruleOf40 == null) return keineDaten()
    return w.ruleOf40 >= 40
      ? erfuellt(pct(w.ruleOf40), w.ruleOf40, 'Umsatzwachstum + FCF-Marge (LTM).')
      : nichtErfuellt(pct(w.ruleOf40), w.ruleOf40, 'Umsatzwachstum + FCF-Marge (LTM).')
  }

  if (k.includes('net revenue retention') || k.includes('magic number') || k.includes('rpo growth') || k.includes('cac payback')) {
    return keineDaten('SaaS-spezifische Kennzahl — nur im Geschäftsbericht verfügbar.')
  }

  if (k.includes('net cash position')) {
    if (w.netDebt == null) return keineDaten()
    return w.netDebt < 0
      ? erfuellt(formatFundamentalWert(Math.abs(w.netDebt), 'waehrung_usd') + ' Netto-Cash', w.netDebt)
      : nichtErfuellt(formatFundamentalWert(w.netDebt, 'waehrung_usd') + ' Netto-Schulden', w.netDebt)
  }

  if (k.includes('roic') && k.includes('wacc')) {
    if (w.roic == null) return keineDaten()
    return w.roic >= 20
      ? qualitativ(pct(w.roic), 'qualitativ', 'WACC nicht verfügbar — ROIC ≥20% als Proxy für positiven Spread.')
      : qualitativ(pct(w.roic), 'qualitativ', 'WACC nicht verfügbar — ROIC unter 20%, Spread unklar.')
  }

  if (k.includes('operating margin') && zeile.zielwert.toLowerCase().includes('stabil')) {
    if (w.ebitMargeHist.length < 3) return keineDaten('Zu wenige historische EBIT-Margen.')
    const min = Math.min(...w.ebitMargeHist)
    const max = Math.max(...w.ebitMargeHist)
    const spanne = max - min
    const stabil = spanne <= 8 && min > 0
    return qualitativ(
      `${pct(w.ebitMarge)} (Spanne ${pct(spanne)})`,
      stabil ? 'erfuellt' : 'qualitativ',
      'Schwankung der EBIT-Marge über verfügbare Jahre.',
    )
  }

  if (k.includes('book-to-bill')) {
    return keineDaten('Book-to-Bill ist in den Fundamentaldaten nicht enthalten.')
  }

  if (k.includes('asset turnover')) {
    if (w.assetTurnover == null) return keineDaten()
    return w.assetTurnover > 1.2
      ? erfuellt(mult(w.assetTurnover), w.assetTurnover)
      : nichtErfuellt(mult(w.assetTurnover), w.assetTurnover)
  }

  if (k.includes('incremental margins')) {
    if (w.bruttoMarge == null || w.ebitMarge == null) return keineDaten()
    return w.ebitMarge > w.bruttoMarge
      ? qualitativ(`${pct(w.ebitMarge)} vs. Roh ${pct(w.bruttoMarge)}`, 'qualitativ', 'EBIT-Marge vs. Bruttomarge als Proxy.')
      : qualitativ(`${pct(w.ebitMarge)} vs. Roh ${pct(w.bruttoMarge)}`, 'qualitativ', 'EBIT-Marge vs. Bruttomarge als Proxy.')
  }

  if (k.includes('dividend payout')) {
    if (w.payoutPct == null) return keineDaten()
    const inRange = w.payoutPct >= 30 && w.payoutPct <= 50
    return inRange
      ? erfuellt(pct(w.payoutPct), w.payoutPct)
      : nichtErfuellt(pct(w.payoutPct), w.payoutPct)
  }

  if (k.includes('roe')) {
    if (w.roe == null) return keineDaten()
    return w.roe >= 15 ? erfuellt(pct(w.roe), w.roe) : nichtErfuellt(pct(w.roe), w.roe)
  }

  if (k.includes('net interest margin') || k.includes('cost-to-income') || k.includes('cet1') || k.includes('npl') || k.includes('loan growth')) {
    return keineDaten('Bank-/Versicherungskennzahl — nur im Geschäftsbericht verfügbar.')
  }

  if (k.includes('total payout')) {
    if (w.payoutPct == null) return keineDaten('Nur Dividenden-Payout verfügbar (Buybacks nicht separiert).')
    return w.payoutPct > 60
      ? erfuellt(pct(w.payoutPct), w.payoutPct, 'Nur Dividenden-Ausschüttungsquote als Proxy.')
      : nichtErfuellt(pct(w.payoutPct), w.payoutPct, 'Nur Dividenden-Ausschüttungsquote als Proxy.')
  }

  if (k.includes('p/tbv') || k.includes('price / tang')) {
    if (w.pb == null) return keineDaten()
    return w.pb < 1.5 ? erfuellt(mult(w.pb), w.pb, 'KBV (P/B) als Proxy für P/TBV.') : nichtErfuellt(mult(w.pb), w.pb, 'KBV (P/B) als Proxy für P/TBV.')
  }

  if (k.includes('ebitda marge')) {
    if (w.ebitdaMarge == null) return keineDaten()
    return w.ebitdaMarge > 30 ? erfuellt(pct(w.ebitdaMarge), w.ebitdaMarge) : nichtErfuellt(pct(w.ebitdaMarge), w.ebitdaMarge)
  }

  if (k.includes('r&d / sales') || k.includes('pipeline replacement') || k.includes('sg&a / sales')) {
    return keineDaten('Pharma-spezifische Kennzahl — nur im Geschäftsbericht verfügbar.')
  }

  if (k.includes('fcf marge')) {
    if (w.fcfMarge == null) return keineDaten()
    return w.fcfMarge > 20 ? erfuellt(pct(w.fcfMarge), w.fcfMarge) : nichtErfuellt(pct(w.fcfMarge), w.fcfMarge)
  }

  if (
    k.includes('affo') ||
    k.includes('occupancy') ||
    k.includes('same-store') ||
    k.includes('ebitdare') ||
    k.includes('debt maturity')
  ) {
    return keineDaten('REIT-spezifische Kennzahl — nur im Geschäftsbericht verfügbar.')
  }

  return keineDaten('Keine Zuordnung zu verfügbaren Fundamentaldaten.')
}

function auditZeilen(zeilen: readonly MantraZeile[], ctx: MantraKontext): MantraAuditErgebnis[] {
  const w = baueKontextWerte(ctx)
  return zeilen.map((z) => {
    const { istWert, status, hinweis } = evaluiereZeile(z, ctx, w)
    return {
      kategorie: z.kategorie,
      kennzahl: z.kennzahl,
      zielwert: z.zielwert,
      funktion: z.funktion,
      istWert,
      status,
      hinweis,
    }
  })
}

function zusammenfassung(zeilen: MantraAuditErgebnis[]) {
  return {
    erfuellt: zeilen.filter((z) => z.status === 'erfuellt').length,
    nichtErfuellt: zeilen.filter((z) => z.status === 'nicht_erfuellt').length,
    keineDaten: zeilen.filter((z) => z.status === 'keine_daten').length,
    qualitativ: zeilen.filter((z) => z.status === 'qualitativ').length,
    bewertbar: zeilen.filter((z) => z.status === 'erfuellt' || z.status === 'nicht_erfuellt').length,
  }
}

export function baueMantraAudit(
  sektor: string | null,
  branche: string | null,
  yahoo: YahooFundamentalKennzahlen | null,
  roh: MacrotrendsFundamentalRoh | null,
  schaetzungen: FundamentalSchaetzungenRoh,
): FundamentalMantraAudit {
  const ctx: MantraKontext = { yahoo, roh, schaetzungen }
  const sektorMantraId = waehleSektorMantraId(sektor, branche)
  const sektorBlock = sektorMantraId ? SEKTOR_MANTRAS.find((b) => b.id === sektorMantraId) ?? null : null

  const standard = auditZeilen(INVESTMENT_MANTRA, ctx)
  const sektorZeilen = sektorBlock ? auditZeilen(sektorBlock.zeilen, ctx) : []

  const alle = [...standard, ...sektorZeilen]
  const sum = zusammenfassung(alle)

  return {
    sektorMantraId,
    sektorMantraTitel: sektorBlock?.title ?? null,
    sektorMantraIntro: sektorBlock?.intro ?? null,
    standard,
    sektor: sektorZeilen,
    zusammenfassung: sum,
  }
}
