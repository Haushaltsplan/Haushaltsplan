import { heuteIsoUtc, isoInJahren } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { ladeEarningsTerminFuerSymbole, type EarningsTerminKandidat } from '@/lib/portfolio-analyse/earnings-termine'
import { ladeDivvydiaryEarningsRohdaten } from '@/lib/portfolio-analyse/divvydiary-scraper-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { brokerSymbolKandidaten } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { portfolioLogoQuellen } from '@/lib/portfolio-analyse/portfolio-logos'

const CACHE_MS = 6 * 60 * 60 * 1000
const HORIZONT_JAHRE = 1

export type AnkuendigtesEarningsTermin = EarningsTerminKandidat & {
  securityName: string
}

const termineCache = new Map<string, { at: number; symKey: string; hit: AnkuendigtesEarningsTermin | null }>()

function symboleFuerIsin(isin: string, symbolYahoo?: string | null, symbolCandidates?: string[]): string[] {
  const out: string[] = []
  const add = (s: string | null | undefined) => {
    for (const t of brokerSymbolKandidaten(s ?? '')) {
      if (t && !out.includes(t)) out.push(t)
    }
  }
  add(symbolYahoo)
  for (const c of symbolCandidates ?? []) add(c)
  const k = isinKenntnis(isin)
  add(k?.symbolYahoo)
  for (const c of k?.symbolCandidates ?? []) add(c)
  const logo = portfolioLogoQuellen(isin, k?.symbolYahoo, k?.name ?? '')
  if (logo.finnhubSlug) {
    const slug = logo.finnhubSlug.trim().toUpperCase()
    if (slug && !out.includes(slug)) out.push(slug)
  }
  return out
}

export async function ladeAnkuendigtesEarningsTermin(
  isin: string,
  name: string,
  symbolYahoo?: string | null,
  symbolCandidates?: string[],
): Promise<AnkuendigtesEarningsTermin | null> {
  const isinNorm = isin.trim().toUpperCase()
  if (!isinNorm || isinNorm.length < 10) return null

  const symbole = symboleFuerIsin(isinNorm, symbolYahoo, symbolCandidates)
  const symKey = symbole.join('|')
  const cached = termineCache.get(isinNorm)
  if (cached && Date.now() - cached.at < CACHE_MS && cached.symKey === symKey) return cached.hit

  const heute = heuteIsoUtc()
  const bis = isoInJahren(HORIZONT_JAHRE)
  const anzeigeName = isinKenntnis(isinNorm)?.name ?? name

  const roh = await ladeDivvydiaryEarningsRohdaten(isinNorm, anzeigeName)
  const treffer = await ladeEarningsTerminFuerSymbole(symbole, roh?.earnings ?? null, heute, bis)

  const hit = treffer
    ? {
        ...treffer,
        securityName: roh?.earnings?.securityName ?? anzeigeName,
      }
    : null

  termineCache.set(isinNorm, { at: Date.now(), symKey, hit })
  return hit
}

/** @deprecated Nutze ladeAnkuendigtesEarningsTermin — Alias für bestehende Aufrufer. */
export async function ladeDivvydiaryAnkuendigtesEarnings(
  isin: string,
  name: string,
): Promise<{ terminDatumIso: string; bestaetigt: boolean; securityName: string } | null> {
  const hit = await ladeAnkuendigtesEarningsTermin(isin, name)
  if (!hit) return null
  return {
    terminDatumIso: hit.terminDatumIso,
    bestaetigt: hit.bestaetigt,
    securityName: hit.securityName,
  }
}
