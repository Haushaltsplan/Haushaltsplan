'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

import { PageChrome, PageHero, pageContainerWideClass } from '@/components/page-shell'
import {
  appCardClass,
  appEmptyClass,
  appGhostBtnClass,
  appInputClass,
  appLoadingClass,
  appSecondaryBtnClass,
} from '@/lib/app-ui'
import {
  berechneSummenProHaendler,
  ladeListeAusStorage,
  parseListenEingabe,
  produktKey,
  speichereListeInStorage,
  suchKey,
  volleBezeichnung,
  type ListenEintrag,
} from '@/lib/angebote/einkaufsliste'
import {
  HAENDLER_LABELS,
  type Angebot,
  type HaendlerId,
  type QuellenStatus,
  type VergleichResponse,
} from '@/lib/angebote/types'

const SCAN_HAENDLER: HaendlerId[] = [
  'rewe',
  'aldi_sued',
  'aldi_nord',
  'edeka',
  'lidl',
  'penny',
  'netto',
  'kaufland',
  'globus',
]

type SortKey = 'preis' | 'grundpreis' | 'haendler' | 'name'

function euro(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function proxiedBild(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  if (url.startsWith('/api/angebote/bild')) return url
  return `/api/angebote/bild?u=${encodeURIComponent(url)}`
}

function statusLabel(s: QuellenStatus) {
  switch (s.status) {
    case 'ok':
      return 'Direkt'
    case 'fallback':
      return 'Marktguru'
    case 'skipped':
      return 'Übersprungen'
    default:
      return 'Fehler'
  }
}

function statusClass(s: QuellenStatus) {
  switch (s.status) {
    case 'ok':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    case 'fallback':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'
    case 'skipped':
      return 'border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]'
    default:
      return 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
  }
}

function ProduktBild({ src, alt }: { src: string | null; alt: string }) {
  const [broken, setBroken] = useState(false)
  const url = proxiedBild(src)
  if (!url || broken) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--app-surface-muted)] text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
        Kein Foto
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className="h-full w-full object-contain p-1.5"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  )
}

