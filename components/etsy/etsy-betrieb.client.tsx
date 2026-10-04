'use client'

import { ShopKpi, ShopSection, eur, postShop, zahl } from '@/components/etsy/etsy-shop-ui'
import type { EtsyBestellStatus } from '@/lib/etsy/etsy-shop-os-types'
import { kopiereEtsySmartCopy } from '@/lib/etsy/etsy-smart-copy'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

type Bestellung = {
  receiptId: number
  listingTitle: string
  status: EtsyBestellStatus
  kaeuferName: string
  landIso: string | null
  stadt: string | null
  plz: string | null
  adresse: string
  betragEur: number | null
  menge: number
  isShipped: boolean
  gewichtG: number | null
  masseText: string | null
  zollHinweis: string
  notiz: string
  messageFromBuyer?: string
  giftMessage?: string
  gekauftAt: string | null
}

type Daten = {
  sync: { anzahl: number; fehler?: string }
  bestellungen: Bestellung[]
  vorlagen: Array<{ id: string; schluessel: string; titel: string; text: string }>
  rohholz: Array<{
    id: string
    holzart: string
    beschreibung: string
    status: string
    kostenEur: number | null
    notiz: string
  }>
}

const STATUS: EtsyBestellStatus[] = ['neu', 'fertigung', 'verpacken', 'versendet', 'erledigt', 'problem']
const STATUS_LABEL: Record<EtsyBestellStatus, string> = {
  neu: 'Neu',
  fertigung: 'Fertigung',
  verpacken: 'Verpacken',
  versendet: 'Versendet',
  erledigt: 'Erledigt',
  problem: 'Problem',
}

type Props = { verbunden: boolean }

