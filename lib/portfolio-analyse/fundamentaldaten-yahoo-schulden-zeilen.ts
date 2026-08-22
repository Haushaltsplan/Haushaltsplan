/**
 * Übernimmt Yahoo Total Debt (inkl. kurzfristig + Leases) in die Fundamental-Zeilen
 * und schreibt Cash+STI für EV-Konsistenz.
 */
import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import {
  findeYahooSchuldenFuerIso,
  ladeYahooSchuldenHistorie,
} from '@/lib/portfolio-analyse/yahoo-schulden-historie-server'

function usdZuMio(usd: number | null): number | null {
  if (usd == null || !Number.isFinite(usd)) return null
  return usd / 1_000_000
}

function upsertZeile(
  zeilen: FundamentalMetrikZeile[],
  id: string,
  label: string,
  werte: Record<string, number | null>,
): void {
  const existing = zeilen.find((z) => z.id === id)
  if (!existing) {
    zeilen.push({
      id,
      label,
      gruppe: 'bilanz',
      einheit: 'waehrung_usd_mio',
      werte: { ...werte },
    })
    return
  }
  for (const [k, v] of Object.entries(werte)) {
    if (v != null) existing.werte[k] = v
  }
  existing.label = label
}

/**
 * Füllt / überschreibt Schulden & Cash aus Yahoo für historische FY-Spalten.
 * @returns Anzahl überschriebener Jahre mit Total Debt
 */
export async function ergaenzeYahooSchuldenZeilen(
  symbolYahoo: string | null | undefined,
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
  opts?: { isin?: string | null },
): Promise<number> {
  if (!symbolYahoo?.trim() || perioden.length === 0) return 0

  const { yahooKennzahlenSymbolKandidaten } = await import(
    '@/lib/portfolio-analyse/yahoo-kennzahlen-fallback-server'
  )
  const symbole = yahooKennzahlenSymbolKandidaten({
    symbolYahoo,
    isin: opts?.isin,
  })

  let historie: Awaited<ReturnType<typeof ladeYahooSchuldenHistorie>> = []
  for (const sym of symbole) {
    historie = await ladeYahooSchuldenHistorie(sym)
    if (historie.length >= 2) break
  }
  if (historie.length === 0) return 0

  const fyKeys = perioden
    .filter(
      (p) =>
        !p.istLtm &&
        !p.istNtm &&
        !p.istSchaetzung &&
        /^\d{4}-\d{2}-\d{2}$/.test(p.iso),
    )
    .map((p) => p.iso)

  if (fyKeys.length === 0) return 0

  const totalWerte: Record<string, number | null> = {}
  const kurzWerte: Record<string, number | null> = {}
  const langWerte: Record<string, number | null> = {}
  const cashWerte: Record<string, number | null> = {}
  let nTotal = 0

  for (const iso of fyKeys) {
    const j = findeYahooSchuldenFuerIso(historie, iso)
    const totalMio = usdZuMio(j?.totalDebtUsd ?? null)
    const kurzMio = usdZuMio(j?.currentDebtUsd ?? null)
    const langMio = usdZuMio(j?.longTermDebtUsd ?? null)
    const cashMio = usdZuMio(j?.cashAndStiUsd ?? null)

    if (totalMio != null) {
      totalWerte[iso] = totalMio
      nTotal++
    }
    if (kurzMio != null) kurzWerte[iso] = kurzMio
    if (langMio != null) langWerte[iso] = langMio
    if (cashMio != null) cashWerte[iso] = cashMio
  }

  if (nTotal === 0 && Object.keys(kurzWerte).length === 0) return 0

  // Macrotrends-LTD sichern, bevor wir Gesamtüberschreiben
  const mtDebt = zeilen.find((z) => z.id === 'gesamtverschuldung')
  if (mtDebt && !zeilen.some((z) => z.id === 'langfristige_schulden')) {
    const nurHist: Record<string, number | null> = {}
    for (const iso of fyKeys) {
      const v = mtDebt.werte[iso]
      if (v != null) nurHist[iso] = v
    }
    if (Object.values(nurHist).some((v) => v != null)) {
      upsertZeile(zeilen, 'langfristige_schulden', 'Langfristige Schulden (Macrotrends)', nurHist)
    }
  }

  if (Object.values(langWerte).some((v) => v != null)) {
    upsertZeile(zeilen, 'langfristige_schulden', 'Langfristige Schulden (inkl. Leases)', langWerte)
  }
  if (Object.values(kurzWerte).some((v) => v != null)) {
    upsertZeile(zeilen, 'kurzfristige_schulden', 'Kurzfristige Schulden (inkl. Leases)', kurzWerte)
  }

  // Gesamtverschuldung = Yahoo Total Debt (Fallback: LT + ST)
  const gesamt: Record<string, number | null> = {}
  for (const iso of fyKeys) {
    if (totalWerte[iso] != null) {
      gesamt[iso] = totalWerte[iso]!
      continue
    }
    const k = kurzWerte[iso]
    const l = langWerte[iso] ?? mtDebt?.werte[iso] ?? null
    if (k != null || l != null) gesamt[iso] = (k ?? 0) + (l ?? 0)
  }
  if (Object.values(gesamt).some((v) => v != null)) {
    upsertZeile(zeilen, 'gesamtverschuldung', 'Gesamtverschuldung', gesamt)
  }

  // Cash für EV: Yahoo Cash+STI (stimmt mit Yahoo-EV-Definition)
  if (Object.values(cashWerte).some((v) => v != null)) {
    upsertZeile(zeilen, 'bargeld', 'Bargeld & Kurzfristige Anlagen', cashWerte)
  }

  return nTotal
}
