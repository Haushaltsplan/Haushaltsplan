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

// ---------------------------------------------------------------------------
// ROIC — mit ROE/ROA als Fallback für EU-Unternehmen ohne Macrotrends
// ---------------------------------------------------------------------------

function evaluiereRoic(w: FundamentalKontextWerte) {
  const roic = w.roic
  const hist = w.roicHist
  const roicExGw = w.roicExGoodwill
  const quelleSuffix = w.roicQuelle ? ` ${w.roicQuelle}.` : ''

  // Primär: Macrotrends ROI/ROIC
  if (roic != null && hist.length > 0) {
    if (w.roicKonstantHoch || roic >= 15) {
      return erfuellt(
        pct(roic),
        roic,
        `ROIC aus Macrotrends.${quelleSuffix} Etabliert: konstant hoch.`,
      )
    }
    // Goodwill-Falle (IHS Markit, Patheon, …): operativer ROIC ohne Akquisitions-Prämien
    if (roicExGw != null && roicExGw >= 15 && roicExGw > roic + 3) {
      return erfuellt(
        pct(roicExGw),
        roicExGw,
        `ROIC ex Goodwill ${pct(roicExGw)} (klassisch ${pct(roic)}). Akquisitions-Prämien verzerren den Standard-ROIC — Kerngeschäft über Hürde.`,
      )
    }
    if (w.istWachstumsfirma && w.roicSteigend) {
      return qualitativ(pct(roic), 'erfuellt', `ROIC (Macrotrends). Wachstumsfirma: steigende Kurve.`)
    }
    const gwHinweis =
      roicExGw != null && roicExGw > roic
        ? ` ROIC ex Goodwill: ${pct(roicExGw)}.`
        : ''
    return nichtErfuellt(pct(roic), roic, `ROIC (Macrotrends).${quelleSuffix}${gwHinweis}`)
  }

  if (roicExGw != null) {
    if (roicExGw >= 15) {
      return erfuellt(pct(roicExGw), roicExGw, 'ROIC ex Goodwill (berechnet aus Bilanz).')
    }
    return nichtErfuellt(pct(roicExGw), roicExGw, 'ROIC ex Goodwill unter 15 %.')
  }

  // Fallback 1: ROE aus Yahoo Finance (wenn kein Macrotrends-ROIC)
  if (w.roe != null) {
    const proxy = w.roe
    const hinweis = 'Macrotrends-ROI nicht verfügbar — ROE (Yahoo) als Näherungswert. ROE überschätzt Kapitaleffizienz bei Unternehmen mit negativem Buchwert oder hohem Goodwill.'
    if (proxy >= 15) return qualitativ(pct(proxy), 'erfuellt', hinweis)
    if (proxy >= 10) return qualitativ(pct(proxy), 'qualitativ', hinweis)
    return nichtErfuellt(pct(proxy), proxy, hinweis)
  }

  // Fallback 2: ROA aus Yahoo Finance
  if (w.roa != null) {
    const hinweis = 'Macrotrends-ROI und ROE nicht verfügbar — ROA (Yahoo) als vereinfachter Proxy.'
    if (w.roa >= 8) return qualitativ(pct(w.roa), 'qualitativ', hinweis)
    if (w.roa >= 4) return qualitativ(pct(w.roa), 'qualitativ', hinweis)
    return nichtErfuellt(pct(w.roa), w.roa, hinweis)
  }

  return keineDaten('ROIC/ROE/ROA: Weder Macrotrends noch Yahoo Finance liefert Kapitalrenditedaten.')
}

// ---------------------------------------------------------------------------
// LTV/CAC — für traditionelle Nicht-SaaS Firmen: "nicht anwendbar" statt "keine_daten"
// ---------------------------------------------------------------------------

/**
 * Erkennt ob LTV/CAC für dieses Unternehmen sinnvoll messbar ist.
 *
 * SaaS / Abo-Modell = LTV/CAC relevant.
 * Traditionelle etablierte Firmen = nicht direkt messbar, aber Burggraben-Proxy möglich.
 */
function istLtvCacRelevant(w: FundamentalKontextWerte): boolean {
  // Starkes Indiz für SaaS / Abo:
  //  – NRR vorhanden (nur SaaS trackt das)
  //  – Wachstumsfirma mit niedrigen Margen (Reinvestitions-Phase)
  //  – Sehr hohe Bruttomarge >60 % (Software-typisch)
  if (w.nrrPct != null) return true
  if (w.istWachstumsfirma && (w.bruttoMarge ?? 0) > 55) return true
  return false
}

