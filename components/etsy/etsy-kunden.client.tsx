'use client'

import { ShopKpi, ShopSection, eur, postShop, zahl } from '@/components/etsy/etsy-shop-ui'
import type { EtsyKundenErgebnis } from '@/lib/etsy/etsy-shop-os-types'
import { kopiereEtsySmartCopy, type EtsySmartCopyArt } from '@/lib/etsy/etsy-smart-copy'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

function crmArtZuCopy(art: string): EtsySmartCopyArt {
  if (art === 'geschenk_11m') return 'geschenk_11m'
  if (art === 'review') return 'review'
  return 'pflege_30d'
}

type Props = { verbunden: boolean }

export function EtsyKunden({ verbunden }: Props) {
  const [daten, setDaten] = useState<EtsyKundenErgebnis | null>(null)
  const [laden, setLaden] = useState(false)
  const [gravurText, setGravurText] = useState('')
  const [gravurName, setGravurName] = useState('')
  const [msgBetreff, setMsgBetreff] = useState('')
  const [msgPrio, setMsgPrio] = useState('kaufabsicht')

  const lade = useCallback(async () => {
    if (!verbunden) return
    setLaden(true)
    try {
      const res = await fetch('/api/etsy/kunden', { cache: 'no-store' })
      const j = (await res.json()) as EtsyKundenErgebnis & { error?: string }
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
    return <p className="text-sm text-[var(--app-text-muted)]">Etsy verbinden für CRM.</p>
  }

  return (
    <div className="space-y-4">
      {laden && !daten ? <p className="text-sm text-[var(--app-text-muted)]">Lade Kunden…</p> : null}
      {daten ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ShopKpi label="Käufer" value={String(daten.kaeufer.length)} />
            <ShopKpi label="CRM offen" value={String(daten.crmAufgaben.length)} />
            <ShopKpi label="Gravuren" value={String(daten.gravuren.filter((g) => g.status !== 'fertig').length)} />
            <ShopKpi label="Inbox" value={String(daten.nachrichten.filter((n) => !n.erledigt).length)} />
          </div>

          <ShopSection title="Follow-ups">
            {daten.crmAufgaben.length === 0 ? (
              <p className="text-sm text-[var(--app-text-muted)]">Keine fälligen Sequenzen.</p>
            ) : (
              <ul className="space-y-2">
                {daten.crmAufgaben.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--app-border)] p-3 text-sm">
                    <div>
                      <p className="font-medium text-[var(--app-text)]">
                        {a.kaeuferName} · {a.art}
                      </p>
                      <p className="text-xs text-[var(--app-text-muted)]">
                        fällig {a.faelligAm} — {a.text}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-xs text-sky-300 hover:underline"
                        onClick={() =>
                          void kopiereEtsySmartCopy(crmArtZuCopy(a.art), {
                            kaeufer_name: a.kaeuferName,
                            holzart: daten.kaeufer.find((k) => k.key === a.kaeuferKey)?.holzVorlieben[0],
                          }).then(() => toast.success('Nachricht kopiert — in Etsy einfügen'))
                        }
                      >
                        Smart Copy
                      </button>
                      <button
                        type="button"
                        className="text-xs text-amber-300 hover:underline"
                        onClick={() =>
                          void postShop('/api/etsy/kunden', { action: 'crm_erledigt', id: a.id }).then(() => lade())
                        }
                      >
                        Erledigt
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ShopSection>

          <ShopSection title="Käufer">
            <ul className="space-y-2">
              {daten.kaeufer.slice(0, 25).map((k) => (
                <li key={k.key} className="rounded-xl border border-[var(--app-border)] p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium text-[var(--app-text)]">{k.name}</span>
                    <span className="tabular-nums text-[var(--app-text-muted)]">
                      {zahl(k.kaeufe)}× · {eur(k.umsatzEur)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
                    {k.landIso || '—'}
                    {k.holzVorlieben.length ? ` · ${k.holzVorlieben.join(', ')}` : ''}
                    {k.letzteKaufAt ? ` · zuletzt ${k.letzteKaufAt.slice(0, 10)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </ShopSection>

          <ShopSection title="Gravur / Personalisierung">
            <div className="flex flex-wrap gap-2">
              <input
                value={gravurName}
                onChange={(e) => setGravurName(e.target.value)}
                placeholder="Käufer"
                className="rounded-lg border border-[var(--app-border)] bg-transparent px-2 py-1.5 text-sm"
              />
              <input
                value={gravurText}
                onChange={(e) => setGravurText(e.target.value)}
                placeholder="Textwunsch"
                className="min-w-[160px] flex-1 rounded-lg border border-[var(--app-border)] bg-transparent px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-500"
                onClick={() =>
                  void postShop('/api/etsy/kunden', {
                    action: 'gravur_neu',
                    gravur: { kaeuferName: gravurName, textWunsch: gravurText, aufschlagEur: 15 },
                  }).then(() => {
                    setGravurName('')
                    setGravurText('')
                    toast.success('Gravur erfasst (+15 € Default)')
                    void lade()
                  })
                }
              >
                + Gravur
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              {daten.gravuren.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {g.kaeuferName}: „{g.textWunsch}” · +{eur(g.aufschlagEur)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-xs text-sky-300 hover:underline"
                      onClick={() =>
                        void kopiereEtsySmartCopy('gravur_bestaetigung', {
                          kaeufer_name: g.kaeuferName,
                          gravur_text: g.textWunsch,
                          aufschlag_eur: g.aufschlagEur,
                          receipt_id: g.receiptId ?? undefined,
                        }).then(() => toast.success('Gravur-Text kopiert'))
                      }
                    >
                      Smart Copy
                    </button>
                    <select
                      value={g.status}
                      onChange={(e) =>
                        void postShop('/api/etsy/kunden', {
                          action: 'gravur_status',
                          id: g.id,
                          gravur: { status: e.target.value },
                        }).then(() => lade())
                      }
                      className="rounded-lg border border-[var(--app-border)] bg-transparent px-2 py-1 text-xs"
                    >
                      {['offen', 'skizze', 'fertig', 'abgelehnt'].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
            </ul>
          </ShopSection>

          {daten.receiptNachrichten.length > 0 ? (
            <ShopSection title="Käufertexte aus Bestellungen">
              <p className="text-xs text-[var(--app-text-muted)]">{daten.conversationsHinweis}</p>
              <ul className="mt-2 space-y-2">
                {daten.receiptNachrichten.map((r) => (
                  <li key={r.receiptId} className="rounded-xl border border-[var(--app-border)] p-3 text-sm">
                    <p className="font-medium text-[var(--app-text)]">
                      {r.kaeuferName} · #{r.receiptId}
                    </p>
                    {r.messageFromBuyer ? (
                      <p className="mt-1 text-[var(--app-text-muted)]">Käufer: {r.messageFromBuyer}</p>
                    ) : null}
                    {r.giftMessage ? (
                      <p className="mt-1 text-[var(--app-text-muted)]">Geschenk: {r.giftMessage}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </ShopSection>
          ) : null}

          <ShopSection title="Inbox-Triage">
            <p className="text-xs text-[var(--app-text-muted)]">{daten.conversationsHinweis}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <select
                value={msgPrio}
                onChange={(e) => setMsgPrio(e.target.value)}
                className="rounded-lg border border-[var(--app-border)] bg-transparent px-2 py-1.5 text-sm"
              >
                <option value="kaufabsicht">Kaufabsicht</option>
                <option value="hoch">Hoch</option>
                <option value="mittel">Mittel</option>
                <option value="niedrig">Niedrig</option>
              </select>
              <input
                value={msgBetreff}
                onChange={(e) => setMsgBetreff(e.target.value)}
                placeholder="Betreff / Kurznotiz"
                className="min-w-[160px] flex-1 rounded-lg border border-[var(--app-border)] bg-transparent px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-500"
                onClick={() =>
                  void postShop('/api/etsy/kunden', {
                    action: 'nachricht_neu',
                    nachricht: { prioritaet: msgPrio, betreff: msgBetreff },
                  }).then(() => {
                    setMsgBetreff('')
                    void lade()
                  })
                }
              >
                + Notiz
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              {daten.nachrichten
                .filter((n) => !n.erledigt)
                .map((n) => (
                  <li key={n.id} className="flex justify-between gap-2 text-sm">
                    <span>
                      <span className="text-amber-300">{n.prioritaet}</span> — {n.betreff}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-amber-300 hover:underline"
                      onClick={() =>
                        void postShop('/api/etsy/kunden', { action: 'nachricht_erledigt', id: n.id }).then(() => lade())
                      }
                    >
                      Erledigt
                    </button>
                  </li>
                ))}
            </ul>
          </ShopSection>
        </>
      ) : null}
    </div>
  )
}
