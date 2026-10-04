'use client'

import { ShopKpi, ShopSection, eur, postShop } from '@/components/etsy/etsy-shop-ui'
import type { EtsyWachstumErgebnis } from '@/lib/etsy/etsy-shop-os-types'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

type Props = { verbunden: boolean }

export function EtsyWachstum({ verbunden }: Props) {
  const [daten, setDaten] = useState<EtsyWachstumErgebnis | null>(null)
  const [laden, setLaden] = useState(false)
  const [zitat, setZitat] = useState('')

  const lade = useCallback(async () => {
    if (!verbunden) return
    setLaden(true)
    try {
      const res = await fetch('/api/etsy/wachstum', { cache: 'no-store' })
      const j = (await res.json()) as EtsyWachstumErgebnis & { error?: string }
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
    return <p className="text-sm text-[var(--app-text-muted)]">Etsy verbinden für Wachstum.</p>
  }

  async function toggleStar(key: 'antwortzeitOk' | 'versandfensterOk' | 'caseRateOk' | 'bewertungenOk') {
    if (!daten) return
    const next = { ...daten.starSeller, [key]: !daten.starSeller[key] }
    try {
      await postShop('/api/etsy/wachstum', { action: 'star_seller', starSeller: next })
      void lade()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    }
  }

  return (
    <div className="space-y-4">
      {laden && !daten ? <p className="text-sm text-[var(--app-text-muted)]">Lade Wachstum…</p> : null}
      {daten ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <ShopKpi label="Star-Seller" value={`${daten.starSeller.score}/4`} />
            <ShopKpi label="Review-Aufgaben" value={String(daten.reviewAufgaben.length)} />
            <ShopKpi label="Foto-Hinweise" value={String(daten.fotoHinweise.length)} />
          </div>

          <ShopSection title="Saison-Kampagne">
            {daten.saisonAktiv.length === 0 ? (
              <p className="text-sm text-[var(--app-text-muted)]">Aktuell keine Saison aktiv — Weihnachten ab Oktober.</p>
            ) : (
              <div className="space-y-2">
                {daten.saisonAktiv.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-[var(--app-text)]">
                      {s.name} · Tag <code className="text-amber-300">{s.tag}</code>
                    </p>
                    <button
                      type="button"
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs text-white hover:bg-amber-500"
                      onClick={() =>
                        void postShop('/api/etsy/wachstum', { action: 'saison_seed', saisonId: s.id })
                          .then(() => {
                            toast.success('Board befüllt')
                            void lade()
                          })
                          .catch((e: Error) => toast.error(e.message))
                      }
                    >
                      Listings auf Board
                    </button>
                  </div>
                ))}
              </div>
            )}
            {daten.kampagnen.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {daten.kampagnen.slice(0, 20).map((k) => (
                  <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className={`truncate ${k.erledigt ? 'opacity-50 line-through' : ''}`}>{k.listingTitle}</span>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={k.tagGeplant}
                          onChange={() =>
                            void postShop('/api/etsy/wachstum', {
                              action: 'saison_patch',
                              kampagneId: k.id,
                              patch: { tagGeplant: !k.tagGeplant },
                            }).then(() => lade())
                          }
                        />
                        Tag
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={k.giftFoto}
                          onChange={() =>
                            void postShop('/api/etsy/wachstum', {
                              action: 'saison_patch',
                              kampagneId: k.id,
                              patch: { giftFoto: !k.giftFoto },
                            }).then(() => lade())
                          }
                        />
                        Gift-Foto
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={k.erledigt}
                          onChange={() =>
                            void postShop('/api/etsy/wachstum', {
                              action: 'saison_patch',
                              kampagneId: k.id,
                              patch: { erledigt: !k.erledigt },
                            }).then(() => lade())
                          }
                        />
                        OK
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </ShopSection>

          <ShopSection title="Geschenk-Budgets">
            <div className="grid gap-3 sm:grid-cols-3">
              {daten.geschenkBudgets.map((g) => (
                <div key={g.budget} className="rounded-xl border border-[var(--app-border)] p-3">
                  <p className="text-sm font-medium text-[var(--app-text)]">bis {eur(g.budget)}</p>
                  <ul className="mt-2 space-y-1 text-xs text-[var(--app-text-muted)]">
                    {g.listings.length === 0 ? <li>Keine Treffer</li> : null}
                    {g.listings.map((l) => (
                      <li key={l.listingId}>
                        {l.title.slice(0, 36)} · {eur(l.priceEur)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </ShopSection>

          <ShopSection
            title="Content-Kalender"
            action={
              <button
                type="button"
                className="text-xs text-amber-300 hover:underline"
                onClick={() =>
                  void postShop<{ idee?: string }>('/api/etsy/wachstum', { action: 'content_neu' })
                    .then((r) => {
                      toast.success(r.idee?.slice(0, 80) || 'Idee erstellt')
                      void lade()
                    })
                    .catch((e: Error) => toast.error(e.message))
                }
              >
                + Idee
              </button>
            }
          >
            <ul className="space-y-2">
              {daten.content.map((c) => (
                <li key={c.id} className="rounded-xl border border-[var(--app-border)] p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--app-text-muted)]">{c.kanal}</span>
                    {!c.erledigt ? (
                      <button
                        type="button"
                        className="text-xs text-amber-300 hover:underline"
                        onClick={() =>
                          void postShop('/api/etsy/wachstum', { action: 'content_erledigt', contentId: c.id }).then(() =>
                            lade(),
                          )
                        }
                      >
                        Erledigt
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-300">done</span>
                    )}
                  </div>
                  <p className="mt-1 text-[var(--app-text)]">{c.idee}</p>
                </li>
              ))}
            </ul>
          </ShopSection>

          <ShopSection title="Review-Radar">
            <ul className="space-y-2">
              {daten.reviewAufgaben.map((r) => (
                <li key={r.receiptId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {r.kaeuferName} · Tag {r.tageSeitKauf} · {r.listingTitle.slice(0, 40)}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-amber-300 hover:underline"
                    onClick={() =>
                      void postShop('/api/etsy/wachstum', {
                        action: 'review_fragt',
                        receiptId: r.receiptId,
                        kaeuferName: r.kaeuferName,
                      }).then(() => {
                        toast.success('Als angefragt markiert')
                        void lade()
                      })
                    }
                  >
                    Angefragt
                  </button>
                </li>
              ))}
              {daten.reviewAufgaben.length === 0 ? (
                <p className="text-sm text-[var(--app-text-muted)]">Keine offenen Review-Fenster (10–45 Tage).</p>
              ) : null}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={zitat}
                onChange={(e) => setZitat(e.target.value)}
                placeholder="Review-Zitat für Social Proof"
                className="min-w-[200px] flex-1 rounded-lg border border-[var(--app-border)] bg-transparent px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-500"
                onClick={() =>
                  void postShop('/api/etsy/wachstum', { action: 'review_zitat', zitat, sterne: 5 }).then(() => {
                    setZitat('')
                    toast.success('Zitat gespeichert')
                    void lade()
                  })
                }
              >
                Speichern
              </button>
            </div>
            {daten.reviews.filter((r) => r.zitat).length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs text-[var(--app-text-muted)]">
                {daten.reviews
                  .filter((r) => r.zitat)
                  .slice(0, 5)
                  .map((r) => (
                    <li key={r.id}>„{r.zitat}”</li>
                  ))}
              </ul>
            ) : null}
          </ShopSection>

          <ShopSection title="Foto-Qualität">
            {daten.fotoHinweise.length === 0 ? (
              <p className="text-sm text-[var(--app-text-muted)]">Keine kritischen Foto-Signale.</p>
            ) : (
              <ul className="space-y-2">
                {daten.fotoHinweise.map((f) => (
                  <li key={f.listingId} className="text-sm">
                    <span className="font-medium text-[var(--app-text)]">{f.title.slice(0, 50)}</span>
                    <span className="text-[var(--app-text-muted)]"> — {f.hinweis}</span>
                  </li>
                ))}
              </ul>
            )}
          </ShopSection>

          <ShopSection title="Star-Seller Checkliste">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['antwortzeitOk', 'Antwortzeit'],
                  ['versandfensterOk', 'Versandfenster'],
                  ['caseRateOk', 'Case-Rate'],
                  ['bewertungenOk', 'Bewertungen'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm">
                  <input type="checkbox" checked={Boolean(daten.starSeller[key])} onChange={() => void toggleStar(key)} />
                  {label}
                </label>
              ))}
            </div>
          </ShopSection>

          <ShopSection title="A/B-Tests (leicht)">
            <p className="text-xs text-[var(--app-text-muted)]">
              Variante in SEO setzen, hier starten, nach 14 Tagen Views/Favs/Sales in Zahlen vergleichen.
            </p>
            <ul className="mt-2 space-y-2">
              {daten.abTests.map((a) => (
                <li key={a.id} className="flex justify-between gap-2 text-sm">
                  <span>
                    {a.listingTitle.slice(0, 40)} · {a.variante} {a.aktiv ? '(aktiv)' : ''}
                  </span>
                  {a.aktiv ? (
                    <button
                      type="button"
                      className="text-xs text-amber-300 hover:underline"
                      onClick={() =>
                        void postShop('/api/etsy/wachstum', { action: 'ab_ende', kampagneId: a.id }).then(() => lade())
                      }
                    >
                      Beenden
                    </button>
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