function evaluiereLtvCac(w: FundamentalKontextWerte) {
  // Primär: explizit genannter Wert aus SEC/Earnings
  if (w.ltvCac != null) {
    const quelleLabel =
      w.ltvCacQuelle === 'earnings_call' ? 'Earnings Call'
      : w.ltvCacQuelle === 'sec_10q' ? 'SEC 10-Q'
      : w.ltvCacQuelle === 'sec_10k' ? 'SEC 10-K'
      : null
    const basis = quelleLabel ? `${quelleLabel}${w.ltvCacPeriode ? ` (${w.ltvCacPeriode})` : ''}` : 'Primärquelle'
    const hinweis = [w.ltvCacHinweis, basis].filter(Boolean).join(' · ')
    const ist = `${w.ltvCac.toLocaleString('de-DE', { maximumFractionDigits: 1 })}×`
    return w.ltvCac >= 4
      ? erfuellt(ist, w.ltvCac, hinweis || undefined)
      : nichtErfuellt(ist, w.ltvCac, hinweis || 'Unter Benchmark 4×.')
  }

  // NRR als Plattform-Proxy
  if (w.nrrPct != null && w.nrrPct >= 110) {
    return qualitativ(
      `${w.nrrPct.toLocaleString('de-DE', { maximumFractionDigits: 1 })} % NRR`,
      'qualitativ',
      'LTV/CAC nicht explizit — NRR als Plattform-Proxy (>110 %): Kunden bleiben und expandieren.',
    )
  }

  // -----------------------------------------------------------------------
  // Für traditionelle etablierte Nicht-SaaS-Unternehmen:
  // LTV/CAC ist strukturell nicht im Reporting enthalten — kein Datenproblem,
  // sondern ein Geschäftsmodell-Merkmal. Qualitativ bewerten statt "keine_daten".
  // -----------------------------------------------------------------------
  if (!istLtvCacRelevant(w)) {
    // Statt "keine_daten" → qualitativ auf Basis von Kundenbindungs-Proxys
    const proxys: string[] = []

    // Hohe Bruttomargen implizieren Pricing Power / Switching Costs
    if ((w.bruttoMarge ?? 0) > 40) proxys.push(`Bruttomarge ${pct(w.bruttoMarge)} (Pricing Power)`)

    // Stabile/wachsende EBIT-Marge = operativer Hebel, impliziert Kundenloyalität
    if (w.ebitMargeHist.length >= 3) {
      const stabileOderWachsende =
        w.ebitMargeHist[w.ebitMargeHist.length - 1]! >= w.ebitMargeHist[0]! - 1
      if (stabileOderWachsende && (w.ebitMarge ?? 0) > 10) {
        proxys.push(`EBIT-Marge ${pct(w.ebitMarge)} stabil/wachsend`)
      }
    }

    // Sehr hoher ROIC impliziert Moat und damit implizit gute Unit Economics
    if (w.roic != null && w.roic >= 15) proxys.push(`ROIC ${pct(w.roic)} → impliziert Unit-Economic-Stärke`)

    if (proxys.length >= 2) {
      return qualitativ(
        proxys.join(' · '),
        'qualitativ',
        'LTV/CAC nicht im Reporting (traditionelles Geschäftsmodell ohne Abo-Struktur). Ersatz-Proxys zeigen implizite Unit-Economic-Stärke.',
      )
    }

    if (proxys.length === 1) {
      return qualitativ(
        proxys[0]!,
        'qualitativ',
        'LTV/CAC nicht im Reporting — 1 Proxy-Signal vorhanden.',
      )
    }

    // Zu wenig Daten für qualitative Einschätzung
    return keineDaten('LTV/CAC: Nicht direkt anwendbar für diesen Unternehmenstyp. Bruttomarge/EBIT-Daten fehlen für Proxy-Bewertung.')
  }

  // SaaS-Unternehmen ohne Daten = echtes Datenproblem
  return keineDaten(
    w.ltvCacHinweis ??
    'LTV/CAC: SaaS-/Abo-Unternehmen sollte diesen Wert berichten, aber kein Cache-Treffer. Earnings Call oder SEC 10-K prüfen.',
  )
}

