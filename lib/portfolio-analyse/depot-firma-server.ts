import 'server-only'

import {
  FALLBACK_EUR_USD,
  FX_SYMBOLE,
  fxKurseAusYahooMap,
  type FxKurse,
} from '@/lib/portfolio-analyse/kurs-aufloesung'
import { ladeLivePortfolioServer } from '@/lib/portfolio-analyse/depot-gewichte-server'
import {
  baueDepotFirmaModell,
  type DepotFirmaAntwort,
  type DepotFirmaPosition,
} from '@/lib/portfolio-analyse/depot-firma'
import {
  ladeFundamentaldatenPaketCacheFuerAnfrage,
  ladeFundamentaldatenPaketCacheViele,
} from '@/lib/portfolio-analyse/fundamentaldaten-paket-cache-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { ladeYahooKurse } from '@/lib/portfolio-analyse/yahoo-kurse-server'

type DepotFirmaFehler = { ok: false; message: string }

async function ladeFx(): Promise<FxKurse> {
  try {
    const map = await ladeYahooKurse([...FX_SYMBOLE])
    return fxKurseAusYahooMap(map)
  } catch {
    return fxKurseAusYahooMap(new Map())
  }
}

export async function ladeDepotFirmaAntwort(): Promise<DepotFirmaAntwort | DepotFirmaFehler> {
  const livePaket = await ladeLivePortfolioServer()
  if (!livePaket) return { ok: false, message: 'Kein Depot geladen.' }

  const positionen: DepotFirmaPosition[] = livePaket.live.positionen
    .filter((p) => p.assetKlasse === 'aktie' && p.stueck > 0 && p.wertLiveEur > 0 && p.isin)
    .map((p) => ({
      isin: p.isin!.toUpperCase(),
      name: p.anzeigeName || p.name,
      stueck: p.stueck,
      wertEur: p.wertLiveEur,
    }))

  if (positionen.length === 0) {
    return { ok: false, message: 'Keine Aktien im Depot (ETFs und andere Klassen sind ausgeschlossen).' }
  }

  const isins = positionen.map((p) => p.isin)
  const pakete = await ladeFundamentaldatenPaketCacheViele(isins)

  const fehlendStart = positionen.filter((p) => !pakete.has(p.isin))
  await Promise.all(
    fehlendStart.slice(0, 12).map(async (p) => {
      const ken = isinKenntnis(p.isin)
      const hit = await ladeFundamentaldatenPaketCacheFuerAnfrage({
        isin: p.isin,
        name: p.name,
        symbolYahoo: ken?.symbolYahoo ?? null,
        symbolCandidates: ken?.symbolCandidates,
        frequenz: 'jahr',
      })
      if (hit?.paket.ok) pakete.set(p.isin, hit.paket)
    }),
  )

  const fx = await ladeFx()
  const args = { positionen, pakete, fx }
  const fehlend = positionen
    .filter((p) => !pakete.get(p.isin)?.ok)
    .map((p) => ({ isin: p.isin, name: p.name }))

  return {
    ok: true,
    eurUsd: fx.eurUsd > 0 ? fx.eurUsd : FALLBACK_EUR_USD,
    depotgewicht: baueDepotFirmaModell({ ...args, modus: 'depotgewicht' }),
    gleichgewicht: baueDepotFirmaModell({ ...args, modus: 'gleichgewicht' }),
    fehlend,
  }
}