export function AngeboteClient() {
  const [plz, setPlz] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('preis')
  const [aktivHaendler, setAktivHaendler] = useState<HaendlerId[]>([...SCAN_HAENDLER])
  const [loading, setLoading] = useState(false)
  const [initial, setInitial] = useState(true)
  const [sucheLoading, setSucheLoading] = useState(false)
  const [data, setData] = useState<VergleichResponse | null>(null)
  const [extraAngebote, setExtraAngebote] = useState<Angebot[]>([])
  const [liste, setListe] = useState<ListenEintrag[]>([])
  const [freitext, setFreitext] = useState('')

  useEffect(() => {
    setListe(ladeListeAusStorage())
  }, [])

  useEffect(() => {
    speichereListeInStorage(liste)
  }, [liste])

  const ladenEinstellungen = useCallback(async () => {
    try {
      const res = await fetch('/api/angebote/einstellungen')
      if (!res.ok) return
      const json = (await res.json()) as {
        einstellung?: { plz?: string } | null
      }
      if (json.einstellung?.plz) setPlz(json.einstellung.plz)
    } catch {
      /* ignore */
    } finally {
      setInitial(false)
    }
  }, [])

  useEffect(() => {
    void ladenEinstellungen()
  }, [ladenEinstellungen])

  const alleAngebote = useMemo(() => {
    const map = new Map<string, Angebot>()
    for (const a of data?.angebote ?? []) map.set(a.id, a)
    for (const a of extraAngebote) map.set(a.id, a)
    return [...map.values()]
  }, [data, extraAngebote])

  const vergleich = useCallback(
    async (force: boolean) => {
      const digits = plz.replace(/\D/g, '')
      if (digits.length !== 5) {
        toast.error('Bitte eine gültige PLZ (5 Ziffern) eingeben.')
        return
      }
      setLoading(true)
      try {
        await fetch('/api/angebote/einstellungen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plz: digits }),
        })
        const res = await fetch('/api/angebote/vergleich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plz: digits,
            force,
            q: q.trim() || undefined,
            haendler: aktivHaendler,
            sort,
          }),
        })
        const json = (await res.json()) as VergleichResponse | { ok: false; error?: string }
        if (!res.ok || !json.ok) {
          toast.error(('error' in json && json.error) || 'Vergleich fehlgeschlagen.')
          return
        }
        setData(json)
        if (force) setExtraAngebote([])
        toast.success(
          json.ausCache
            ? `${json.angebote.length} Angebote aus Cache`
            : `${json.angebote.length} Angebote geladen`,
        )
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Netzwerkfehler')
      } finally {
        setLoading(false)
      }
    },
    [plz, q, aktivHaendler, sort],
  )

  const sucheFuerListe = useCallback(
    async (suchbegriff: string) => {
      const digits = plz.replace(/\D/g, '')
      if (digits.length !== 5) {
        toast.error('Zuerst eine gültige PLZ setzen.')
        return
      }
      setSucheLoading(true)
      try {
        const res = await fetch('/api/angebote/produktsuche', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plz: digits,
            q: suchbegriff,
            haendler: aktivHaendler,
          }),
        })
        const json = (await res.json()) as {
          ok: boolean
          error?: string
          angebote?: Angebot[]
          anzahlKandidaten?: number
        }
        if (!res.ok || !json.ok) {
          toast.error(json.error || 'Produktsuche fehlgeschlagen.')
          return
        }
        setExtraAngebote((prev) => {
          const map = new Map(prev.map((a) => [a.id, a]))
          for (const a of json.angebote ?? []) map.set(a.id, a)
          return [...map.values()]
        })
        toast.success(`${json.anzahlKandidaten ?? 0} Treffer für „${suchbegriff}“`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Suche fehlgeschlagen')
      } finally {
        setSucheLoading(false)
      }
    },
    [plz, aktivHaendler],
  )

  const freitextHinzufuegen = async () => {
    const parsed = parseListenEingabe(freitext)
    if (!parsed) {
      toast.error('Bitte etwas eingeben, z. B. „2x Butter“.')
      return
    }
    const key = suchKey(parsed.suchbegriff)
    setListe((prev) => {
      const existing = prev.find((x) => x.key === key)
      if (existing) {
        return prev.map((x) =>
          x.key === key ? { ...x, menge: x.menge + parsed.menge } : x,
        )
      }
      return [
        ...prev,
        {
          key,
          suchbegriff: parsed.suchbegriff,
          menge: parsed.menge,
          bildUrl: null,
          typ: 'freitext',
        },
      ]
    })
    setFreitext('')
    await sucheFuerListe(parsed.suchbegriff)
  }

  const hinzufuegenAusAngebot = async (a: Angebot) => {
    const begriff = a.marke ? `${a.marke} ${a.name}` : a.name
    const key = suchKey(begriff)
    setListe((prev) => {
      const existing = prev.find((x) => x.key === key || x.key === produktKey(a))
      if (existing) {
        toast.success('Menge erhöht')
        return prev.map((x) =>
          x.key === existing.key ? { ...x, menge: x.menge + 1, bildUrl: a.bildUrl ?? x.bildUrl } : x,
        )
      }
      toast.success('Zur Einkaufsliste')
      return [
        ...prev,
        {
          key,
          suchbegriff: begriff,
          menge: 1,
          bildUrl: a.bildUrl,
          typ: 'angebot',
        },
      ]
    })
    await sucheFuerListe(a.name)
  }

  const setMenge = (key: string, menge: number) => {
    setListe((prev) =>
      prev
        .map((x) => (x.key === key ? { ...x, menge: Math.max(0, menge) } : x))
        .filter((x) => x.menge > 0),
    )
  }

  const summen = useMemo(
    () => berechneSummenProHaendler(liste, alleAngebote, aktivHaendler),
    [liste, alleAngebote, aktivHaendler],
  )
  const guenstigster = summen.find((s) => s.vollstaendig && s.summeEur != null) ?? null
  const teuersterVoll = [...summen]
    .reverse()
    .find((s) => s.vollstaendig && s.summeEur != null)
  const sparEur =
    guenstigster?.summeEur != null &&
    teuersterVoll?.summeEur != null &&
    teuersterVoll.summeEur > guenstigster.summeEur
      ? Math.round((teuersterVoll.summeEur - guenstigster.summeEur) * 100) / 100
      : null

  const angebote: Angebot[] = data?.angebote ?? []
  const listenKeys = useMemo(() => new Set(liste.map((x) => x.key)), [liste])

  return (
    <PageChrome className={pageContainerWideClass}>
      <PageHero
        eyebrow="Haushalt"
        title="Supermarkt-Angebote"
        description="Marke, Foto und Preise vergleichen. Freitext in die Einkaufsliste — je Markt das günstigste passende Produkt."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={appSecondaryBtnClass}
              disabled={loading || initial}
              onClick={() => void vergleich(true)}
            >
              {loading ? 'Lädt…' : 'Aktualisieren'}
            </button>
            <button
              type="button"
              className={appGhostBtnClass}
              disabled={loading || initial}
              onClick={() => void vergleich(false)}
            >
              Vergleichen
            </button>
          </div>
        }
      />

      <section className={`${appCardClass} space-y-4 p-4 sm:p-5`}>
        <div className="grid gap-3 sm:grid-cols-[8rem_1fr_10rem]">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[var(--app-text-muted)]">PLZ</span>
            <input
              className={appInputClass}
              inputMode="numeric"
              maxLength={5}
              placeholder="12345"
              value={plz}
              onChange={(e) => setPlz(e.target.value.replace(/\D/g, '').slice(0, 5))}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[var(--app-text-muted)]">
              Angebote filtern
            </span>
            <input
              className={appInputClass}
              placeholder="z. B. Milch, Käse…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void vergleich(false)
              }}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[var(--app-text-muted)]">Sortierung</span>
            <select
              className={appInputClass}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="preis">Preis</option>
              <option value="grundpreis">Grundpreis</option>
              <option value="haendler">Händler</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {SCAN_HAENDLER.map((h) => {
            const on = aktivHaendler.includes(h)
            return (
              <button
                key={h}
                type="button"
                onClick={() =>
                  setAktivHaendler((prev) =>
                    prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h],
                  )
                }
                className={
                  on
                    ? 'rounded-lg border border-lime-500/50 bg-lime-500/15 px-2.5 py-1 text-xs font-semibold text-lime-800 dark:text-lime-200'
                    : 'rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--app-text-muted)]'
                }
              >
                {HAENDLER_LABELS[h]}
              </button>
            )
          })}
        </div>
      </section>

      {data && data.quellen.length > 0 && (
        <section className={`${appCardClass} space-y-2 p-4`}>
          <h2 className="text-sm font-semibold text-[var(--app-text)]">Quellen-Status</h2>
          <ul className="flex flex-wrap gap-2">
            {data.quellen.map((s) => (
              <li
                key={s.haendler}
                className={`rounded-md border px-2 py-1 text-xs ${statusClass(s)}`}
                title={s.fehler || undefined}
              >
                {HAENDLER_LABELS[s.haendler] ?? s.haendler}: {statusLabel(s)}
                {s.anzahl ? ` (${s.anzahl})` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Einkaufsliste */}
      <section className={`${appCardClass} space-y-4 p-4 sm:p-5`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--app-text)]">Einkaufsliste</h2>
            <p className="text-xs text-[var(--app-text-muted)]">
              Freitext möglich — z. B. „2x Butter“. Pro Markt wird das günstigste passende Produkt
              mit vollem Namen gesucht.
            </p>
          </div>
          {liste.length > 0 && (
            <button
              type="button"
              className={appGhostBtnClass}
              onClick={() => {
                setListe([])
                toast.success('Liste geleert')
              }}
            >
              Liste leeren
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className={appInputClass}
            placeholder="z. B. 2x Butter, Milch, Bananen…"
            value={freitext}
            onChange={(e) => setFreitext(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void freitextHinzufuegen()
            }}
          />
          <button
            type="button"
            className={appSecondaryBtnClass}
            disabled={sucheLoading || !freitext.trim()}
            onClick={() => void freitextHinzufuegen()}
          >
            {sucheLoading ? 'Sucht…' : 'Hinzufügen'}
          </button>
        </div>

        {liste.length === 0 ? (
          <div className={appEmptyClass}>Noch leer — Freitext eingeben oder „+ Liste“ bei einem Angebot.</div>
        ) : (
          <ul className="space-y-2">
            {liste.map((e) => (
              <li
                key={e.key}
                className="flex items-center gap-3 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[var(--app-text)]">
                    {e.menge}× {e.suchbegriff}
                  </div>
                  <div className="text-[11px] text-[var(--app-text-muted)]">
                    Suche je Markt nach dem günstigsten Treffer
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className={appGhostBtnClass}
                    onClick={() => setMenge(e.key, e.menge - 1)}
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-semibold tabular-nums">{e.menge}</span>
                  <button
                    type="button"
                    className={appGhostBtnClass}
                    onClick={() => setMenge(e.key, e.menge + 1)}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className={appGhostBtnClass}
                    disabled={sucheLoading}
                    onClick={() => void sucheFuerListe(e.suchbegriff)}
                  >
                    Neu suchen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {liste.length > 0 && (
          <div className="space-y-3 border-t border-[var(--app-border)] pt-4">
            <h3 className="text-sm font-semibold text-[var(--app-text)]">
              Warenkorb je Supermarkt (günstigstes Produkt)
            </h3>
            <div className="grid gap-3 lg:grid-cols-2">
              {summen.map((s) => {
                const isBest = guenstigster?.haendler === s.haendler && s.vollstaendig
                return (
                  <div
                    key={s.haendler}
                    className={[
                      'rounded-[var(--app-radius-lg)] border p-3',
                      isBest
                        ? 'border-lime-500/60 bg-lime-500/10'
                        : 'border-[var(--app-border)] bg-[var(--app-surface-muted)]',
                    ].join(' ')}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--app-text)]">
                        {s.label}
                        {isBest ? ' · günstigster' : ''}
                      </span>
                      <span className="text-lg font-bold tabular-nums text-[var(--app-text)]">
                        {euro(s.summeEur)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
                      {s.treffer}/{s.gesamt} Positionen gefunden
                      {!s.vollstaendig ? ' · unvollständig' : ''}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {s.positionen.map((p) => (
                        <li key={p.key} className="flex gap-2 text-xs">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)]">
                            <ProduktBild src={p.bildUrl} alt={p.bezeichnung || p.suchbegriff} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-[var(--app-text)]">
                              {p.menge}× {p.suchbegriff}
                            </div>
                            {p.bezeichnung ? (
                              <>
                                {p.marke && (
                                  <div className="text-[10px] font-semibold uppercase tracking-wide text-lime-700 dark:text-lime-300">
                                    {p.marke}
                                  </div>
                                )}
                                <div className="text-[var(--app-text-muted)]">{p.bezeichnung}</div>
                                <div className="tabular-nums text-[var(--app-text)]">
                                  {euro(p.einzelpreisEur)} → {euro(p.preisEur)}
                                </div>
                              </>
                            ) : (
                              <div className="text-rose-600 dark:text-rose-300">
                                Kein Treffer — „Neu suchen“ oder anderes Wort
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
            {sparEur != null && sparEur > 0 && guenstigster && (
              <p className="rounded-lg border border-lime-500/40 bg-lime-500/10 px-3 py-2 text-sm text-lime-900 dark:text-lime-100">
                Du sparst bis zu <strong>{euro(sparEur)}</strong> bei{' '}
                <strong>{guenstigster.label}</strong> gegenüber dem teuersten vollständigen
                Warenkorb.
              </p>
            )}
          </div>
        )}
      </section>

      {loading && !data ? (
        <div className={appLoadingClass}>Angebote werden geladen…</div>
      ) : !data ? (
        <div className={appEmptyClass}>PLZ eingeben und „Aktualisieren“ starten.</div>
      ) : angebote.length === 0 ? (
        <div className={appEmptyClass}>Keine Treffer für die aktuelle Filterung.</div>
      ) : (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--app-text)]">
            Angebote ({angebote.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {angebote.map((a) => {
              const key = suchKey(a.marke ? `${a.marke} ${a.name}` : a.name)
              const inListe = listenKeys.has(key) || listenKeys.has(produktKey(a))
              return (
                <article
                  key={a.id}
                  className="flex gap-3 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-sm"
                >
                  <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-[var(--app-border)] bg-white dark:bg-[var(--app-surface-muted)]">
                    <ProduktBild src={a.bildUrl} alt={volleBezeichnung(a)} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-lime-700 dark:text-lime-300">
                          {a.marke?.trim() || 'Ohne Marke'}
                        </div>
                        <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-[var(--app-text)]">
                          {a.name}
                        </h3>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-base font-bold tabular-nums text-[var(--app-text)]">
                          {euro(a.preisEur)}
                        </div>
                        {a.vorherigerPreisEur != null && (
                          <div className="text-[11px] text-[var(--app-text-muted)] line-through">
                            {euro(a.vorherigerPreisEur)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-[var(--app-text-muted)]">
                      <span>{HAENDLER_LABELS[a.haendler] ?? a.haendler}</span>
                      {a.packungText && <span>· {a.packungText}</span>}
                      {a.grundpreisEur != null && (
                        <span>
                          · {euro(a.grundpreisEur)}/{a.grundpreisEinheit}
                        </span>
                      )}
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <span className="text-[10px] uppercase tracking-wide text-[var(--app-text-muted)]">
                        {a.quelle}
                      </span>
                      <button
                        type="button"
                        className={
                          inListe
                            ? 'rounded-lg border border-lime-500/50 bg-lime-500/15 px-2.5 py-1 text-xs font-semibold text-lime-800 dark:text-lime-200'
                            : appGhostBtnClass
                        }
                        onClick={() => void hinzufuegenAusAngebot(a)}
                      >
                        {inListe ? '+1 Liste' : '+ Liste'}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}
    </PageChrome>
  )
}
