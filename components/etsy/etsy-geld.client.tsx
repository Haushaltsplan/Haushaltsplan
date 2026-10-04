'use client'

import { ShopKpi, ShopSection, eur, postShop, zahl } from '@/components/etsy/etsy-shop-ui'
import type { EtsyGeldErgebnis, EtsyKostenZeile } from '@/lib/etsy/etsy-shop-os-types'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

type Props = { verbunden: boolean }

const LEER_KOSTEN: EtsyKostenZeile = {
  holzEur: 0,
  oelEur: 2,
  schleifEur: 1.5,
  werkzeugEur: 3,
  stromEur: 1,
  verpackungEur: 3.5,
  sonstigesEur: 0,
  arbeitsstunden: 2,
  stundensatzEur: 25,
  versandAnteilEur: 0,
}

const AMPEL: Record<string, string> = {
  zu_billig: 'text-rose-300',
  fair: 'text-emerald-300',
  premium: 'text-sky-300',
  ohne_kosten: 'text-[var(--app-text-muted)]',
}

export function EtsyGeld({ verbunden }: Props) {
  const [daten, setDaten] = useState<EtsyGeldErgebnis | null>(null)
  const [laden, setLaden] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [kosten, setKosten] = useState<EtsyKostenZeile>(LEER_KOSTEN)
  const [holzart, setHolzart] = useState('')
  const [zielMarge, setZielMarge] = useState(55)

  const lade = useCallback(async () => {
    if (!verbunden) return
    setLaden(true)
    try {
      const res = await fetch('/api/etsy/geld', { cache: 'no-store' })
      const j = (await res.json()) as EtsyGeldErgebnis & { error?: string }
      if (!res.ok) throw new Error(j.error || 'Laden fehlgeschlagen')
      setDaten(j)
      setZielMarge(j.einstellungen.zielMargePct)
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
    return <p className="text-sm text-[var(--app-text-muted)]">Etsy verbinden, um Margen und P&L zu sehen.</p>
  }

  async function speichereKosten(listingId: number, title: string) {
    try {
      await postShop('/api/etsy/geld', {
        action: 'kosten',
        listingId,
        listingTitle: title,
        kosten: { ...kosten, holzart: holzart || null },
      })
      toast.success('Kosten gespeichert')
      setEditId(null)
      void lade()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    }
  }

  async function speichereMarge() {
    try {
      await postShop('/api/etsy/geld', { action: 'einstellungen', einstellungen: { zielMargePct: zielMarge } })
      toast.success('Zielmarge gespeichert')
      void lade()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    }
  }

  return (
    <div className="space-y-4">
      {laden && !daten ? <p className="text-sm text-[var(--app-text-muted)]">Lade Geld-Modul…</p> : null}
      {daten ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ShopKpi label="Umsatz 30d" value={eur(daten.pnl.umsatz30)} hint={`${zahl(daten.pnl.verkaufe30)} Verkäufe`} />
            <ShopKpi label="Gebühren 30d" value={eur(daten.pnl.gebuehren30)} />
            <ShopKpi label="Material+Arbeit" value={eur(daten.pnl.material30)} />
            <ShopKpi label="Netto 30d" value={eur(daten.pnl.netto30)} hint="nach Gebühren & Kosten" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <ShopKpi label="Portfolio-Wert" value={eur(daten.portfolio.aktiverWertEur)} hint="aktive Listings × Preis" />
            <ShopKpi
              label="Ohne Kosten"
              value={String(daten.portfolio.listingsOhneKosten)}
              hint={`${daten.portfolio.listingsMitKosten} mit Kalkulation`}
            />
            <ShopKpi label="Totes Kapital" value={eur(daten.portfolio.toteKapitalEur)} hint="Views, kein Verkauf ≥90d" />
          </div>

          <ShopSection
            title="Zielmarge"
            action={
              <button type="button" onClick={() => void speichereMarge()} className="text-xs text-amber-300 hover:underline">
                Speichern
              </button>
            }
          >
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="number"
                min={10}
                max={90}
                value={zielMarge}
                onChange={(e) => setZielMarge(Number(e.target.value))}
                className="w-24 rounded-lg border border-[var(--app-border)] bg-transparent px-2 py-1.5 text-sm"
              />
              <span className="text-sm text-[var(--app-text-muted)]">% Netto vom Verkaufspreis (nach Gebühren)</span>
            </div>
          </ShopSection>

          {daten.portfolio.toteListings.length > 0 ? (
            <ShopSection title="Gebundenes Kapital (Zombies)">
              <ul className="space-y-2">
                {daten.portfolio.toteListings.map((t) => (
                  <li key={t.listingId} className="flex justify-between gap-2 text-sm">
                    <span className="truncate text-[var(--app-text)]">{t.title}</span>
                    <span className="shrink-0 tabular-nums text-rose-300">
                      {eur(t.priceEur)} · {t.tageOhneVerkauf}d
                    </span>
                  </li>
                ))}
              </ul>
            </ShopSection>
          ) : null}

          <ShopSection title="Stückkosten & Preisampel">
            <ul className="space-y-3">
              {daten.listings.map((l) => (
                <li key={l.listingId} className="rounded-xl border border-[var(--app-border)] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--app-text)]">{l.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
                        Preis {eur(l.priceEur)} · Mindest {eur(l.marge.mindestpreisEur)} · Netto{' '}
                        <span className={AMPEL[l.marge.ampel]}>{eur(l.marge.nettoEur)} ({zahl(l.marge.margePct, 1)}%)</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-amber-300 hover:underline"
                      onClick={() => {
                        setEditId(editId === l.listingId ? null : l.listingId)
                        setKosten(l.kosten ?? { ...LEER_KOSTEN })
                        setHolzart('')
                      }}
                    >
                      {editId === l.listingId ? 'Schließen' : 'Kosten'}
                    </button>
                  </div>
                  {editId === l.listingId ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {(
                        [
                          ['holzEur', 'Holz €'],
                          ['oelEur', 'Öl €'],
                          ['schleifEur', 'Schleif €'],
                          ['werkzeugEur', 'Werkzeug €'],
                          ['stromEur', 'Strom €'],
                          ['verpackungEur', 'Pack €'],
                          ['sonstigesEur', 'Sonst. €'],
                          ['versandAnteilEur', 'Versand €'],
                          ['arbeitsstunden', 'Stunden'],
                          ['stundensatzEur', '€/h'],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="text-xs text-[var(--app-text-muted)]">
                          {label}
                          <input
                            type="number"
                            step="0.1"
                            value={kosten[key] ?? 0}
                            onChange={(e) => setKosten((k) => ({ ...k, [key]: Number(e.target.value) }))}
                            className="mt-0.5 w-full rounded-lg border border-[var(--app-border)] bg-transparent px-2 py-1 text-sm text-[var(--app-text)]"
                          />
                        </label>
                      ))}
                      <label className="col-span-2 text-xs text-[var(--app-text-muted)] sm:col-span-1">
                        Holzart
                        <input
                          value={holzart}
                          onChange={(e) => setHolzart(e.target.value)}
                          className="mt-0.5 w-full rounded-lg border border-[var(--app-border)] bg-transparent px-2 py-1 text-sm text-[var(--app-text)]"
                        />
                      </label>
                      <div className="col-span-2 flex items-end sm:col-span-3">
                        <button
                          type="button"
                          onClick={() => void speichereKosten(l.listingId, l.title)}
                          className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500"
                        >
                          Speichern
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </ShopSection>
        </>
      ) : null}
    </div>
  )
}
