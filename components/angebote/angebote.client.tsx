'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

import { PageChrome, PageHero, pageContainerWideClass } from '@/components/page-shell'
import {
  appCardClass,
  appDataTableClass,
  appEmptyClass,
  appGhostBtnClass,
  appInputClass,
  appLoadingClass,
  appSecondaryBtnClass,
  appTableFrameClass,
} from '@/lib/app-ui'
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

export function AngeboteClient() {
  const [plz, setPlz] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('preis')
  const [aktivHaendler, setAktivHaendler] = useState<HaendlerId[]>([...SCAN_HAENDLER])
  const [loading, setLoading] = useState(false)
  const [initial, setInitial] = useState(true)
  const [data, setData] = useState<VergleichResponse | null>(null)

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

  const toggleHaendler = (h: HaendlerId) => {
    setAktivHaendler((prev) =>
      prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h],
    )
  }

  const quellenProbleme = useMemo(
    () => (data?.quellen ?? []).filter((q) => q.status === 'failed' || q.status === 'fallback'),
    [data],
  )

  const angebote: Angebot[] = data?.angebote ?? []

  return (
    <PageChrome className={pageContainerWideClass}>
      <PageHero
        eyebrow="Haushalt"
        title="Supermarkt-Angebote"
        description="Regionale Wochenangebote per PLZ vergleichen — Direktquellen zuerst, Marktguru als Fallback."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={appSecondaryBtnClass}
              disabled={loading || initial}
              onClick={() => void vergleich(false)}
            >
              {loading ? 'Lädt…' : 'Vergleichen'}
            </button>
            <button
              type="button"
              className={appGhostBtnClass}
              disabled={loading || initial}
              onClick={() => void vergleich(true)}
            >
              Aktualisieren
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
            <span className="text-xs font-semibold text-[var(--app-text-muted)]">Suche</span>
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
                onClick={() => toggleHaendler(h)}
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

        {data && (
          <p className="text-xs text-[var(--app-text-muted)]">
            Woche {data.woche}
            {data.ausCache ? ' · Cache' : ' · frisch'}
            {' · '}
            {data.angebote.length} Treffer
            {data.erstelltAm
              ? ` · ${new Date(data.erstelltAm).toLocaleString('de-DE')}`
              : ''}
          </p>
        )}
      </section>

      {data && data.quellen.length > 0 && (
        <section className={`${appCardClass} space-y-2 p-4`}>
          <h2 className="text-sm font-semibold text-[var(--app-text)]">Quellen-Status</h2>
          {quellenProbleme.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-200">
              Mindestens eine Quelle nutzt Fallback oder ist ausgefallen — Details per Hover.
            </p>
          )}
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

      {loading && !data ? (
        <div className={appLoadingClass}>Angebote werden geladen…</div>
      ) : !data ? (
        <div className={appEmptyClass}>PLZ eingeben und „Vergleichen“ starten.</div>
      ) : angebote.length === 0 ? (
        <div className={appEmptyClass}>Keine Treffer für die aktuelle Filterung.</div>
      ) : (
        <div className={appTableFrameClass}>
          <div className="app-table-scroll overflow-x-auto">
            <table className={appDataTableClass}>
              <thead>
                <tr>
                  <th>Produkt</th>
                  <th>Händler</th>
                  <th>Packung</th>
                  <th className="text-right">Preis</th>
                  <th className="text-right">Grundpreis</th>
                  <th>Quelle</th>
                </tr>
              </thead>
              <tbody>
                {angebote.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="font-medium text-[var(--app-text)]">{a.name}</div>
                      {a.gueltigBis && (
                        <div className="text-[11px] text-[var(--app-text-muted)]">
                          bis {a.gueltigBis}
                        </div>
                      )}
                    </td>
                    <td>{HAENDLER_LABELS[a.haendler] ?? a.haendler}</td>
                    <td className="text-[var(--app-text-muted)]">{a.packungText || '—'}</td>
                    <td className="text-right tabular-nums">
                      {euro(a.preisEur)}
                      {a.vorherigerPreisEur != null && (
                        <div className="text-[11px] text-[var(--app-text-muted)] line-through">
                          {euro(a.vorherigerPreisEur)}
                        </div>
                      )}
                    </td>
                    <td className="text-right tabular-nums text-[var(--app-text-muted)]">
                      {a.grundpreisEur != null
                        ? `${euro(a.grundpreisEur)}/${a.grundpreisEinheit ?? ''}`
                        : '—'}
                    </td>
                    <td className="text-xs text-[var(--app-text-muted)]">{a.quelle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageChrome>
  )
}
