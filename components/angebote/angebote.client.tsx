'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

import { ProduktBild } from '@/components/angebote/produkt-bild'
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
  listenEintragHatAngebot,
  parseMehrereEingaben,
  produktKey,
  speichereListeInStorage,
  suchKey,
  volleBezeichnung,
  type AbgelehnteTreffer,
  type ListenEintrag,
} from '@/lib/angebote/einkaufsliste'
import { istEigenmarke } from '@/lib/angebote/produkt-match'
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

function statusLabel(s: QuellenStatus) {
  switch (s.status) {
    case 'ok':
      return 'Direkt'
    case 'fallback':
      return 'Marktguru'
    case 'skipped':
      return '—'
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

export function AngeboteClient() {
  const [plz, setPlz] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('preis')
  const [aktivHaendler, setAktivHaendler] = useState<HaendlerId[]>([...SCAN_HAENDLER])
  /** null = alle Märkte; gesetzt = nur Angebote dieses Markts (Katalog + Fokus Warenkorb) */
  const [fokusHaendler, setFokusHaendler] = useState<HaendlerId | null>(null)
  const [loading, setLoading] = useState(false)
  const [initial, setInitial] = useState(true)
  const [sucheLoading, setSucheLoading] = useState(false)
  const [data, setData] = useState<VergleichResponse | null>(null)
  const [extraAngebote, setExtraAngebote] = useState<Angebot[]>([])
  const [liste, setListe] = useState<ListenEintrag[]>([])
  const [freitext, setFreitext] = useState('')
  /** Abgelehnte Treffer → nächster Vorschlag pro Listenpunkt + Markt */
  const [abgelehnt, setAbgelehnt] = useState<AbgelehnteTreffer>({})

  const toggleFokusHaendler = (h: HaendlerId) => {
    setFokusHaendler((prev) => (prev === h ? null : h))
  }

  const ablehnenTreffer = (listenKey: string, haendler: HaendlerId, angebotId: string) => {
    setAbgelehnt((prev) => {
      const byH = { ...(prev[listenKey] ?? {}) }
      const ids = new Set(byH[haendler] ?? [])
      ids.add(angebotId)
      byH[haendler] = [...ids]
      return { ...prev, [listenKey]: byH }
    })
    toast.success('Nächster Vorschlag')
  }

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
      const json = (await res.json()) as { einstellung?: { plz?: string } | null }
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
        toast.success(`${json.angebote.length} Angebote geladen`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Netzwerkfehler')
      } finally {
        setLoading(false)
      }
    },
    [plz, q, aktivHaendler, sort],
  )

  const sucheBatch = useCallback(
    async (begriffe: string[]) => {
      const digits = plz.replace(/\D/g, '')
      if (digits.length !== 5) {
        toast.error('Zuerst eine gültige PLZ setzen.')
        return
      }
      const unique = [...new Set(begriffe.map((b) => b.trim()).filter((b) => b.length >= 2))]
      if (!unique.length) return
      setSucheLoading(true)
      try {
        const res = await fetch('/api/angebote/produktsuche', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plz: digits,
            queries: unique,
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
        toast.success(`${json.anzahlKandidaten ?? 0} Preis-Treffer für ${unique.length} Produkt(e)`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Suche fehlgeschlagen')
      } finally {
        setSucheLoading(false)
      }
    },
    [plz, aktivHaendler],
  )

  const freitextHinzufuegen = async () => {
    const parsed = parseMehrereEingaben(freitext)
    if (!parsed.length) {
      toast.error('z. B. „2x Butter, Bananen, Haribo“')
      return
    }
    setListe((prev) => {
      const next = [...prev]
      for (const p of parsed) {
        const key = suchKey(p.suchbegriff)
        const idx = next.findIndex((x) => x.key === key)
        if (idx >= 0) {
          next[idx] = { ...next[idx]!, menge: next[idx]!.menge + p.menge }
        } else {
          next.push({
            key,
            suchbegriff: p.suchbegriff,
            menge: p.menge,
            bildUrl: null,
            typ: 'freitext',
          })
        }
      }
      return next
    })
    setFreitext('')
    await sucheBatch(parsed.map((p) => p.suchbegriff))
  }

  const listeNeuPreisen = async () => {
    if (!liste.length) return
    await sucheBatch(liste.map((e) => e.suchbegriff))
  }

  const hinzufuegenAusAngebot = async (a: Angebot) => {
    const begriff = a.name
    const key = suchKey(begriff)
    setListe((prev) => {
      const existing = prev.find((x) => x.key === key || x.key === produktKey(a))
      if (existing) {
        return prev.map((x) =>
          x.key === existing.key
            ? { ...x, menge: x.menge + 1, bildUrl: a.bildUrl ?? x.bildUrl }
            : x,
        )
      }
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
    toast.success('Zur Liste')
    await sucheBatch([a.name, a.marke || ''].filter(Boolean))
  }

  const setMenge = (key: string, menge: number) => {
    setListe((prev) =>
      prev
        .map((x) => (x.key === key ? { ...x, menge: Math.max(0, menge) } : x))
        .filter((x) => x.menge > 0),
    )
    if (menge <= 0) {
      setAbgelehnt((prev) => {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const summen = useMemo(
    () => berechneSummenProHaendler(liste, alleAngebote, aktivHaendler, abgelehnt),
    [liste, alleAngebote, aktivHaendler, abgelehnt],
  )
  const guenstigster = summen.find((s) => s.vollstaendig && s.summeEur != null) ?? null
  const teuersterVoll = [...summen]
    .filter((s) => s.vollstaendig && s.summeEur != null)
    .sort((a, b) => (b.summeEur ?? 0) - (a.summeEur ?? 0))[0]
  const sparEur =
    guenstigster?.summeEur != null &&
    teuersterVoll?.summeEur != null &&
    teuersterVoll.summeEur > guenstigster.summeEur
      ? Math.round((teuersterVoll.summeEur - guenstigster.summeEur) * 100) / 100
      : null

  const angebote: Angebot[] = useMemo(() => {
    let list = data?.angebote ?? []
    if (fokusHaendler) list = list.filter((a) => a.haendler === fokusHaendler)
    if (q.trim()) {
      const t = q.trim().toLowerCase()
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(t) ||
          (a.marke && a.marke.toLowerCase().includes(t)) ||
          (a.kategorie && a.kategorie.toLowerCase().includes(t)),
      )
    }
    return list
  }, [data, q, fokusHaendler])

  const listenKeys = useMemo(() => new Set(liste.map((x) => x.key)), [liste])

  const einkaufszettelText = useMemo(() => {
    if (!guenstigster?.vollstaendig) return ''
    const lines = [
      `Einkaufszettel — ${guenstigster.label} (${euro(guenstigster.summeEur)})`,
      '',
      ...guenstigster.positionen.map((p) =>
        p.bezeichnung
          ? `☐ ${p.menge}× ${p.bezeichnung} — ${euro(p.einzelpreisEur)}`
          : `☐ ${p.menge}× ${p.suchbegriff} (nicht gefunden)`,
      ),
      '',
      `Summe: ${euro(guenstigster.summeEur)}`,
    ]
    return lines.join('\n')
  }, [guenstigster])

  return (
    <PageChrome className={pageContainerWideClass}>
      <PageHero
        eyebrow="Einkaufsassistent"
        title="Sparen beim Wocheneinkauf"
        description="Liste tippen → je Markt das passende Angebot (Eigenmarken zuerst) → falsche Treffer ablehnen → sehen, wo du sparst."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={appSecondaryBtnClass}
              disabled={loading || initial}
              onClick={() => void vergleich(true)}
            >
              {loading ? 'Lädt…' : 'Angebote laden'}
            </button>
          </div>
        }
      />

      <section className={`${appCardClass} space-y-3 p-4 sm:p-5`}>
        <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[var(--app-text-muted)]">Deine PLZ</span>
            <input
              className={appInputClass}
              inputMode="numeric"
              maxLength={5}
              placeholder="80331"
              value={plz}
              onChange={(e) => setPlz(e.target.value.replace(/\D/g, '').slice(0, 5))}
            />
          </label>
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[var(--app-text-muted)]">
              Märkte {fokusHaendler ? `· nur ${HAENDLER_LABELS[fokusHaendler]}` : '· alle'}
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFokusHaendler(null)}
                className={
                  fokusHaendler == null
                    ? 'rounded-lg border border-lime-500/50 bg-lime-500/15 px-2.5 py-1 text-xs font-semibold text-lime-800 dark:text-lime-200'
                    : 'rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--app-text-muted)]'
                }
              >
                Alle
              </button>
              {SCAN_HAENDLER.map((h) => {
                const imScan = aktivHaendler.includes(h)
                const fokussiert = fokusHaendler === h
                return (
                  <button
                    key={h}
                    type="button"
                    title={
                      imScan
                        ? 'Klick: nur diesen Markt anzeigen · Doppelklick: aus Scan nehmen'
                        : 'Klick: wieder in Scan aufnehmen'
                    }
                    onClick={() => {
                      if (!imScan) {
                        setAktivHaendler((prev) => [...prev, h])
                        setFokusHaendler(h)
                        return
                      }
                      toggleFokusHaendler(h)
                    }}
                    onDoubleClick={() => {
                      setAktivHaendler((prev) =>
                        prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h],
                      )
                      if (fokusHaendler === h) setFokusHaendler(null)
                    }}
                    className={
                      fokussiert
                        ? 'rounded-lg border border-sky-500/60 bg-sky-500/20 px-2.5 py-1 text-xs font-semibold text-sky-900 dark:text-sky-100'
                        : imScan
                          ? 'rounded-lg border border-lime-500/50 bg-lime-500/15 px-2.5 py-1 text-xs font-semibold text-lime-800 dark:text-lime-200'
                          : 'rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--app-text-muted)]'
                    }
                  >
                    {HAENDLER_LABELS[h]}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-[var(--app-text-muted)]">
              Markt anklicken → nur dessen Angebote. Doppelklick schaltet den Scan ein/aus.
            </p>
          </div>
        </div>
        {data && (
          <div className="flex flex-wrap gap-1.5">
            {data.quellen
              .filter((s) => s.status !== 'skipped')
              .map((s) => {
                const fokussiert = fokusHaendler === s.haendler
                return (
                  <button
                    key={s.haendler}
                    type="button"
                    onClick={() => toggleFokusHaendler(s.haendler)}
                    className={`rounded-md border px-2 py-0.5 text-[10px] ${statusClass(s)} ${
                      fokussiert ? 'ring-2 ring-sky-500/50' : ''
                    }`}
                    title={s.fehler || `Nur ${HAENDLER_LABELS[s.haendler]} anzeigen`}
                  >
                    {HAENDLER_LABELS[s.haendler]} {statusLabel(s)}
                    {s.anzahl ? ` · ${s.anzahl}` : ''}
                  </button>
                )
              })}
          </div>
        )}
      </section>

      {/* Einkaufsliste — Hauptfokus */}
      <section className={`${appCardClass} space-y-4 p-4 sm:p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--app-text)]">1. Einkaufsliste</h2>
            <p className="text-xs text-[var(--app-text-muted)]">
              Mehrere Produkte mit Komma — z. B. <em>2x Butter, Bananen, Haribo</em>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {liste.length > 0 && (
              <>
                <button
                  type="button"
                  className={appSecondaryBtnClass}
                  disabled={sucheLoading}
                  onClick={() => void listeNeuPreisen()}
                >
                  {sucheLoading ? 'Sucht Preise…' : 'Alle Preise aktualisieren'}
                </button>
                <button
                  type="button"
                  className={appGhostBtnClass}
                  onClick={() => {
                    setListe([])
                    setAbgelehnt({})
                    toast.success('Liste geleert')
                  }}
                >
                  Leeren
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className={appInputClass}
            placeholder="2x Butter, Bananen, Haribo…"
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
            Hinzufügen
          </button>
        </div>

        {liste.length === 0 ? (
          <div className={appEmptyClass}>
            Noch nichts auf der Liste — tippe oben deine Produkte oder nutze „+ Liste“ bei einem
            Angebot.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--app-border)] rounded-[var(--app-radius-lg)] border border-[var(--app-border)]">
            {liste.map((e) => {
              const imAngebot = listenEintragHatAngebot(e, alleAngebote, aktivHaendler)
              return (
                <li key={e.key} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--app-text)]">
                        {e.suchbegriff}
                      </span>
                      {imAngebot ? (
                        <span className="rounded bg-lime-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lime-800 dark:text-lime-200">
                          Im Angebot
                        </span>
                      ) : alleAngebote.length > 0 ? (
                        <span className="rounded bg-[var(--app-surface-muted)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--app-text-muted)]">
                          kein Treffer
                        </span>
                      ) : null}
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
                    <span className="w-8 text-center text-sm font-bold tabular-nums">{e.menge}</span>
                    <button
                      type="button"
                      className={appGhostBtnClass}
                      onClick={() => setMenge(e.key, e.menge + 1)}
                    >
                      +
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {liste.length > 0 && (
        <section className={`${appCardClass} space-y-4 p-4 sm:p-5`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--app-text)]">
                2. Wo ist der Warenkorb am günstigsten?
              </h2>
              <p className="text-xs text-[var(--app-text-muted)]">
                Pro Markt: passendes Produkt (Gurke ≠ Essiggurke), Eigenmarken bevorzugt.
                Falsch? „Passt nicht“ → nächster Vorschlag.
              </p>
            </div>
            {guenstigster?.vollstaendig && einkaufszettelText && (
              <button
                type="button"
                className={appGhostBtnClass}
                onClick={async () => {
                  await navigator.clipboard.writeText(einkaufszettelText)
                  toast.success(`Zettel für ${guenstigster.label} kopiert`)
                }}
              >
                Zettel kopieren
              </button>
            )}
          </div>

          {sparEur != null && sparEur > 0 && guenstigster && (
            <div className="rounded-[var(--app-radius-lg)] border border-lime-500/50 bg-lime-500/15 px-4 py-3 text-sm text-lime-950 dark:text-lime-50">
              <strong>Spar-Tipp:</strong> Bei <strong>{guenstigster.label}</strong> zahlst du nur{' '}
              <strong>{euro(guenstigster.summeEur)}</strong> — bis zu{' '}
              <strong>{euro(sparEur)}</strong> weniger als beim teuersten vollständigen Warenkorb (
              {teuersterVoll?.label}).
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            {summen.map((s) => {
              const isBest = guenstigster?.haendler === s.haendler && s.vollstaendig
              const fokussiert = fokusHaendler === s.haendler
              return (
                <div
                  key={s.haendler}
                  className={[
                    'rounded-[var(--app-radius-lg)] border p-3.5',
                    fokussiert
                      ? 'border-sky-500/70 bg-sky-500/10 ring-1 ring-sky-500/40'
                      : isBest
                        ? 'border-lime-500/70 bg-lime-500/10 ring-1 ring-lime-500/30'
                        : 'border-[var(--app-border)] bg-[var(--app-surface-muted)]',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={() => toggleFokusHaendler(s.haendler)}
                    className="flex w-full items-baseline justify-between gap-2 rounded-lg text-left transition hover:opacity-90"
                    title={`Nur ${s.label}-Angebote im Katalog anzeigen`}
                  >
                    <div>
                      <div className="text-base font-semibold text-[var(--app-text)]">
                        {s.label}
                        {isBest ? ' · Empfehlung' : ''}
                        {fokussiert ? ' · gefiltert' : ''}
                      </div>
                      <div className="text-[11px] text-[var(--app-text-muted)]">
                        {s.treffer}/{s.gesamt} gefunden
                        {!s.vollstaendig ? ' · unvollständig' : ''}
                        {' · Klick → Katalog filtern'}
                      </div>
                    </div>
                    <div className="text-xl font-bold tabular-nums text-[var(--app-text)]">
                      {euro(s.summeEur)}
                    </div>
                  </button>
                  <ul className="mt-3 space-y-2.5">
                    {s.positionen.map((p) => (
                      <li
                        key={p.key}
                        className={[
                          'flex gap-2.5 rounded-lg border p-2',
                          p.imAngebot
                            ? 'border-lime-500/50 bg-lime-500/10'
                            : 'border-[var(--app-border)]/80 bg-[var(--app-surface)]/60',
                        ].join(' ')}
                      >
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)]">
                          <ProduktBild src={p.bildUrl} alt={p.bezeichnung || p.suchbegriff} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-[var(--app-text-muted)]">
                              Gesucht: {p.menge}× {p.suchbegriff}
                            </span>
                            {p.imAngebot && (
                              <span className="rounded bg-lime-600/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                Angebot
                                {p.rabattProzent != null ? ` −${p.rabattProzent}%` : ''}
                              </span>
                            )}
                          </div>
                          {p.bezeichnung ? (
                            <>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                {p.marke && (
                                  <span className="text-[11px] font-bold uppercase tracking-wide text-lime-700 dark:text-lime-300">
                                    {p.marke}
                                  </span>
                                )}
                                {p.eigenmarke && (
                                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-100">
                                    Eigenmarke
                                  </span>
                                )}
                              </div>
                              <div className="text-sm font-medium leading-snug text-[var(--app-text)]">
                                {p.angebot?.name}
                              </div>
                              {p.angebot?.packungText && (
                                <div className="text-[11px] text-[var(--app-text-muted)] line-clamp-2">
                                  {p.angebot.packungText}
                                </div>
                              )}
                              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm font-semibold tabular-nums text-[var(--app-text)]">
                                  {euro(p.einzelpreisEur)}
                                  {p.menge > 1 ? ` × ${p.menge} = ${euro(p.preisEur)}` : ''}
                                  {p.angebot?.vorherigerPreisEur != null &&
                                  p.angebot.vorherigerPreisEur > (p.einzelpreisEur ?? 0) ? (
                                    <span className="ml-1.5 text-[11px] font-normal text-[var(--app-text-muted)] line-through">
                                      {euro(p.angebot.vorherigerPreisEur)}
                                    </span>
                                  ) : null}
                                </div>
                                {p.angebot && (
                                  <button
                                    type="button"
                                    className="rounded border border-[var(--app-border)] px-2 py-0.5 text-[11px] font-semibold text-[var(--app-text-muted)] hover:border-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
                                    disabled={!p.hatAlternative}
                                    title={
                                      p.hatAlternative
                                        ? 'Falscher Treffer — nächsten Vorschlag holen'
                                        : 'Kein weiterer Treffer'
                                    }
                                    onClick={() =>
                                      ablehnenTreffer(p.key, s.haendler, p.angebot!.id)
                                    }
                                  >
                                    {p.hatAlternative ? 'Passt nicht' : 'Keine Alternative'}
                                  </button>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="mt-1 text-xs text-rose-600 dark:text-rose-300">
                              {(abgelehnt[p.key]?.[s.haendler]?.length ?? 0) > 0
                                ? 'Keine weiteren Vorschläge — Suche anders formulieren.'
                                : 'Diese Woche nicht im Angebot — „Alle Preise aktualisieren“ oder anderes Wort.'}
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
        </section>
      )}

      {/* Angebotskatalog */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--app-text)]">3. Wochenangebote stöbern</h2>
            <p className="text-xs text-[var(--app-text-muted)]">
              Optional — Produkte direkt auf die Liste.
              {fokusHaendler
                ? ` Angezeigt: nur ${HAENDLER_LABELS[fokusHaendler]}.`
                : ' Markt oben anklicken, um zu filtern.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {fokusHaendler && (
              <button type="button" className={appGhostBtnClass} onClick={() => setFokusHaendler(null)}>
                Alle Märkte
              </button>
            )}
            <input
              className={`${appInputClass} max-w-xs`}
              placeholder="Filter…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {loading && !data ? (
          <div className={appLoadingClass}>Angebote werden geladen…</div>
        ) : !data ? (
          <div className={appEmptyClass}>„Angebote laden“ starten — oder nur die Liste oben nutzen.</div>
        ) : angebote.length === 0 ? (
          <div className={appEmptyClass}>Keine Treffer für den Filter.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {angebote.map((a) => {
              const key = suchKey(a.name)
              const inListe = listenKeys.has(key)
              const eigen = istEigenmarke(a.marke, a.haendler, a.name)
              return (
                <article
                  key={a.id}
                  className="flex gap-3 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3"
                >
                  <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-[var(--app-border)] bg-white dark:bg-[var(--app-surface-muted)]">
                    <ProduktBild src={a.bildUrl} alt={volleBezeichnung(a)} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[11px] font-bold uppercase tracking-wide text-lime-700 dark:text-lime-300">
                            {a.marke?.trim() || 'Eigenmarke / lose'}
                          </span>
                          {eigen && (
                            <span className="rounded bg-lime-500/20 px-1 py-0.5 text-[9px] font-semibold text-lime-800 dark:text-lime-200">
                              sparsam
                            </span>
                          )}
                        </div>
                        <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold text-[var(--app-text)]">
                          {a.name}
                        </h3>
                      </div>
                      <div className="shrink-0 text-right text-base font-bold tabular-nums">
                        {euro(a.preisEur)}
                      </div>
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--app-text-muted)]">
                      {HAENDLER_LABELS[a.haendler]}
                      {a.packungText ? ` · ${a.packungText}` : ''}
                    </div>
                    <button
                      type="button"
                      className={`mt-auto self-end ${inListe ? 'rounded-lg border border-lime-500/50 bg-lime-500/15 px-2.5 py-1 text-xs font-semibold text-lime-800 dark:text-lime-200' : appGhostBtnClass}`}
                      onClick={() => void hinzufuegenAusAngebot(a)}
                    >
                      {inListe ? '+1' : '+ Liste'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </PageChrome>
  )
}
