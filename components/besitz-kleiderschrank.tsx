'use client'

import { normalisiereBesitzKategorie } from '@/lib/besitz-kategorien'
import {
  besitzArtGruppeLabel,
  besitzArtGruppenReihenfolge,
  normalisiereBesitzKleidungsart,
} from '@/lib/besitz-kleidungsarten'
import { useEffect, useMemo, useState } from 'react'
import { besitzFotoSignedUrls } from '@/lib/besitz-foto'

export type BesitzKleiderschrankRow = {
  id: string
  name: string
  kategorie: string
  kleidungsart: string | null
  groesse: string | null
  farbe: string | null
  einkaufspreis_eur: number
  einkaufsdatum: string | null
  haendler: string | null
  hersteller: string | null
  notiz: string | null
  bild_pfad: string | null
}

type Props = {
  zeilen: BesitzKleiderschrankRow[]
  laden: boolean
  onBearbeiten: (z: BesitzKleiderschrankRow) => void
  onLoeschen: (id: string) => void
  formatEur: (n: number) => string
  formatDatumDe: (iso: string | null | undefined) => string
}

function artBadge(art: string | null) {
  if (!art) return 'Ohne Art'
  return art
}

export function BesitzKleiderschrank({ zeilen, laden, onBearbeiten, onLoeschen, formatEur, formatDatumDe }: Props) {
  const [fotoUrls, setFotoUrls] = useState<Record<string, string>>({})

  const kleidungZeilen = useMemo(
    () => zeilen.filter((z) => normalisiereBesitzKategorie(z.kategorie) === 'Kleidung'),
    [zeilen],
  )
  const schuhZeilen = useMemo(
    () => zeilen.filter((z) => normalisiereBesitzKategorie(z.kategorie) === 'Schuhe'),
    [zeilen],
  )

  useEffect(() => {
    const pfade = zeilen.map((z) => z.bild_pfad).filter((p): p is string => Boolean(p))
    if (!pfade.length) {
      setFotoUrls({})
      return
    }
    let cancelled = false
    void besitzFotoSignedUrls(pfade).then((map) => {
      if (!cancelled) setFotoUrls(map)
    })
    return () => {
      cancelled = true
    }
  }, [zeilen])

  function gruppiere(items: BesitzKleiderschrankRow[], kategorie: 'Kleidung' | 'Schuhe') {
    const reihenfolge = besitzArtGruppenReihenfolge(kategorie)
    const buckets = new Map<string, BesitzKleiderschrankRow[]>()
    for (const label of reihenfolge) buckets.set(label, [])
    buckets.set('Ohne Zuordnung', [])

    for (const z of items) {
      const art = normalisiereBesitzKleidungsart(z.kleidungsart, kategorie)
      const gruppe = besitzArtGruppeLabel(art)
      const list = buckets.get(gruppe) ?? buckets.get('Ohne Zuordnung')!
      list.push({ ...z, kleidungsart: art })
    }

    for (const [, list] of buckets) {
      list.sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }))
    }

    const out: { label: string; items: BesitzKleiderschrankRow[] }[] = []
    for (const label of [...reihenfolge, 'Ohne Zuordnung']) {
      const itemsInGruppe = buckets.get(label) ?? []
      if (itemsInGruppe.length) out.push({ label, items: itemsInGruppe })
    }
    return out
  }

  const kleidungGruppen = useMemo(() => gruppiere(kleidungZeilen, 'Kleidung'), [kleidungZeilen])
  const schuhGruppen = useMemo(() => gruppiere(schuhZeilen, 'Schuhe'), [schuhZeilen])

  if (laden) {
    return <p className="py-16 text-center text-[var(--app-text-muted)]">Kleiderschrank wird geladen …</p>
  }

  if (!kleidungZeilen.length && !schuhZeilen.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-6 py-16 text-center">
        <p className="text-base font-semibold text-[var(--app-text)]">Noch kein Kleidung oder Schuhe</p>
        <p className="mt-2 text-sm text-[var(--app-text-muted)]">
          Lege Gegenstände mit Kategorie „Kleidung“ oder „Schuhe“ an — am besten mit Art (T-Shirt, Jeans …) und Foto.
        </p>
      </div>
    )
  }

  function renderKarte(z: BesitzKleiderschrankRow) {
    const thumb = z.bild_pfad ? fotoUrls[z.bild_pfad] : null
    return (
      <article
        key={z.id}
        className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] shadow-sm transition hover:border-amber-500/30 hover:shadow-md"
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--app-surface-muted)]">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]">
              <span className="text-4xl opacity-30">{normalisiereBesitzKategorie(z.kategorie) === 'Schuhe' ? '👟' : '👕'}</span>
              <span className="text-[11px] font-medium uppercase tracking-wide">Kein Foto</span>
            </div>
          )}
          <div className="absolute left-2 top-2">
            <span className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)]/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200/95 backdrop-blur-sm">
              {artBadge(z.kleidungsart)}
            </span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-3">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--app-text)]">{z.name}</p>
          {z.hersteller ? <p className="truncate text-xs text-[var(--app-text-muted)]">{z.hersteller}</p> : null}
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
            {z.groesse ? (
              <span className="rounded-md bg-[var(--app-surface-hover)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--app-text)]">{z.groesse}</span>
            ) : null}
            {z.farbe ? (
              <span className="rounded-md bg-[var(--app-surface-hover)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--app-text)]">{z.farbe}</span>
            ) : null}
          </div>
          <div className="flex items-end justify-between gap-2 pt-2">
            <span className="text-sm font-bold tabular-nums text-amber-200">{formatEur(Number(z.einkaufspreis_eur))}</span>
            <span className="text-[10px] tabular-nums text-[var(--app-text-muted)]">{formatDatumDe(z.einkaufsdatum)}</span>
          </div>
          <div className="mt-1 flex gap-1.5">
            <button
              type="button"
              onClick={() => onBearbeiten(z)}
              className="flex-1 rounded-lg border border-[var(--app-border-strong)] py-1.5 text-[11px] font-semibold text-sky-200 transition hover:bg-sky-500/10"
            >
              Bearbeiten
            </button>
            <button
              type="button"
              onClick={() => onLoeschen(z.id)}
              className="rounded-lg border border-[var(--app-border-strong)] px-2.5 py-1.5 text-[11px] font-semibold text-rose-300/90 transition hover:bg-rose-500/10"
            >
              ×
            </button>
          </div>
        </div>
      </article>
    )
  }

  function renderBereich(
    titel: string,
    emoji: string,
    gruppen: { label: string; items: BesitzKleiderschrankRow[] }[],
  ) {
    if (!gruppen.length) return null
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-3 border-b border-[var(--app-border)] pb-3">
          <span className="text-xl" aria-hidden>
            {emoji}
          </span>
          <h3 className="text-lg font-bold text-[var(--app-text)]">{titel}</h3>
          <span className="text-xs font-semibold text-[var(--app-text-muted)]">
            {gruppen.reduce((n, g) => n + g.items.length, 0)} Teile
          </span>
        </div>
        {gruppen.map((g) => (
          <section key={g.label}>
            <h4 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[var(--app-text-muted)]">
              <span className="h-px flex-1 bg-[var(--app-surface-muted)]/90" />
              {g.label}
              <span className="rounded-full bg-[var(--app-surface-hover)] px-2 py-0.5 text-[10px] tabular-nums text-[var(--app-text-muted)]">{g.items.length}</span>
              <span className="h-px flex-1 bg-[var(--app-surface-muted)]/90" />
            </h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {g.items.map(renderKarte)}
            </div>
          </section>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-12">
      {renderBereich('Kleidung', '👔', kleidungGruppen)}
      {renderBereich('Schuhe', '👟', schuhGruppen)}
    </div>
  )
}
