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
  const [gemeinkosten, setGemeinkosten] = useState(12)
  const [mwst, setMwst] = useState(19)
  const [preisBrutto, setPreisBrutto] = useState(true)

  const lade = useCallback(async () => {
    if (!verbunden) return
    setLaden(true)
    try {
      const res = await fetch('/api/etsy/geld', { cache: 'no-store' })
      const j = (await res.json()) as EtsyGeldErgebnis & { error?: string }
      if (!res.ok) throw new Error(j.error || 'Laden fehlgeschlagen')
      setDaten(j)
      setZielMarge(j.einstellungen.zielMargePct)
      setGemeinkosten(j.einstellungen.gemeinkostenAufschlagPct)
      setMwst(j.einstellungen.mwstSatzPct)
      setPreisBrutto(j.einstellungen.preisIstBrutto)
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
      await postShop('/api/etsy/geld', {
        action: 'einstellungen',
        einstellungen: {
          zielMargePct: zielMarge,
          gemeinkostenAufschlagPct: gemeinkosten,
          mwstSatzPct: mwst,
          preisIstBrutto: preisBrutto,
        },
      })
      toast.success('Kalkulation gespeichert')
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
            <ShopKpi
              label="Gebühren 30d"
              value={eur(daten.pnl.gebuehrenEcht30 ?? daten.pnl.gebuehren30)}
              hint={
                daten.pnl.gebuehrenEcht30 != null
                  ? `Echt · Modell ${eur(daten.pnl.gebuehren30)}`
                  : 'Modell (Ledger syncen)'
              }
            />
            <ShopKpi label="Material+Arbeit" value={eur(daten.pnl.material30)} />
            <ShopKpi label="Netto 30d" value={eur(daten.pnl.netto30)} hint="nach Gebühren & Kosten" />
          </div>

          <ShopSection
            title="Etsy Fee-Ledger (echt)"
            action={
              <button
                type="button"
                className="text-xs text-amber-300 hover:underline"
                onClick={() =>
                  void postShop('/api/etsy/geld', { action: 'ledger_sync' })
                    .then(() => {
                      toast.success('Ledger synchronisiert')
                      void lade()
                    })
                    .catch((e: Error) => toast.error(e.message))
                }
              >
                Sync Ledger
              </button>
            }
          >
            {daten.feeLedger ? (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <ShopKpi label="Echte Fees 30d" value={eur(daten.feeLedger.fees30Eur)} />
                  <ShopKpi label="Gross Payments" value={eur(daten.feeLedger.gross30Eur)} />
                  <ShopKpi label="Net Payments" value={eur(daten.feeLedger.net30Eur)} />
                  <ShopKpi
                    label="Δ vs Modell"
                    value={eur(daten.feeLedger.vergleichModell.deltaEur)}
                    hint={daten.feeLedger.vergleichModell.hinweis}
                  />
                </div>
                <ul className="mt-3 space-y-1 text-xs text-[var(--app-text-muted)]">
                  {daten.feeLedger.letzteEintraege.slice(0, 8).map((e) => (
                    <li key={e.entryId} className="flex justify-between gap-2">
                      <span className="truncate">
                        {e.description || e.entryType || `#${e.entryId}`}
                      </span>
                      <span className="shrink-0 tabular-nums">{eur(e.amountEur)}</span>
                    </li>
                  ))}
                  {daten.feeLedger.letzteEintraege.length === 0 ? (
                    <li>Noch keine Einträge — Sync oder Migration prüfen.</li>
                  ) : null}
                </ul>
              </>
            ) : (
              <p className="text-sm text-[var(--app-text-muted)]">Ledger noch nicht geladen.</p>
            )}
          </ShopSection>
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
            title="Kalkulation (Marge · Gemeinkosten · MwSt)"
            action={
              <button type="button" onClick={() => void speichereMarge()} className="text-xs text-amber-300 hover:underline">
                Speichern
              </button>
            }
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="text-xs text-[var(--app-text-muted)]">
                Zielmarge %
                <input
                  type="number"
                  min={10}
                  max={90}
                  value={zielMarge}
                  onChange={(e) => setZielMarge(Number(e.target.value))}
                  className="mt-0.5 w-full rounded-lg border border-[var(--app-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--app-text)]"
                />
              </label>
              <label className="text-xs text-[var(--app-text-muted)]">
                Gemeinkosten %
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={gemeinkosten}
                  onChange={(e) => setGemeinkosten(Number(e.target.value))}
                  className="mt-0.5 w-full rounded-lg border border-[var(--app-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--app-text)]"
                />
              </label>
              <label className="text-xs text-[var(--app-text-muted)]">
                MwSt %
                <input
                  type="number"
                  min={0}
                  max={25}
                  value={mwst}
                  onChange={(e) => setMwst(Number(e.target.value))}
                  className="mt-0.5 w-full rounded-lg border border-[var(--app-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--app-text)]"
                />
              </label>
              <label className="flex items-end gap-2 pb-1.5 text-xs text-[var(--app-text-muted)]">
                <input type="checkbox" checked={preisBrutto} onChange={(e) => setPreisBrutto(e.target.checked)} />
                Preis inkl. MwSt
              </label>
            </div>
            <p className="mt-2 text-xs text-[var(--app-text-muted)]">
              Gemeinkosten = Verschnitt/Risse/Werkstatt auf Material+Arbeit. Marge auf Netto-Erlös (MwSt herausgerechnet).
              Kleinunternehmer: MwSt 0. Fees weiterhin auf Brutto-Transaktion.
            </p>
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
