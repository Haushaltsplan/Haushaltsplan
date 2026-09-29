'use client'

import { CHART, CHART_AXIS, CHART_GRID } from '@/lib/chart-theme'
import type { EtsyKonkurrenzErgebnis, EtsyKonkurrenzShop } from '@/lib/etsy/etsy-konkurrenz-types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'

type Modus = 'zuwachs' | 'gesamt'
type Zeitraum = 30 | 90 | 365

const FARBEN = [
  CHART.sky,
  CHART.violet,
  CHART.rose,
  CHART.emerald,
  '#f472b6',
  '#60a5fa',
  '#c084fc',
  '#2dd4bf',
  '#fb923c',
  '#a3e635',
]
const EIGEN_FARBE = CHART.amber

function zahl(n: number | null | undefined, stellen = 0) {
  return n == null ? '—' : n.toLocaleString('de-DE', { maximumFractionDigits: stellen })
}

function tagKurz(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}.${m}.`
}

export function EtsyKonkurrenz() {
  const [daten, setDaten] = useState<EtsyKonkurrenzErgebnis | null>(null)
  const [laden, setLaden] = useState(true)
  const [busy, setBusy] = useState(false)
  const [modus, setModus] = useState<Modus>('zuwachs')
  const [zeitraum, setZeitraum] = useState<Zeitraum>(90)
  const [ausgeblendet, setAusgeblendet] = useState<Set<number>>(new Set())

  const lade = useCallback(async (tage: Zeitraum) => {
    setLaden(true)
    try {
      const res = await fetch(`/api/etsy/konkurrenz?tage=${tage}`, { cache: 'no-store' })
      const j = (await res.json()) as EtsyKonkurrenzErgebnis & { error?: string }
      if (!res.ok) throw new Error(j.error || 'Laden fehlgeschlagen')
      setDaten(j)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Konkurrenz-Daten nicht geladen.')
    } finally {
      setLaden(false)
    }
  }, [])

  useEffect(() => {
    void lade(zeitraum)
  }, [lade, zeitraum])

  async function aktualisieren(neuEntdecken: boolean) {
    setBusy(true)
    try {
      const res = await fetch('/api/etsy/konkurrenz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ neuEntdecken }),
      })
      const j = (await res.json()) as { error?: string; lauf?: { snapshots: number; entdeckt: boolean } }
      if (!res.ok) throw new Error(j.error || 'Aktualisieren fehlgeschlagen')
      toast.success(
        j.lauf?.entdeckt
          ? `Top-Shops ermittelt — ${j.lauf.snapshots} Shops erfasst.`
          : `${j.lauf?.snapshots ?? 0} Shops aktualisiert.`,
      )
      await lade(zeitraum)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setBusy(false)
    }
  }

  const shops = useMemo(() => daten?.shops ?? [], [daten])
  const farbe = useMemo(() => {
    const m = new Map<number, string>()
    let i = 0
    for (const s of shops) m.set(s.shopId, s.eigener ? EIGEN_FARBE : FARBEN[i++ % FARBEN.length])
    return m
  }, [shops])

  const chartDaten = useMemo(() => {
    const verlauf = daten?.verlauf ?? []
    if (modus === 'gesamt') return verlauf
    const start = new Map<string, number>()
    return verlauf.map((p) => {
      const out: Record<string, number | string | null> = { tag: p.tag }
      for (const s of shops) {
        const k = String(s.shopId)
        const v = p[k]
        if (typeof v !== 'number') continue
        if (!start.has(k)) start.set(k, v)
        out[k] = v - (start.get(k) ?? v)
      }
      return out
    })
  }, [daten, modus, shops])

  const namen = useMemo(() => new Map(shops.map((s) => [String(s.shopId), s.name])), [shops])
  const max30 = Math.max(1, ...shops.map((s) => s.plus30 ?? s.seitStart ?? 0))
  const hatVerlauf = (daten?.verlauf.length ?? 0) >= 2

  function umschalten(id: number) {
    setAusgeblendet((alt) => {
      const neu = new Set(alt)
      if (neu.has(id)) neu.delete(id)
      else neu.add(id)
      return neu
    })
  }

  return (
    <section className="app-section-shell">
      <div className="app-surface-card-header flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-[var(--app-text)]">Konkurrenz-Verkaufschart</h2>
          <p className="text-xs text-[var(--app-text-muted)]">
            Die 10 größten deutschen Etsy-Shops für gedrechselte Schalen — täglich gemessen.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void aktualisieren(false)}
          className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] disabled:opacity-60"
        >
          {busy ? 'Läuft… (bis 1 Min.)' : 'Jetzt messen'}
        </button>
      </div>

      <div className="space-y-4 px-4 py-3 sm:px-5 sm:py-4">
        {laden && !daten ? (
          <p className="text-sm text-[var(--app-text-muted)]">Lade Konkurrenz-Daten…</p>
        ) : shops.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--app-border)] p-4 text-sm text-[var(--app-text-muted)]">
            <p>
              Noch keine Konkurrenten erfasst. Die App sucht auf Etsy nach deutschen Shops, die viele gedrechselte
              Schalen anbieten, und nimmt die 10 mit den meisten Verkäufen. Danach wird jeden Morgen automatisch
              gemessen.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void aktualisieren(true)}
              className="mt-3 rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-60"
            >
              {busy ? 'Suche Shops… (bis 1 Min.)' : 'Top-Shops jetzt ermitteln'}
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {(
                [
                  ['zuwachs', 'Neue Verkäufe im Zeitraum'],
                  ['gesamt', 'Verkäufe gesamt'],
                ] as const
              ).map(([id, text]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setModus(id)}
                  className={`rounded-full border px-3 py-1 ${
                    modus === id
                      ? 'border-sky-500/60 bg-sky-500/15 text-sky-100'
                      : 'border-[var(--app-border)] text-[var(--app-text-muted)]'
                  }`}
                >
                  {text}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-[var(--app-border)]" />
              {([30, 90, 365] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setZeitraum(t)}
                  className={`rounded-full border px-2.5 py-1 ${
                    zeitraum === t
                      ? 'border-sky-500/60 bg-sky-500/15 text-sky-100'
                      : 'border-[var(--app-border)] text-[var(--app-text-muted)]'
                  }`}
                >
                  {t === 365 ? '1 Jahr' : `${t} Tage`}
                </button>
              ))}
            </div>

            {hatVerlauf ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartDaten} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                    <CartesianGrid stroke={CHART_GRID} vertical={false} />
                    <XAxis dataKey="tag" tickFormatter={tagKurz} stroke={CHART_AXIS} tick={{ fontSize: 11 }} minTickGap={24} />
                    <YAxis
                      stroke={CHART_AXIS}
                      tick={{ fontSize: 11 }}
                      width={56}
                      tickFormatter={(v: number) => v.toLocaleString('de-DE')}
                      domain={modus === 'gesamt' ? ['auto', 'auto'] : [0, 'auto']}
                    />
                    <Tooltip
                      content={(p: TooltipContentProps) => (
                        <ChartTooltip {...p} namen={namen} mitPlus={modus === 'zuwachs'} />
                      )}
                    />
                    {shops
                      .filter((s) => !ausgeblendet.has(s.shopId))
                      .map((s) => (
                        <Line
                          key={s.shopId}
                          type="monotone"
                          dataKey={String(s.shopId)}
                          stroke={farbe.get(s.shopId)}
                          strokeWidth={s.eigener ? 3 : 1.75}
                          dot={false}
                          connectNulls
                          isAnimationActive={false}
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-100">
                Erste Messung gespeichert ({daten?.letzterSnapshot ? tagKurz(daten.letzterSnapshot) : 'heute'}). Der
                Verlauf erscheint ab der zweiten Messung — morgen früh automatisch. Die Gesamtzahlen unten stimmen
                schon.
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--app-border)] text-left text-xs text-[var(--app-text-muted)]">
                    <th className="py-2 pr-2 font-medium">#</th>
                    <th className="py-2 pr-2 font-medium">Shop</th>
                    <th className="py-2 pr-2 text-right font-medium">Verkäufe gesamt</th>
                    <th className="py-2 pr-2 font-medium">Letzte 30 Tage</th>
                    <th className="py-2 pr-2 text-right font-medium">7 Tage</th>
                    <th className="py-2 pr-2 text-right font-medium">Ø / Tag</th>
                    <th className="py-2 text-right font-medium">Bewertung</th>
                  </tr>
                </thead>
                <tbody>
                  {shops.map((s, i) => (
                    <ShopZeile
                      key={s.shopId}
                      rang={i + 1}
                      shop={s}
                      farbe={farbe.get(s.shopId) ?? CHART.sky}
                      aus={ausgeblendet.has(s.shopId)}
                      onToggle={() => umschalten(s.shopId)}
                      max30={max30}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
              <p>
                Klick auf einen Shop blendet ihn im Chart ein/aus. Dein eigener Shop ist{' '}
                <span style={{ color: EIGEN_FARBE }}>gelb</span> hervorgehoben.
              </p>
              <p>
                Gezählt werden alle verkauften Artikel des ganzen Shops (Etsy veröffentlicht keine Verkäufe pro
                Listing). „Schalen-Treffer“ zeigt, wie viele Listings des Shops in der deutschen Schalen-Suche
                auftauchen — je höher, desto stärker ist der Shop auf Schalen spezialisiert.
              </p>
              <p>
                Suchbegriffe: {daten?.suchbegriffe.join(', ')}. Die Top 10 werden wöchentlich neu bestimmt.{' '}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void aktualisieren(true)}
                  className="underline decoration-dotted hover:text-[var(--app-text)] disabled:opacity-60"
                >
                  Jetzt neu bestimmen
                </button>
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function ChartTooltip({
  active,
  payload,
  label,
  namen,
  mitPlus,
}: TooltipContentProps & { namen: Map<string, string>; mitPlus: boolean }) {
  if (!active || !payload?.length) return null
  const zeilen = [...payload].sort((a, b) => Number(b.value) - Number(a.value))
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
      <p className="mb-1 font-medium text-[var(--app-text)]">{tagKurz(String(label))}</p>
      {zeilen.map((z) => (
        <p key={String(z.dataKey)} className="flex justify-between gap-4" style={{ color: z.color }}>
          <span className="truncate">{namen.get(String(z.dataKey)) ?? String(z.dataKey)}</span>
          <span className="tabular-nums">
            {mitPlus ? '+' : ''}
            {zahl(Number(z.value))}
          </span>
        </p>
      ))}
    </div>
  )
}

function ShopZeile({
  rang,
  shop: s,
  farbe,
  aus,
  onToggle,
  max30,
}: {
  rang: number
  shop: EtsyKonkurrenzShop
  farbe: string
  aus: boolean
  onToggle: () => void
  max30: number
}) {
  const wert30 = s.plus30 ?? s.seitStart
  return (
    <tr
      onClick={onToggle}
      className={`cursor-pointer border-b border-[var(--app-border)]/60 transition hover:bg-[var(--app-surface-muted)] ${
        aus ? 'opacity-40' : ''
      } ${s.eigener ? 'bg-amber-500/5' : ''}`}
    >
      <td className="py-2 pr-2 text-xs tabular-nums text-[var(--app-text-muted)]">{rang}</td>
      <td className="py-2 pr-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: farbe }} />
          {s.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.iconUrl} alt="" className="h-6 w-6 shrink-0 rounded-md object-cover" loading="lazy" />
          ) : null}
          <div className="min-w-0">
            {s.url ? (
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="block truncate font-medium text-[var(--app-text)] hover:underline"
              >
                {s.name}
              </a>
            ) : (
              <span className="block truncate font-medium text-[var(--app-text)]">{s.name}</span>
            )}
            <span className="text-[11px] text-[var(--app-text-muted)]">
              {s.eigener
                ? 'Dein Shop'
                : `${s.treffer} Schalen-Treffer${s.preisMedian != null ? ` · Ø ${zahl(s.preisMedian)} €` : ''}`}
              {s.aktiveListings != null ? ` · ${zahl(s.aktiveListings)} Listings` : ''}
            </span>
          </div>
        </div>
      </td>
      <td className="py-2 pr-2 text-right font-semibold tabular-nums text-[var(--app-text)]">
        {zahl(s.verkaeufeGesamt)}
      </td>
      <td className="py-2 pr-2">
        {wert30 == null ? (
          <span className="text-xs text-[var(--app-text-muted)]">ab morgen</span>
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--app-surface-muted)]">
              <div className="h-full rounded-full" style={{ width: `${(wert30 / max30) * 100}%`, background: farbe }} />
            </div>
            <span className="text-xs tabular-nums text-[var(--app-text)]">
              +{zahl(wert30)}
              {s.plus30 == null ? <span className="text-[var(--app-text-muted)]"> ({s.messTage} T.)</span> : null}
            </span>
          </div>
        )}
      </td>
      <td className="py-2 pr-2 text-right text-xs tabular-nums text-[var(--app-text)]">
        {s.plus7 == null ? '—' : `+${zahl(s.plus7)}`}
      </td>
      <td className="py-2 pr-2 text-right text-xs tabular-nums text-[var(--app-text)]">{zahl(s.proTag, 1)}</td>
      <td className="py-2 text-right text-xs tabular-nums text-[var(--app-text-muted)]">
        {s.bewertungSchnitt != null ? `${zahl(s.bewertungSchnitt, 1)} ★` : '—'}
        {s.bewertungen != null ? ` (${zahl(s.bewertungen)})` : ''}
      </td>
    </tr>
  )
}
