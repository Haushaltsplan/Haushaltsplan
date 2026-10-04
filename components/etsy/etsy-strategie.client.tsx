'use client'

import { ShopKpi, ShopSection, eur, postShop, zahl } from '@/components/etsy/etsy-shop-ui'
import type { EtsyStrategieErgebnis } from '@/lib/etsy/etsy-shop-os-types'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

type Props = {
  verbunden: boolean
  onListing?: (listingId: number) => void
}

export function EtsyStrategie({ verbunden, onListing }: Props) {
  const [daten, setDaten] = useState<EtsyStrategieErgebnis | null>(null)
  const [laden, setLaden] = useState(false)
  const [kap, setKap] = useState(4)

  const lade = useCallback(async () => {
    if (!verbunden) return
    setLaden(true)
    try {
      const res = await fetch('/api/etsy/strategie', { cache: 'no-store' })
      const j = (await res.json()) as EtsyStrategieErgebnis & { error?: string }
      if (!res.ok) throw new Error(j.error || 'Laden fehlgeschlagen')
      setDaten(j)
      setKap(j.briefing.kapazitaet.proWoche)
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
    return <p className="text-sm text-[var(--app-text-muted)]">Etsy verbinden für Strategie.</p>
  }

  const b = daten?.briefing

  return (
    <div className="space-y-4">
      {laden && !daten ? <p className="text-sm text-[var(--app-text-muted)]">Lade Strategie…</p> : null}
      {daten && b ? (
        <>
          <ShopSection title={`CEO-Briefing ${b.woche}`}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <ShopKpi label="Umsatz 30d" value={eur(b.umsatz30)} />
              <ShopKpi label="Netto 30d" value={eur(b.netto30)} />
              <ShopKpi label="Verkäufe" value={zahl(b.verkaufe30)} />
              <ShopKpi
                label="Auslastung"
                value={`${zahl(b.kapazitaet.auslastungPct)}%`}
                hint={`${b.kapazitaet.offeneBestellungen} offen / ${b.kapazitaet.proWoche} Kap.`}
              />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                <p className="text-xs uppercase text-emerald-300">Top</p>
                <p className="mt-1 text-[var(--app-text)]">
                  {b.topListing ? `${b.topListing.title.slice(0, 50)} (${b.topListing.verkaufe30} Sales)` : '—'}
                </p>
              </div>
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm">
                <p className="text-xs uppercase text-rose-300">Flop / prüfen</p>
                <p className="mt-1 text-[var(--app-text)]">
                  {b.flopListing ? `${b.flopListing.title.slice(0, 50)} (${b.flopListing.views7} Views)` : '—'}
                </p>
              </div>
            </div>
            <ul className="mt-3 space-y-2">
              {b.aktionen.map((a, i) => (
                <li key={i} className="rounded-xl border border-[var(--app-border)] border-l-4 border-l-amber-500 p-3">
                  <p className="text-sm font-medium text-[var(--app-text)]">{a.titel}</p>
                  <p className="text-xs text-[var(--app-text-muted)]">{a.detail}</p>
                  {a.listingId && onListing ? (
                    <button
                      type="button"
                      className="mt-1 text-xs text-amber-300 hover:underline"
                      onClick={() => onListing(a.listingId!)}
                    >
                      Listing
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </ShopSection>

          {b.algoAlarme.length > 0 ? (
            <ShopSection title="Algo-Versicherung (Rollback prüfen)">
              <ul className="space-y-2">
                {b.algoAlarme.map((a) => (
                  <li key={a.listingId} className="rounded-xl border border-rose-500/40 p-3 text-sm">
                    <p className="font-medium text-[var(--app-text)]">{a.title}</p>
                    <p className="text-xs text-rose-200">{a.detail}</p>
                  </li>
                ))}
              </ul>
            </ShopSection>
          ) : null}

          <ShopSection title="Kill-or-Scale Matrix">
            <ul className="space-y-2">
              {daten.killOrScale.map((k) => (
                <li key={k.listingId} className="flex flex-wrap justify-between gap-2 rounded-xl border border-[var(--app-border)] p-3 text-sm">
                  <div>
                    <p className="font-medium text-[var(--app-text)]">{k.title.slice(0, 48)}</p>
                    <p className="text-xs text-[var(--app-text-muted)]">{k.grund}</p>
                  </div>
                  <span className="text-xs uppercase tracking-wide text-amber-300">{k.aktion}</span>
                </li>
              ))}
              {daten.killOrScale.length === 0 ? (
                <p className="text-sm text-[var(--app-text-muted)]">Alles im Halten-Bereich.</p>
              ) : null}
            </ul>
          </ShopSection>

          <ShopSection
            title="Kapazität Drechselbank"
            action={
              <button
                type="button"
                className="text-xs text-amber-300 hover:underline"
                onClick={() =>
                  void postShop('/api/etsy/strategie', { action: 'kapazitaet', kapazitaetProWoche: kap }).then(() => {
                    toast.success('Kapazität gespeichert')
                    void lade()
                  })
                }
              >
                Speichern
              </button>
            }
          >
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="number"
                min={1}
                max={40}
                value={kap}
                onChange={(e) => setKap(Number(e.target.value))}
                className="w-24 rounded-lg border border-[var(--app-border)] bg-transparent px-2 py-1.5 text-sm"
              />
              <span className="text-sm text-[var(--app-text-muted)]">Schalen / Woche — steuert Lieferversprechen & Auslastung</span>
            </div>
          </ShopSection>

          <ShopSection title="Rohholz (Kapital & Durchlauf)">
            {daten.rohholz.length === 0 ? (
              <p className="text-sm text-[var(--app-text-muted)]">Keine Blanks — unter Betrieb erfassen.</p>
            ) : (
              <ul className="space-y-2">
                {daten.rohholz.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2 text-sm">
                    <span>
                      {r.holzart} · {r.status}
                    </span>
                    <span className="text-[var(--app-text-muted)]">{r.kostenEur != null ? eur(r.kostenEur) : '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </ShopSection>
        </>
      ) : null}
    </div>
  )
}
