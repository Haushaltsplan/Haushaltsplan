'use client'

import { ShopKpi, ShopSection, zahl } from '@/components/etsy/etsy-shop-ui'
import type { EtsyZahlenErgebnis } from '@/lib/etsy/etsy-shop-os-types'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

type Props = {
  verbunden: boolean
  onListing?: (listingId: number) => void
}

const AKTION_STIL: Record<string, string> = {
  nachschaerfen: 'border-l-amber-500',
  premium: 'border-l-sky-500',
  pausieren: 'border-l-rose-500',
  skalieren: 'border-l-emerald-500',
  halten: 'border-l-[var(--app-border)]',
}

export function EtsyZahlen({ verbunden, onListing }: Props) {
  const [daten, setDaten] = useState<EtsyZahlenErgebnis | null>(null)
  const [laden, setLaden] = useState(false)

  const lade = useCallback(async () => {
    if (!verbunden) return
    setLaden(true)
    try {
      const res = await fetch('/api/etsy/zahlen', { cache: 'no-store' })
      const j = (await res.json()) as EtsyZahlenErgebnis & { error?: string }
      if (!res.ok) throw new Error(j.error || 'Laden fehlgeschlagen')
      setDaten(j)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setLaden(false)
    }
  }, [verbunden])

  useEffect(() => {
    void lade()
  }, [lade])

  if (!verbunden) {
    return <p className="text-sm text-[var(--app-text-muted)]">Etsy verbinden für Funnel-Zahlen.</p>
  }

  return (
    <div className="space-y-4">
      {laden && !daten ? <p className="text-sm text-[var(--app-text-muted)]">Lade Zahlen…</p> : null}
      {daten ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <ShopKpi label="Views 7d" value={zahl(daten.funnelShop.views7)} />
            <ShopKpi label="Favs 7d" value={zahl(daten.funnelShop.favs7)} hint={`CVR ${zahl(daten.funnelShop.viewToFavPct, 1)}%`} />
            <ShopKpi
              label="Verkäufe 30d"
              value={zahl(daten.funnelShop.verkaufe30)}
              hint={`Fav→Sale ${zahl(daten.funnelShop.favToSalePct, 1)}%`}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ShopKpi label="Forecast 30d" value={zahl(daten.forecast.verkaufe30, 1)} hint={daten.forecast.hinweis} />
            <ShopKpi label="Forecast 90d" value={zahl(daten.forecast.verkaufe90, 1)} />
          </div>

          <ShopSection title="3 Entscheidungen der Woche">
            <ul className="space-y-2">
              {daten.entscheidungen.map((e, i) => (
                <li key={i} className="rounded-xl border border-[var(--app-border)] border-l-4 border-l-amber-500 p-3">
                  <p className="text-sm font-medium text-[var(--app-text)]">{e.titel}</p>
                  <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">{e.detail}</p>
                  {e.listingId && onListing ? (
                    <button
                      type="button"
                      className="mt-1 text-xs text-amber-300 hover:underline"
                      onClick={() => onListing(e.listingId!)}
                    >
                      Listing öffnen
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </ShopSection>

          {daten.zombies.length > 0 ? (
            <ShopSection title="Zombie-Listings">
              <ul className="space-y-2">
                {daten.zombies.map((z) => (
                  <li key={z.listingId} className="flex justify-between gap-2 text-sm">
                    <span className="truncate">{z.title}</span>
                    <span className="shrink-0 text-rose-300">
                      {z.views7} Views · 0 Sales
                    </span>
                  </li>
                ))}
              </ul>
            </ShopSection>
          ) : null}

          <ShopSection title="Funnel pro Listing">
            <ul className="space-y-2">
              {daten.listings.slice(0, 25).map((l) => (
                <li
                  key={l.listingId}
                  className={`rounded-xl border border-[var(--app-border)] border-l-4 p-3 ${AKTION_STIL[l.killOrScale] || ''}`}
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--app-text)]">{l.title}</p>
                    <span className="text-xs uppercase tracking-wide text-[var(--app-text-muted)]">{l.killOrScale}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
                    {l.views7}→{l.favs7}→{l.verkaufe30} · Fav {zahl(l.viewToFavPct, 1)}% · {l.grund}
                  </p>
                </li>
              ))}
            </ul>
          </ShopSection>
        </>
      ) : null}
    </div>
  )
}