// ---------------------------------------------------------------------------
// Margen-Skalierung — mit Yahoo-Fallback für EU-Unternehmen
// ---------------------------------------------------------------------------

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

  if (inkOk != null || sgaOk != null) {
    // Hauptpfad: Macrotrends-Daten vorhanden
    const istWert = teile.join(' · ') || '–'
    if (inkOk === true && sgaOk === true) return erfuellt(istWert, w.inkrementelleOpMarge ?? undefined)
    if (inkOk === false) return nichtErfuellt(istWert, w.inkrementelleOpMarge ?? undefined, 'Inkrementelle Marge ≤20 % bei Umsatzwachstum.')
    if (sgaOk === false && inkOk === true) {
      return qualitativ(istWert, 'qualitativ', 'Inkrementelle Marge ok, SG&A-Quote noch nicht degressiv.')
    }
    if (inkOk === true && sgaOk == null) return qualitativ(istWert, 'qualitativ', 'Inkrementelle Marge ok, SG&A-Zeitreihe unvollständig.')
    return qualitativ(istWert, 'qualitativ', 'Teilweise bewertbar — SG&A-Trend oder inkrementelle Marge prüfen.')
  }

  // -----------------------------------------------------------------------
  // Fallback: Yahoo Finance Margins (für EU-Unternehmen ohne Macrotrends-EBIT/SGA)
  // -----------------------------------------------------------------------
  const yahooBrutto = w.bruttoMarge
  const yahooEbit = w.ebitMarge

  if (yahooBrutto != null && yahooEbit != null) {
    // Prüfe ob die Marge-Differenz (Brutto → EBIT) auf gute SGA-Effizienz hindeutet
    const skalenIndikator = yahooEbit / Math.max(yahooBrutto, 1) // Anteil EBIT an Bruttomarge
    const istWert = `Bruttomarge ${pct(yahooBrutto)}, EBIT-Marge ${pct(yahooEbit)}`

    if (yahooEbit > 15 && skalenIndikator > 0.3) {
      return qualitativ(
        istWert,
        'qualitativ',
        'Macrotrends EBIT/SGA-Zeitreihe nicht verfügbar (möglicherweise EU-Unternehmen). Yahoo-Margins als Proxy: solide EBIT-Marge deutet auf operative Skaleneffekte.',
      )
    }
    if (yahooEbit > 8) {
      return qualitativ(
        istWert,
        'qualitativ',
        'Inkrementelle Marge und SGA-Zeitreihe aus Macrotrends nicht verfügbar — Yahoo-Marge als Fallback.',
      )
    }
    return nichtErfuellt(
      istWert,
      yahooEbit,
      'EBIT-Marge unter 8 % — mäßige operative Profitabilität (Yahoo-Fallback, da Macrotrends-Daten fehlen).',
    )
  }

  if (yahooEbit != null) {
    return qualitativ(
      `EBIT-Marge ${pct(yahooEbit)}`,
      yahooEbit > 10 ? 'qualitativ' : 'nicht_erfuellt',
      'Nur EBIT-Marge aus Yahoo verfügbar — keine Skalierungs-Zeitreihe.',
    )
  }

  return keineDaten('EBIT- und SG&A-Zeitreihen aus Macrotrends fehlen. Auch Yahoo-Margen nicht verfügbar.')
}

// ---------------------------------------------------------------------------
// FCF-Konvertierung / Rule of 40
// ---------------------------------------------------------------------------

