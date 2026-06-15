import {
  INVESTMENT_MANTRA,
  MOAT_CHECK,
  MOAT_CHECK_PLATTFORM_ZUSATZ,
  QUALITY_INVESTING_ANKER,
  QUALITY_INVESTING_FRAMEWORK_TITEL,
  QUALITY_INVESTING_FRAMEWORK_UNTERTITEL,
  SELL_TRIGGERS,
  SELL_TRIGGERS_HINWEIS,
  type MantraZeile,
  type MoatPfeiler,
  type SellTrigger,
} from '@/lib/investment-mantra-data'
import { formatFundamentalWert } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import {
  baueKontextWerte,
  type FundamentalKontextInput,
  type FundamentalKontextWerte,
} from '@/lib/portfolio-analyse/fundamentaldaten-kontext-werte'
import type { YahooFundamentalKennzahlen } from '@/lib/portfolio-analyse/fundamentaldaten-key-metrics'
import type { FundamentalSchaetzungenRoh } from '@/lib/portfolio-analyse/fundamentaldaten-schaetzungen-server'
import type {
  FundamentalMantraAudit,
  MantraAuditErgebnis,
  MantraAuditStatus,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type { MacrotrendsFundamentalRoh } from '@/lib/portfolio-analyse/macrotrends-scraper-server'
import type { MantraYahooFinanzdaten } from '@/lib/portfolio-analyse/yahoo-fundamentals-timeseries-server'

type MantraRohdaten = Pick<MacrotrendsFundamentalRoh, 'perioden' | 'zeilen'> | null
type MantraKontext = FundamentalKontextInput

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

/** @deprecated Sektor-Mantras durch universelles Framework ersetzt. */
export function waehleSektorMantraId(_sektor: string | null, _branche: string | null): string | null {
  return null
}

function evaluiereRoicAdjustiert(w: FundamentalKontextWerte) {
  const roic = w.roicAdjustiert ?? w.roic
  const hist = w.roicAdjustiertHist.length > 0 ? w.roicAdjustiertHist : w.roicHist
  const quelle =
    w.roicAdjustiertQuelle ??
    (w.roicAdjustiert == null && w.roic != null ? 'Fallback: unadjustierter ROIC (Macrotrends)' : null)
  const quelleSuffix = quelle ? ` ${quelle}.` : ''

  const steigend = w.roicAdjustiertSteigend ?? w.roicSteigend
  const konstantHoch = w.roicAdjustiertKonstantHoch ?? w.roicKonstantHoch

  if (roic == null && hist.length === 0) {
    return keineDaten(
      'ROIC adjustiert: OCF/CapEx (Macrotrends) und Bilanz (Yahoo) werden benötigt.',
    )
  }

  if (konstantHoch || (roic != null && roic >= 15)) {
    return erfuellt(
      roic != null ? pct(roic) : 'Historisch >15 %',
      roic,
      `Adjustierter ROIC (OCF − Erhaltungs-CapEx, IC ex Goodwill).${quelleSuffix} Etabliert: konstant hoch.`,
    )
  }

  if (w.istWachstumsfirma && steigend && roic != null) {
    return qualitativ(
      pct(roic),
      'erfuellt',
      `Adjustierter ROIC.${quelleSuffix} Wachstumsfirma: steigende Kurve.`,
    )
  }

  if (roic != null) {
    return nichtErfuellt(pct(roic), roic, `Adjustierter ROIC.${quelleSuffix}`)
  }

  return keineDaten(`Adjustierter ROIC nicht berechenbar.${quelleSuffix}`)
}

function evaluiereLtvCac(w: FundamentalKontextWerte) {
  const quelleLabel =
    w.ltvCacQuelle === 'earnings_call'
      ? 'Earnings Call'
      : w.ltvCacQuelle === 'sec_10q'
        ? 'SEC 10-Q'
        : w.ltvCacQuelle === 'sec_10k'
          ? 'SEC 10-K'
          : null

  if (w.ltvCac != null) {
    const basis = quelleLabel ? `${quelleLabel}${w.ltvCacPeriode ? ` (${w.ltvCacPeriode})` : ''}` : 'Primärquelle'
    const hinweis = [w.ltvCacHinweis, basis].filter(Boolean).join(' · ')
    const ist = `${w.ltvCac.toLocaleString('de-DE', { maximumFractionDigits: 1 })}×`
    return w.ltvCac >= 4
      ? erfuellt(ist, w.ltvCac, hinweis || undefined)
      : nichtErfuellt(ist, w.ltvCac, hinweis || 'Unter Benchmark 4×.')
  }

  if (w.nrrPct != null && w.nrrPct >= 110) {
    const hinweis = [
      w.ltvCacHinweis,
      quelleLabel,
      'LTV/CAC nicht genannt — NRR als Plattform-Proxy (>110 %).',
    ]
      .filter(Boolean)
      .join(' · ')
    return qualitativ(`${w.nrrPct.toLocaleString('de-DE', { maximumFractionDigits: 1 })} % NRR`, 'qualitativ', hinweis)
  }

  const suchHinweis =
    w.ltvCacHinweis ??
    'LTV/CAC wird von den meisten Börsen-APIs nicht geliefert. Nur wenn Management es in 10-Q/10-K oder Earnings Call nennt — oder manuell im Bericht prüfen. Für Nicht-SaaS oft nicht anwendbar.'

  return keineDaten(suchHinweis)
}

function evaluiereMargenSkalierung(w: FundamentalKontextWerte) {
  const teile: string[] = []
  let inkOk: boolean | null = null
  let sgaOk: boolean | null = null

  if (w.inkrementelleOpMarge != null) {
    inkOk = w.inkrementelleOpMarge > 20
    teile.push(`Inkrementelle Op.-Marge ${pct(w.inkrementelleOpMarge)}`)
  }

  if (w.sgaRatioHist.length >= 2) {
    sgaOk = w.sgaDegressiv
    const aktuell = w.sgaRatioHist[w.sgaRatioHist.length - 1]!
    teile.push(`SG&A/Umsatz ${pct(aktuell)}${sgaOk ? ', degressiv' : ''}`)
  }

  if (inkOk == null && sgaOk == null) {
    return keineDaten('EBIT- und SG&A-Zeitreihen aus Macrotrends benötigt.')
  }

  const istWert = teile.join(' · ') || '–'

  if (inkOk === true && sgaOk === true) return erfuellt(istWert, w.inkrementelleOpMarge ?? undefined)
  if (inkOk === false) return nichtErfuellt(istWert, w.inkrementelleOpMarge ?? undefined, 'Inkrementelle Marge ≤20 % bei Umsatzwachstum.')
  if (sgaOk === false && inkOk === true) {
    return qualitativ(istWert, 'qualitativ', 'Inkrementelle Marge ok, SG&A-Quote noch nicht degressiv.')
  }
  return qualitativ(istWert, 'qualitativ', 'Teilweise bewertbar — SG&A-Trend oder inkrementelle Marge prüfen.')
}

function evaluiereFcfRuleOf40(w: FundamentalKontextWerte) {
  if (w.istWachstumsfirma) {
    if (w.ruleOf40 == null) return keineDaten('Wachstumsfirma: Umsatzwachstum + FCF-Marge benötigt.')
    return w.ruleOf40 >= 40
      ? erfuellt(pct(w.ruleOf40), w.ruleOf40, 'Rule of 40 (Wachstums-Pfad).')
      : nichtErfuellt(pct(w.ruleOf40), w.ruleOf40, 'Rule of 40 (Wachstums-Pfad).')
  }

  if (w.fcfConversion == null) return keineDaten('FCF-Konvertierung (FCF ÷ Nettogewinn) benötigt.')
  return w.fcfConversion >= 90
    ? erfuellt(pct(w.fcfConversion), w.fcfConversion, 'Etablierte Firma: FCF/Nettogewinn.')
    : nichtErfuellt(pct(w.fcfConversion), w.fcfConversion, 'Etablierte Firma: FCF/Nettogewinn.')
}

function evaluiereVerschuldungVerwaesserung(w: FundamentalKontextWerte) {
  const teile: string[] = []
  let schuldOk: boolean | null = null
  let dilOk: boolean | null = null

  if (w.netDebtEbitda != null) {
    schuldOk = w.netDebtEbitda < 2
    teile.push(`Net Debt/EBITDA ${mult(w.netDebtEbitda)}`)
  }

  if (w.aktienVerwaesserungJaehrlichPct != null) {
    dilOk = w.aktienVerwaesserungJaehrlichPct < 2
    teile.push(`Verwässerung ${pct(w.aktienVerwaesserungJaehrlichPct)} p.a.`)
  } else if (w.aktienSinkend === true) {
    dilOk = true
    teile.push('Sinkende Aktienanzahl')
  }

  if (schuldOk == null && dilOk == null) return keineDaten('Net Debt/EBITDA und Aktienanzahl-Zeitreihe benötigt.')

  const istWert = teile.join(' · ') || '–'

  if (schuldOk === true && dilOk === true) return erfuellt(istWert)
  if (schuldOk === false) return nichtErfuellt(istWert, w.netDebtEbitda ?? undefined, 'Verschuldung ≥2× EBITDA.')
  if (dilOk === false) {
    return nichtErfuellt(
      istWert,
      w.aktienVerwaesserungJaehrlichPct ?? undefined,
      'Jährliche SBC-Verwässerung ≥2 %.',
    )
  }
  if (schuldOk === true && dilOk == null) {
    return qualitativ(istWert, 'qualitativ', 'Schuld ok, Verwässerung nicht vollständig messbar.')
  }
  return qualitativ(istWert, 'qualitativ', 'Teilweise bewertbar.')
}

function evaluiereZeile(zeile: MantraZeile, _ctx: MantraKontext, w: FundamentalKontextWerte): {
  istWert: string | null
  status: MantraAuditStatus
  hinweis?: string
} {
  const k = zeile.kennzahl.toLowerCase()

  if (k.includes('roic') && k.includes('adjust')) return evaluiereRoicAdjustiert(w)
  if (k.includes('ltv') || k.includes('cac')) return evaluiereLtvCac(w)
  if (k.includes('margen-struktur') || k.includes('skaleneffekte')) return evaluiereMargenSkalierung(w)
  if (k.includes('fcf-konvertierung') || k.includes('rule of 40')) return evaluiereFcfRuleOf40(w)
  if (k.includes('verschuldung') || k.includes('verwässerung')) return evaluiereVerschuldungVerwaesserung(w)

  return keineDaten('Keine Zuordnung zu verfügbaren Fundamentaldaten.')
}

function auditZeilen(
  zeilen: readonly MantraZeile[],
  ctx: MantraKontext,
  w: FundamentalKontextWerte,
): MantraAuditErgebnis[] {
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
  _sektor: string | null,
  _branche: string | null,
  yahoo: YahooFundamentalKennzahlen | null,
  roh: MantraRohdaten,
  schaetzungen: FundamentalSchaetzungenRoh,
  yahooFinanz: MantraYahooFinanzdaten | null = null,
  kontextWerte?: FundamentalKontextWerte | null,
): FundamentalMantraAudit {
  const ctx: MantraKontext = { yahoo, roh, schaetzungen, yahooFinanz }
  const w = kontextWerte ?? baueKontextWerte(ctx)

  const standard = auditZeilen(INVESTMENT_MANTRA, ctx, w)
  const sum = zusammenfassung(standard)

  return {
    sektorMantraId: null,
    sektorMantraTitel: null,
    sektorMantraIntro: null,
    standard,
    sektor: [],
    zusammenfassung: sum,
    anker: QUALITY_INVESTING_ANKER,
    frameworkTitel: QUALITY_INVESTING_FRAMEWORK_TITEL,
    frameworkUntertitel: QUALITY_INVESTING_FRAMEWORK_UNTERTITEL,
    moatCheck: MOAT_CHECK,
    moatPlattformZusatz: MOAT_CHECK_PLATTFORM_ZUSATZ,
    sellTriggers: SELL_TRIGGERS,
    sellTriggersHinweis: SELL_TRIGGERS_HINWEIS,
  }
}

export type { MoatPfeiler, SellTrigger }