export function EtsyBetrieb({ verbunden }: Props) {
  const [daten, setDaten] = useState<Daten | null>(null)
  const [laden, setLaden] = useState(false)
  const [holzart, setHolzart] = useState('')
  const [holzKosten, setHolzKosten] = useState(20)

  const lade = useCallback(async () => {
    if (!verbunden) return
    setLaden(true)
    try {
      const res = await fetch('/api/etsy/betrieb', { cache: 'no-store' })
      const j = (await res.json()) as Daten & { error?: string }
      if (!res.ok) throw new Error(j.error || 'Laden fehlgeschlagen')
      setDaten(j)
      if (j.sync?.fehler === 'scope') toast.error('Receipts: Etsy neu verbinden (Scope).')
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
    return <p className="text-sm text-[var(--app-text-muted)]">Etsy verbinden für Bestell-Pipeline.</p>
  }

  const offen = daten?.bestellungen.filter((b) => !['erledigt', 'versendet'].includes(b.status)).length ?? 0

  async function setStatus(b: Bestellung, status: EtsyBestellStatus) {
    try {
      await postShop('/api/etsy/betrieb', { action: 'status', receiptId: b.receiptId, status })
      void lade()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    }
  }

  async function rohholzNeu() {
    if (!holzart.trim()) return
    try {
      await postShop('/api/etsy/betrieb', {
        action: 'rohholz_neu',
        rohholz: { holzart: holzart.trim(), kostenEur: holzKosten, status: 'gekauft' },
      })
      setHolzart('')
      toast.success('Rohholz erfasst')
      void lade()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    }
  }

  return (
    <div className="space-y-4">
      {laden && !daten ? <p className="text-sm text-[var(--app-text-muted)]">Lade Betrieb…</p> : null}
      {daten ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <ShopKpi label="Offene Aufträge" value={String(offen)} />
            <ShopKpi label="Sync" value={String(daten.sync.anzahl)} hint="Receipts geladen" />
            <ShopKpi label="Rohholz bereit" value={String(daten.rohholz.filter((r) => r.status === 'bereit').length)} />
          </div>

          <ShopSection
            title="Bestell-Pipeline"
            action={
              <button
                type="button"
                className="text-xs text-amber-300 hover:underline"
                onClick={() => void postShop('/api/etsy/betrieb', { action: 'sync' }).then(() => lade())}
              >
                Neu syncen
              </button>
            }
          >
            {daten.bestellungen.length === 0 ? (
              <p className="text-sm text-[var(--app-text-muted)]">Keine Bestellungen im Fenster.</p>
            ) : (
              <ul className="space-y-3">
                {daten.bestellungen.map((b) => (
                  <li key={b.receiptId} className="rounded-xl border border-[var(--app-border)] p-3">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-[var(--app-text)]">
                          {b.kaeuferName || 'Käufer'} · {eur(b.betragEur)}
                        </p>
                        <p className="text-xs text-[var(--app-text-muted)]">
                          {b.listingTitle || '—'} · {[b.plz, b.stadt, b.landIso].filter(Boolean).join(' ')}
                        </p>
                        {b.zollHinweis ? <p className="mt-1 text-xs text-amber-300">{b.zollHinweis}</p> : null}
                        {b.adresse ? <p className="mt-1 text-xs text-[var(--app-text-muted)]">{b.adresse}</p> : null}
                        {b.messageFromBuyer ? (
                          <p className="mt-1 text-xs text-sky-200">Käufer: {b.messageFromBuyer}</p>
                        ) : null}
                        {b.giftMessage ? (
                          <p className="mt-1 text-xs text-sky-200">Geschenk: {b.giftMessage}</p>
                        ) : null}
                      </div>
                      <select
                        value={b.status}
                        onChange={(e) => void setStatus(b, e.target.value as EtsyBestellStatus)}
                        className="rounded-lg border border-[var(--app-border)] bg-transparent px-2 py-1 text-xs"
                      >
                        {STATUS.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <p className="text-[11px] text-[var(--app-text-muted)]">
                        Packcheck: Menge {zahl(b.menge)}
                        {b.gewichtG != null ? ` · ${b.gewichtG} g` : ' · Gewicht fehlt'}
                        {b.masseText ? ` · ${b.masseText}` : ''}
                      </p>
                      <button
                        type="button"
                        className="text-[11px] text-sky-300 hover:underline"
                        onClick={() =>
                          void kopiereEtsySmartCopy('unterwegs', {
                            kaeufer_name: b.kaeuferName,
                            bestellung_id: b.receiptId,
                            listing_title: b.listingTitle,
                          }).then(() => toast.success('Versand-Text kopiert'))
                        }
                      >
                        Smart Copy Versand
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ShopSection>

          <ShopSection title="Versand-Texte (1-Klick kopieren)">
            <ul className="space-y-2">
              {daten.vorlagen.map((v) => (
                <li key={v.id} className="rounded-xl border border-[var(--app-border)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--app-text)]">{v.titel}</p>
                    <button
                      type="button"
                      className="text-xs text-amber-300 hover:underline"
                      onClick={() => {
                        void navigator.clipboard.writeText(v.text)
                        toast.success('Kopiert')
                      }}
                    >
                      Kopieren
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-[var(--app-text-muted)]">{v.text}</p>
                </li>
              ))}
            </ul>
          </ShopSection>

          <ShopSection title="Rohholz-Pipeline">
            <div className="flex flex-wrap gap-2">
              <input
                value={holzart}
                onChange={(e) => setHolzart(e.target.value)}
                placeholder="Holzart"
                className="rounded-lg border border-[var(--app-border)] bg-transparent px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                value={holzKosten}
                onChange={(e) => setHolzKosten(Number(e.target.value))}
                className="w-24 rounded-lg border border-[var(--app-border)] bg-transparent px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => void rohholzNeu()}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-500"
              >
                Blank erfassen
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              {daten.rohholz.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {r.holzart} · <span className="text-[var(--app-text-muted)]">{r.status}</span>
                    {r.kostenEur != null ? ` · ${eur(r.kostenEur)}` : ''}
                  </span>
                  <select
                    value={r.status}
                    onChange={(e) =>
                      void postShop('/api/etsy/betrieb', {
                        action: 'rohholz_status',
                        rohholz: { id: r.id, status: e.target.value },
                      }).then(() => lade())
                    }
                    className="rounded-lg border border-[var(--app-border)] bg-transparent px-2 py-1 text-xs"
                  >
                    {['gekauft', 'trocknung', 'bereit', 'verarbeitet', 'verworfen'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </ShopSection>
        </>
      ) : null}
    </div>
  )
}