function evaluiereFcfRuleOf40(w: FundamentalKontextWerte) {
  if (w.istWachstumsfirma) {
    if (w.ruleOf40 == null) return keineDaten('Wachstumsfirma: Umsatzwachstum + FCF-Marge benötigt.')
    return w.ruleOf40 >= 40
      ? erfuellt(pct(w.ruleOf40), w.ruleOf40, 'Rule of 40 (Wachstums-Pfad).')
      : nichtErfuellt(pct(w.ruleOf40), w.ruleOf40, 'Rule of 40 (Wachstums-Pfad).')
  }

  if (w.fcfConversion != null) {
    return w.fcfConversion >= 90
      ? erfuellt(pct(w.fcfConversion), w.fcfConversion, 'Etablierte Firma: FCF/Nettogewinn.')
      : nichtErfuellt(pct(w.fcfConversion), w.fcfConversion, 'Etablierte Firma: FCF/Nettogewinn.')
  }

  // Fallback: FCF-Marge aus Yahoo/Macrotrends als Näherung
  if (w.fcfMarge != null) {
    const hinweis = 'FCF-Konvertierung nicht direkt berechenbar — FCF-Marge als Proxy.'
    if (w.fcfMarge >= 12) return qualitativ(pct(w.fcfMarge), 'qualitativ', hinweis)
    if (w.fcfMarge >= 5) return qualitativ(pct(w.fcfMarge), 'qualitativ', hinweis)
    return nichtErfuellt(pct(w.fcfMarge), w.fcfMarge, 'FCF-Marge unter 5 % — schwache Cash-Generierung.')
  }

  return keineDaten('FCF-Konvertierung (FCF ÷ Nettogewinn) und FCF-Marge nicht verfügbar.')
}

// ---------------------------------------------------------------------------
// Verschuldung & Verwässerung
// ---------------------------------------------------------------------------

function evaluiereVerschuldungVerwaesserung(w: FundamentalKontextWerte) {
  const teile: string[] = []
  let schuldOk: boolean | null = null
  let dilOk: boolean | null = null

  if (w.netDebtEbitda != null) {
    schuldOk = w.netDebtEbitda < 2
    teile.push(`Net Debt/EBITDA ${mult(w.netDebtEbitda)}`)
  }
  if (w.netDebtFcf != null) {
    // FCF-Tragfähigkeit: >5× FCF = gelähmt bei Zinsanstieg
    const fcfOk = w.netDebtFcf < 5
    if (schuldOk == null) schuldOk = fcfOk
    else schuldOk = schuldOk && fcfOk
    teile.push(`Net Debt/FCF ${mult(w.netDebtFcf)}`)
  }

  if (w.aktienVerwaesserungJaehrlichPct != null) {
    dilOk = w.aktienVerwaesserungJaehrlichPct < 2
    teile.push(`Verwässerung ${pct(w.aktienVerwaesserungJaehrlichPct)} p.a.`)
  } else if (w.aktienSinkend === true) {
    dilOk = true
    teile.push('Sinkende Aktienanzahl')
  }

  if (schuldOk == null && dilOk == null) return keineDaten('Net Debt/EBITDA bzw. /FCF und Aktienanzahl-Zeitreihe benötigt.')

  const istWert = teile.join(' · ') || '–'

  if (schuldOk === true && dilOk === true) return erfuellt(istWert)
  if (schuldOk === false) {
    return nichtErfuellt(
      istWert,
      w.netDebtFcf ?? w.netDebtEbitda ?? undefined,
      'Verschuldung zu hoch (≥2× EBITDA oder ≥5× FCF).',
    )
  }
  if (dilOk === false) {
    return nichtErfuellt(
      istWert,
      w.aktienVerwaesserungJaehrlichPct ?? undefined,
      'Jährliche SBC-Verwässerung ≥2 %.',
    )
  }
  if (schuldOk === true && dilOk == null) {
    return qualitativ(istWert, 'qualitativ', 'Schuld ok, Verwässerungsdaten nicht verfügbar (z. B. EU-Unternehmen ohne Macrotrends-Aktienreihe).')
  }
  if (schuldOk == null && dilOk === true) {
    return qualitativ(istWert, 'qualitativ', 'Keine Verschuldungsdaten — Aktienanzahl in Ordnung.')
  }
  return qualitativ(istWert, 'qualitativ', 'Teilweise bewertbar.')
}

// ---------------------------------------------------------------------------
// Sell Triggers
// ---------------------------------------------------------------------------

