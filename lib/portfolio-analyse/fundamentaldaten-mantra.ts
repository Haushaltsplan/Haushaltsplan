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
  MantraAmpel,
  MantraAuditErgebnis,
  MantraAuditStatus,
  SellTriggerWatch,
  SellTriggerWatchStatus,
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

function evaluiereSellTriggers(w: FundamentalKontextWerte): SellTriggerWatch[] {
  const hist = w.roicAdjustiertHist.length > 0 ? w.roicAdjustiertHist : w.roicHist

  let renditeStatus: SellTriggerWatchStatus = 'keine_daten'
  let renditeBegr = 'ROIC-Zeitreihe nicht verfügbar.'
  if (hist.length >= 3) {
    const last3 = hist.slice(-3)
    const fallend = last3[0]! > last3[1]! && last3[1]! > last3[2]!
    const ltvSchwach = w.ltvCac != null && w.ltvCac < 3
    if (fallend && ltvSchwach) {
      renditeStatus = 'warnung'
      renditeBegr = `ROIC adjustiert fällt 3 Jahre (${last3.map((v) => pct(v)).join(' → ')}); LTV/CAC ${w.ltvCac!.toFixed(1)}× <3×.`
    } else if (fallend) {
      renditeStatus = 'beobachten'
      renditeBegr = `ROIC adjustiert fällt über 3 Jahre (${last3.map((v) => pct(v)).join(' → ')}).`
    } else if (ltvSchwach) {
      renditeStatus = 'beobachten'
      renditeBegr = `LTV/CAC ${w.ltvCac!.toFixed(1)}× unter 3× — Unit Economics prüfen.`
    } else {
      renditeStatus = 'ok'
      renditeBegr = 'Kein struktureller ROIC-Verfall über 3 Jahre erkennbar.'
    }
  }

  let moatStatus: SellTriggerWatchStatus = 'keine_daten'
  let moatBegr = 'Marktanteils- und Peer-Daten für Moat-Erosion nicht automatisch verfügbar.'
  const margenDruck =
    w.ebitMargeHist.length >= 2 &&
    w.ebitMargeHist[w.ebitMargeHist.length - 1]! < w.ebitMargeHist[0]! - 2
  const wachstumSchwach = w.revGrowthPct != null && w.revGrowthPct < 3
  if (margenDruck && wachstumSchwach) {
    moatStatus = 'beobachten'
    moatBegr = 'EBIT-Marge unter Druck bei schwachem Umsatzwachstum — Peer-Vergleich und NRR prüfen.'
  } else if (margenDruck) {
    moatStatus = 'beobachten'
    moatBegr = 'EBIT-Marge historisch gesunken — Preissetzungsmacht/Moat im Auge behalten.'
  } else if (w.revGrowthPct != null) {
    moatStatus = 'ok'
    moatBegr = 'Keine automatische Moat-Erosion erkannt (Margendruck + Wachstumsstagnation).'
  }

  let wachstumStatus: SellTriggerWatchStatus = 'keine_daten'
  let wachstumBegr = 'Umsatz-/EPS-Zeitreihen unvollständig.'
  const revStagniert = w.revGrowthPct != null && w.revGrowthPct < 4
  const epsSteigend = w.epsCagr3 != null && w.epsCagr3 > 5
  const hoheVerwaesserung =
    w.aktienVerwaesserungJaehrlichPct != null && w.aktienVerwaesserungJaehrlichPct > 2
  if (revStagniert && epsSteigend && hoheVerwaesserung) {
    wachstumStatus = 'warnung'
    wachstumBegr = `Umsatzwachstum ${pct(w.revGrowthPct)} bei EPS-CAGR ${pct(w.epsCagr3)} und Verwässerung ${pct(w.aktienVerwaesserungJaehrlichPct)} p.a. — kosmetisches Wachstum prüfen.`
  } else if (revStagniert && epsSteigend) {
    wachstumStatus = 'beobachten'
    wachstumBegr = 'EPS wächst bei schwachem Umsatz — Buybacks/Non-GAAP in Berichten prüfen.'
  } else if (w.revGrowthPct != null) {
    wachstumStatus = 'ok'
    wachstumBegr = 'Kein Muster „stagnierender Umsatz + steigendes EPS + hohe Verwässerung“.'
  }

  return SELL_TRIGGERS.map((t) => {
    if (t.id === 'rendite-verfall') {
      return { id: t.id, titel: t.titel, beschreibung: t.beschreibung, status: renditeStatus, begruendung: renditeBegr }
    }
    if (t.id === 'burggraben-erosion') {
      return { id: t.id, titel: t.titel, beschreibung: t.beschreibung, status: moatStatus, begruendung: moatBegr }
    }
    return { id: t.id, titel: t.titel, beschreibung: t.beschreibung, status: wachstumStatus, begruendung: wachstumBegr }
  })
}

function berechneAmpel(
  sum: {
    erfuellt: number
    nichtErfuellt: number
    keineDaten: number
    qualitativ: number
    bewertbar: number
  },
  watch: SellTriggerWatch[],
): { ampel: MantraAmpel; scorePct: number | null; hinweis: string } {
  const hatWarnung = watch.some((w) => w.status === 'warnung')
  const hatBeobachten = watch.some((w) => w.status === 'beobachten')
  const scorePct = sum.bewertbar > 0 ? Math.round((sum.erfuellt / sum.bewertbar) * 100) : null

  if (hatWarnung) {
    return {
      ampel: 'rot',
      scorePct,
      hinweis: 'Mindestens ein Sell-Trigger aktiv — Investmenthypothese prüfen.',
    }
  }
  if (sum.bewertbar === 0) {
    return { ampel: 'grau', scorePct: null, hinweis: 'Zu wenig Daten für Ampel-Bewertung.' }
  }
  if (sum.nichtErfuellt > 0 || hatBeobachten || (scorePct != null && scorePct < 60)) {
    return {
      ampel: 'gelb',
      scorePct,
      hinweis: hatBeobachten
        ? 'Beobachtungsmodus — Sell-Trigger oder Dashboard offen.'
        : 'Dashboard teilweise offen — Qualität prüfen.',
    }
  }
  return {
    ampel: 'gruen',
    scorePct,
    hinweis: 'Operative Kennzahlen und Sell-Triggers ohne Warnung.',
  }
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
  const sellTriggerWatch = evaluiereSellTriggers(w)
  const ampelInfo = berechneAmpel(sum, sellTriggerWatch)

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
    sellTriggerWatch,
    ampel: ampelInfo.ampel,
    ampelScorePct: ampelInfo.scorePct,
    ampelHinweis: ampelInfo.hinweis,
  }
}

export type { MoatPfeiler, SellTrigger }