function evaluiereSellTriggers(w: FundamentalKontextWerte): SellTriggerWatch[] {
  const hist = w.roicHist

  let renditeStatus: SellTriggerWatchStatus = 'keine_daten'
  let renditeBegr = 'ROIC-Zeitreihe nicht verfügbar.'

  if (hist.length >= 3) {
    const last3 = hist.slice(-3)
    const fallend = last3[0]! > last3[1]! && last3[1]! > last3[2]!
    const ltvSchwach = w.ltvCac != null && w.ltvCac < 3
    if (fallend && ltvSchwach) {
      renditeStatus = 'warnung'
      renditeBegr = `ROIC fällt 3 Jahre (${last3.map((v) => pct(v)).join(' → ')}); LTV/CAC ${w.ltvCac!.toFixed(1)}× <3×.`
    } else if (fallend) {
      renditeStatus = 'beobachten'
      renditeBegr = `ROIC fällt über 3 Jahre (${last3.map((v) => pct(v)).join(' → ')}).`
    } else if (ltvSchwach) {
      renditeStatus = 'beobachten'
      renditeBegr = `LTV/CAC ${w.ltvCac!.toFixed(1)}× unter 3× — Unit Economics prüfen.`
    } else {
      renditeStatus = 'ok'
      renditeBegr = 'Kein struktureller ROIC-Verfall über 3 Jahre erkennbar.'
    }
  } else if (w.roe != null) {
    // Fallback: ROE-Trend wenn ROIC nicht verfügbar
    renditeStatus = w.roe >= 10 ? 'ok' : 'beobachten'
    renditeBegr = w.roe >= 10
      ? `ROE ${pct(w.roe)} als Rendite-Proxy (ROIC-Zeitreihe nicht verfügbar).`
      : `ROE ${pct(w.roe)} — unter 10 %, ROIC-Daten prüfen.`
  }

  let moatStatus: SellTriggerWatchStatus = 'keine_daten'
  let moatBegr = 'Marktanteils- und Peer-Daten für Moat-Erosion nicht automatisch verfügbar.'
  const margenDruck =
    w.ebitMargeHist.length >= 2 &&
    w.ebitMargeHist[w.ebitMargeHist.length - 1]! < w.ebitMargeHist[0]! - 2
  const wachstumSchwach = w.revGrowthPct != null && w.revGrowthPct < 3

  if (w.pricingPowerOk === false && w.bruttoMargeStd10y != null) {
    moatStatus = 'warnung'
    moatBegr = `Bruttomarge schwankt ±${w.bruttoMargeStd10y.toFixed(1)} Pp. (10J) — Preissetzungsmacht fraglich (KO >2 Pp.).`
  } else if (margenDruck && wachstumSchwach) {
    moatStatus = 'beobachten'
    moatBegr = 'EBIT-Marge unter Druck bei schwachem Umsatzwachstum — Peer-Vergleich und NRR prüfen.'
  } else if (margenDruck) {
    moatStatus = 'beobachten'
    moatBegr = 'EBIT-Marge historisch gesunken — Preissetzungsmacht/Moat im Auge behalten.'
  } else if (w.pricingPowerOk === true) {
    moatStatus = 'ok'
    moatBegr = `Stabile Bruttomarge (StdAbw. ${w.bruttoMargeStd10y?.toFixed(1)} Pp.) — Pricing Power intakt.`
  } else if (w.revGrowthPct != null || w.ebitMarge != null) {
    moatStatus = 'ok'
    moatBegr = 'Keine automatische Moat-Erosion erkannt.'
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
    wachstumBegr = 'Kein Muster „stagnierender Umsatz + steigendes EPS + hohe Verwässerung".'
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

// ---------------------------------------------------------------------------
// Ampel
// ---------------------------------------------------------------------------

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

  // Erweiterte Score-Berechnung: qualitativ als halbes Gewicht
  const effektivErfuellt = sum.erfuellt + sum.qualitativ * 0.5
  const effektivBewertbar = sum.bewertbar + sum.qualitativ * 0.5
  const scorePct = effektivBewertbar > 0 ? Math.round((effektivErfuellt / effektivBewertbar) * 100) : null

  if (hatWarnung) {
    return { ampel: 'rot', scorePct, hinweis: 'Mindestens ein Sell-Trigger aktiv — Investmenthypothese prüfen.' }
  }
  if (sum.bewertbar === 0 && sum.qualitativ === 0) {
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
  return { ampel: 'gruen', scorePct, hinweis: 'Operative Kennzahlen und Sell-Triggers ohne Warnung.' }
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

function evaluiereZeile(zeile: MantraZeile, _ctx: MantraKontext, w: FundamentalKontextWerte): {
  istWert: string | null
  status: MantraAuditStatus
  hinweis?: string
} {
  const k = zeile.kennzahl.toLowerCase()

  if (k.includes('roic')) return evaluiereRoic(w)
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
