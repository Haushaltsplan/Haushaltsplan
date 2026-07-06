'use client'

import { useMemo, useState } from 'react'

import { appTableScrollClassName } from '@/components/page-shell'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import {
  PaStrukturKennzahl,
  PaStrukturSectionHeader,
} from '@/components/portfolio-analyse/struktur/pa-struktur-visuals'
import type {
  SecKennzahlJahr,
  SecKennzahlenHistorie,
  SecSegmentHistorie,
  SecSegmentHistoriePaket,
} from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { segmentFarben } from '@/lib/portfolio-analyse/fundamentaldaten-struktur-hilfen'

type TabArt = 'geo' | 'produkt'
type KennzahlTab = 'umsatz' | 'margen' | 'invest' | 'bilanz' | 'personal'

function historieFuerTab(paket: SecSegmentHistoriePaket, tab: TabArt): SecSegmentHistorie | null {
  return tab === 'geo' ? paket.geo : paket.produkt
}

function alleSegmentNamen(hist: SecSegmentHistorie): string[] {
  const namen = new Set<string>()
  for (const j of hist.jahre) {
    for (const s of j.segmente) namen.add(s.name)
  }
  return [...namen].sort()
}

function anteilFuerSegment(hist: SecSegmentHistorie, jahr: number, name: string): number | null {
  const eintrag = hist.jahre.find((j) => j.jahr === jahr)
  const seg = eintrag?.segmente.find((s) => s.name === name)
  return seg?.anteilPct ?? null
}

function umsatzFuerSegment(hist: SecSegmentHistorie, jahr: number, name: string): number | null {
  const eintrag = hist.jahre.find((j) => j.jahr === jahr)
  const seg = eintrag?.segmente.find((s) => s.name === name)
  return seg?.umsatzMio ?? null
}

function berechneMixShift(hist: SecSegmentHistorie): string | null {
  if (hist.jahre.length < 2) return null
  const alt = hist.jahre[0]!
  const neu = hist.jahre[hist.jahre.length - 1]!
  let bestName = ''
  let bestDelta = 0

  for (const name of alleSegmentNamen(hist)) {
    const a = anteilFuerSegment(hist, alt.jahr, name)
    const n = anteilFuerSegment(hist, neu.jahr, name)
    if (a == null || n == null) continue
    const delta = n - a
    if (Math.abs(delta) > Math.abs(bestDelta)) {
      bestDelta = delta
      bestName = name
    }
  }

  if (!bestName || Math.abs(bestDelta) < 1) return null
  const richtung = bestDelta > 0 ? 'gewachsen' : 'geschrumpft'
  return `„${bestName}“ ${richtung} von ${(anteilFuerSegment(hist, alt.jahr, bestName) ?? 0).toFixed(0)} % (${alt.jahr}) auf ${(anteilFuerSegment(hist, neu.jahr, bestName) ?? 0).toFixed(0)} % (${neu.jahr})`
}

function barBreite(anzahl: number): number {
  if (anzahl > 12) return 22
  if (anzahl > 8) return 28
  if (anzahl > 6) return 34
  return 42
}

function PaSecSegmentStackedChart({
  hist,
  farben,
}: {
  hist: SecSegmentHistorie
  farben: string[]
}) {
  const namen = useMemo(() => alleSegmentNamen(hist), [hist])
  const jahre = hist.jahre.map((j) => j.jahr)
  const barW = barBreite(jahre.length)
  const gap = jahre.length > 10 ? 8 : 14
  const chartH = 200
  const padL = 4
  const padB = 28
  const width = Math.max(320, padL + jahre.length * (barW + gap) + 12)

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={chartH + padB}
        viewBox={`0 0 ${width} ${chartH + padB}`}
        className="block min-w-full"
        role="img"
        aria-label={`Umsatzmix ${hist.art} über ${jahre.length} Jahre`}
      >
        {jahre.map((jahr, ji) => {
          const x = padL + ji * (barW + gap)
          const eintrag = hist.jahre.find((j) => j.jahr === jahr)
          const segmente = [...(eintrag?.segmente ?? [])]
            .filter((s) => (s.anteilPct ?? 0) > 0)
            .sort((a, b) => namen.indexOf(a.name) - namen.indexOf(b.name))

          let yAcc = chartH

          return (
            <g key={jahr}>
              {segmente.map((s) => {
                const pct = s.anteilPct ?? 0
                const h = (pct / 100) * chartH
                yAcc -= h
                const farbeIdx = namen.indexOf(s.name)
                const farbe = farben[farbeIdx >= 0 ? farbeIdx % farben.length : 0]!
                return (
                  <rect key={s.name} x={x} y={yAcc} width={barW} height={h} fill={farbe} opacity={0.92} rx={1}>
                    <title>
                      {jahr}: {s.name} — {pct.toFixed(1)} %
                    </title>
                  </rect>
                )
              })}
              <text
                x={x + barW / 2}
                y={chartH + 16}
                textAnchor="middle"
                className="fill-[var(--app-text-muted)]"
                style={{ fontSize: jahre.length > 10 ? 8 : 10 }}
              >
                {String(jahr).slice(-2)}
              </text>
              <title>{jahr}</title>
            </g>
          )
        })}
        <line x1={padL} y1={chartH} x2={width - 8} y2={chartH} stroke="var(--app-border-strong)" strokeOpacity={0.5} />
      </svg>
      {jahre.length > 8 ? (
        <p className="mt-1 text-center text-[10px] text-[var(--app-text-muted)]">
          X-Achse: Geschäftsjahre ({jahre[0]}–{jahre[jahre.length - 1]})
        </p>
      ) : null}
    </div>
  )
}

function PaSecLinienChart({
  reihen,
  jahre,
  height = 140,
}: {
  reihen: { label: string; farbe: string; werte: Map<number, number>; einheit?: string }[]
  jahre: number[]
  height?: number
}) {
  if (jahre.length < 2 || reihen.length === 0) return null

  const pad = { l: 8, r: 8, t: 8, b: 24 }
  const w = Math.max(300, jahre.length * 36 + pad.l + pad.r)
  const h = height
  const chartW = w - pad.l - pad.r
  const chartH = h - pad.t - pad.b

  const alleWerte = reihen.flatMap((r) => jahre.map((j) => r.werte.get(j)).filter((v): v is number => v != null))
  const minV = Math.min(...alleWerte)
  const maxV = Math.max(...alleWerte)
  const span = maxV - minV || 1

  const xFor = (ji: number) => pad.l + (ji / Math.max(1, jahre.length - 1)) * chartW
  const yFor = (v: number) => pad.t + chartH - ((v - minV) / span) * chartH

  return (
    <div className="overflow-x-auto">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block min-w-full">
        {reihen.map((r) => {
          const pts = jahre
            .map((j, ji) => {
              const v = r.werte.get(j)
              return v != null ? `${xFor(ji)},${yFor(v)}` : null
            })
            .filter(Boolean)
          if (pts.length < 2) return null
          return (
            <g key={r.label}>
              <polyline
                fill="none"
                stroke={r.farbe}
                strokeWidth={2}
                strokeLinejoin="round"
                points={pts.join(' ')}
              />
              {jahre.map((j, ji) => {
                const v = r.werte.get(j)
                if (v == null) return null
                return <circle key={j} cx={xFor(ji)} cy={yFor(v)} r={3} fill={r.farbe} />
              })}
            </g>
          )
        })}
        {jahre.map((j, ji) => (
          <text
            key={j}
            x={xFor(ji)}
            y={h - 4}
            textAnchor="middle"
            className="fill-[var(--app-text-muted)]"
            style={{ fontSize: 9 }}
          >
            {String(j).slice(-2)}
          </text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3">
        {reihen.map((r) => (
          <span key={r.label} className="flex items-center gap-1.5 text-[10px] text-[var(--app-text-muted)]">
            <span className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: r.farbe }} />
            {r.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function reiheZuMap(arr: SecKennzahlJahr[]): Map<number, number> {
  return new Map(arr.map((e) => [e.jahr, e.wert]))
}

function gemeinsameJahre(...arrays: SecKennzahlJahr[][]): number[] {
  const s = new Set<number>()
  for (const a of arrays) for (const e of a) s.add(e.jahr)
  return [...s].sort((a, b) => a - b)
}

function PaSecKennzahlenPanel({ kz }: { kz: SecKennzahlenHistorie }) {
  const [tab, setTab] = useState<KennzahlTab>('umsatz')

  const jahreUmsatz = useMemo(() => kz.umsatzMio.map((e) => e.jahr), [kz.umsatzMio])
  const jahreMargen = useMemo(
    () => gemeinsameJahre(kz.ebitMargePct, kz.nettoMargePct, kz.rndAnteilPct),
    [kz],
  )
  const jahreInvest = useMemo(() => gemeinsameJahre(kz.capexMio, kz.rndMio, kz.fcfMio), [kz])
  const jahreBilanz = useMemo(() => gemeinsameJahre(kz.assetsMio, kz.eigenkapitalMio, kz.langfristigeSchuldenMio), [kz])
  const jahreMa = useMemo(() => {
    const merged = new Map<number, number>()
    for (const e of kz.mitarbeiter) merged.set(e.jahr, e.wert)
    return [...merged.keys()].sort((a, b) => a - b)
  }, [kz.mitarbeiter])

  const tabs: { id: KennzahlTab; label: string }[] = [
    { id: 'umsatz', label: 'Umsatz & Gewinn' },
    { id: 'margen', label: 'Margen & R&D' },
    { id: 'invest', label: 'CapEx & FCF' },
    { id: 'bilanz', label: 'Bilanz' },
    { id: 'personal', label: 'Mitarbeiter' },
  ]

  return (
    <div className="space-y-4 border-t border-[var(--app-border)]/60 pt-4">
      <div>
        <p className="text-sm font-medium text-white">SEC XBRL-Kennzahlen ({kz.anzahlJahre} Jahre)</p>
        <p className="text-xs text-[var(--app-text-muted)]">
          Company Facts API · {kz.aeltestesJahr}–{kz.juengstesJahr} · standardisierte US-GAAP-Daten
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
              tab === t.id
                ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40'
                : 'bg-[var(--app-surface-muted)]/50 text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'umsatz' && kz.umsatzMio.length >= 2 ? (
        <PaSecLinienChart
          jahre={jahreUmsatz}
          reihen={[
            { label: 'Umsatz (Mio. USD)', farbe: '#2dd4bf', werte: reiheZuMap(kz.umsatzMio) },
            { label: 'EBIT (Mio. USD)', farbe: '#34d399', werte: reiheZuMap(kz.ebitMio) },
            { label: 'Nettogewinn (Mio. USD)', farbe: '#60a5fa', werte: reiheZuMap(kz.nettogewinnMio) },
          ]}
        />
      ) : null}

      {tab === 'margen' && jahreMargen.length >= 2 ? (
        <PaSecLinienChart
          jahre={jahreMargen}
          reihen={[
            { label: 'EBIT-Marge %', farbe: '#34d399', werte: reiheZuMap(kz.ebitMargePct) },
            { label: 'Netto-Marge %', farbe: '#60a5fa', werte: reiheZuMap(kz.nettoMargePct) },
            { label: 'R&D / Umsatz %', farbe: '#f472b6', werte: reiheZuMap(kz.rndAnteilPct) },
          ]}
        />
      ) : null}

      {tab === 'invest' && jahreInvest.length >= 2 ? (
        <PaSecLinienChart
          jahre={jahreInvest}
          reihen={[
            { label: 'CapEx (Mio.)', farbe: '#fbbf24', werte: reiheZuMap(kz.capexMio) },
            { label: 'R&D (Mio.)', farbe: '#f472b6', werte: reiheZuMap(kz.rndMio) },
            { label: 'FCF (Mio.)', farbe: '#2dd4bf', werte: reiheZuMap(kz.fcfMio) },
          ]}
        />
      ) : null}

      {tab === 'bilanz' && jahreBilanz.length >= 2 ? (
        <PaSecLinienChart
          jahre={jahreBilanz}
          reihen={[
            { label: 'Assets (Mio.)', farbe: '#94a3b8', werte: reiheZuMap(kz.assetsMio) },
            { label: 'Eigenkapital (Mio.)', farbe: '#34d399', werte: reiheZuMap(kz.eigenkapitalMio) },
            { label: 'LT-Schulden (Mio.)', farbe: '#f87171', werte: reiheZuMap(kz.langfristigeSchuldenMio) },
          ]}
        />
      ) : null}

      {tab === 'personal' && jahreMa.length >= 2 ? (
        <PaSecLinienChart
          jahre={jahreMa}
          reihen={[{ label: 'Mitarbeiter', farbe: '#a78bfa', werte: reiheZuMap(kz.mitarbeiter) }]}
        />
      ) : null}

      <div className={appTableScrollClassName}>
        <table className="app-data-table min-w-full text-left text-[10px]">
          <thead className="text-[var(--app-text-muted)]">
            <tr>
              <th className="sticky left-0 z-10 bg-[var(--app-surface)] pb-1 pr-2">Kennzahl</th>
              {jahreUmsatz.slice(-12).map((j) => (
                <th key={j} className="px-1 text-right font-medium tabular-nums">
                  {j}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Umsatz (Mio.)', arr: kz.umsatzMio },
              { label: 'EBIT (Mio.)', arr: kz.ebitMio },
              { label: 'EBIT-Marge %', arr: kz.ebitMargePct },
              { label: 'R&D %', arr: kz.rndAnteilPct },
              { label: 'CapEx %', arr: kz.capexAnteilPct },
              { label: 'FCF (Mio.)', arr: kz.fcfMio },
              { label: 'Mitarbeiter', arr: kz.mitarbeiter },
            ].map((row) => {
              const map = reiheZuMap(row.arr)
              const cols = jahreUmsatz.slice(-12)
              if (cols.every((j) => map.get(j) == null)) return null
              return (
                <tr key={row.label} className="border-t border-[var(--app-border)]/40">
                  <td className="sticky left-0 z-10 bg-[var(--app-surface)] py-1 pr-2 text-[var(--app-text-muted)]">
                    {row.label}
                  </td>
                  {cols.map((j) => (
                    <td key={j} className="px-1 py-1 text-right tabular-nums text-[var(--app-text)]">
                      {map.get(j)?.toLocaleString('de-DE') ?? '–'}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PaSecSegmentHistorieTabelle({
  hist,
  farben,
}: {
  hist: SecSegmentHistorie
  farben: string[]
}) {
  const namen = useMemo(() => alleSegmentNamen(hist), [hist])
  const jahre = hist.jahre.map((j) => j.jahr)

  return (
    <div className={appTableScrollClassName}>
      <table className="app-data-table min-w-full text-left text-xs">
        <thead className="text-[var(--app-text-muted)]">
          <tr>
            <th className="sticky left-0 z-10 bg-[var(--app-surface)] pb-2 pr-3 font-medium">Segment</th>
            {jahre.map((j) => (
              <th key={j} className="pb-2 px-2 text-right font-medium tabular-nums">
                {j}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {namen.map((name, i) => (
            <tr key={name} className="border-t border-[var(--app-border)]/40">
              <td className="sticky left-0 z-10 bg-[var(--app-surface)] py-2 pr-3">
                <span
                  className="mr-2 inline-block h-2 w-2 rounded-sm"
                  style={{ backgroundColor: farben[i % farben.length] }}
                />
                <span className="text-[var(--app-text)]">{name}</span>
              </td>
              {jahre.map((j) => {
                const pct = anteilFuerSegment(hist, j, name)
                const mio = umsatzFuerSegment(hist, j, name)
                return (
                  <td key={j} className="py-2 px-2 text-right tabular-nums">
                    {pct != null ? (
                      <span className="font-medium text-[var(--app-text)]">{pct.toFixed(1)} %</span>
                    ) : (
                      <span className="text-[var(--app-text-muted)]">–</span>
                    )}
                    {mio != null ? (
                      <span className="block text-[10px] text-[var(--app-text-muted)]">
                        {mio.toLocaleString('de-DE')} Mio.
                      </span>
                    ) : null}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PaSecSegmentHistorie({ paket }: { paket: SecSegmentHistoriePaket }) {
  const hatGeo = (paket.geo?.jahre.length ?? 0) >= 2
  const hatProdukt = (paket.produkt?.jahre.length ?? 0) >= 2
  const defaultTab: TabArt = hatGeo ? 'geo' : 'produkt'
  const [tab, setTab] = useState<TabArt>(defaultTab)

  const hist = historieFuerTab(paket, tab)
  const farben = segmentFarben(hist ? alleSegmentNamen(hist).length : 8)

  const zusatz = paket.zusatz
  const hatZusatz =
    zusatz.mitarbeiterAnzahl != null ||
    zusatz.auslandsumsatzAnteilPct != null ||
    zusatz.hauptkunden.length > 0 ||
    zusatz.mitarbeiterHistorie.length > 0

  const jahresSpanne = useMemo(() => {
    const alle = [
      ...(paket.geo?.jahre ?? []),
      ...(paket.produkt?.jahre ?? []),
      ...(paket.kennzahlen ? [{ jahr: paket.kennzahlen.aeltestesJahr }, { jahr: paket.kennzahlen.juengstesJahr }] : []),
    ].map((j) => ('jahr' in j ? j.jahr : 0))
    if (alle.length === 0) return null
    return { min: Math.min(...alle), max: Math.max(...alle) }
  }, [paket])

  if (!hatGeo && !hatProdukt && !paket.kennzahlen && !hatZusatz) return null

  const tabLabel = tab === 'geo' ? 'Geografie / Länder' : 'Produkt / Geschäftsbereiche'
  const mixShift = hist ? berechneMixShift(hist) : null

  return (
    <PaCard variant="elevated" className="space-y-5 p-5 sm:p-6">
      <PaStrukturSectionHeader
        titel="SEC 10-K — Struktur & Historie"
        untertitel={`${paket.anzahl10k} Jahresberichte geladen · ${jahresSpanne ? `${jahresSpanne.min}–${jahresSpanne.max}` : paket.berichtJahr ?? '–'} · SEC EDGAR XBRL`}
      />

      {hatZusatz ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <PaStrukturKennzahl
            label="Mitarbeiter (aktuell)"
            wert={zusatz.mitarbeiterAnzahl?.toLocaleString('de-DE') ?? null}
          />
          <PaStrukturKennzahl
            label="Auslandsanteil Umsatz"
            wert={zusatz.auslandsumsatzAnteilPct != null ? `${zusatz.auslandsumsatzAnteilPct} %` : null}
            accent={zusatz.auslandsumsatzAnteilPct != null && zusatz.auslandsumsatzAnteilPct >= 50 ? 'amber' : undefined}
          />
          {zusatz.hauptkunden.slice(0, 2).map((k) => (
            <PaStrukturKennzahl
              key={k.name}
              label={`Kunde: ${k.name}`}
              wert={`${k.anteilPct} % Umsatz`}
              accent={k.anteilPct >= 10 ? 'amber' : undefined}
            />
          ))}
        </div>
      ) : null}

      {paket.kennzahlen ? <PaSecKennzahlenPanel kz={paket.kennzahlen} /> : null}

      {(hatGeo || hatProdukt) && (
        <div className="space-y-4 border-t border-[var(--app-border)]/60 pt-4">
          <div>
            <p className="text-sm font-medium text-white">Umsatzmix nach Segment</p>
            <p className="text-xs text-[var(--app-text-muted)]">
              Geo- & Produktsegmente aus 10-K-Tabellen
              {paket.geo ? ` · Geo ${paket.geo.anzahlJahre}J` : ''}
              {paket.produkt ? ` · Produkt ${paket.produkt.anzahlJahre}J` : ''}
            </p>
          </div>

          {hatGeo && hatProdukt ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTab('geo')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === 'geo'
                    ? 'bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/40'
                    : 'bg-[var(--app-surface-muted)]/50 text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                }`}
              >
                Geografie ({paket.geo!.anzahlJahre} Jahre)
              </button>
              <button
                type="button"
                onClick={() => setTab('produkt')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === 'produkt'
                    ? 'bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/40'
                    : 'bg-[var(--app-surface-muted)]/50 text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                }`}
              >
                Produkt ({paket.produkt!.anzahlJahre} Jahre)
              </button>
            </div>
          ) : null}

          {mixShift ? (
            <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 px-3 py-2 text-xs text-teal-100/90">
              Mix-Verschiebung ({hist!.anzahlJahre} Jahre): {mixShift}
            </div>
          ) : null}

          {hist && hist.jahre.length >= 2 ? (
            <>
              <p className="text-xs text-[var(--app-text-muted)]">
                {tabLabel} — Umsatzanteil in % (gestapelte Balken = 100 % pro Jahr)
              </p>
              <PaSecSegmentStackedChart hist={hist} farben={farben} />
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {alleSegmentNamen(hist).map((name, i) => (
                  <span key={name} className="flex items-center gap-1.5 text-[10px] text-[var(--app-text-muted)]">
                    <span
                      className="inline-block h-2 w-2 rounded-sm"
                      style={{ backgroundColor: farben[i % farben.length] }}
                    />
                    {name}
                  </span>
                ))}
              </div>
              <PaSecSegmentHistorieTabelle hist={hist} farben={farben} />
            </>
          ) : (
            <p className="text-sm text-[var(--app-text-muted)]">
              Für {tab === 'geo' ? 'Geografie' : 'Produkt'} liegen weniger als zwei Jahre Segmentdaten vor.
            </p>
          )}
        </div>
      )}

      {zusatz.mitarbeiterHistorie.length >= 2 ? (
        <div className="border-t border-[var(--app-border)]/60 pt-4">
          <p className="mb-2 text-xs font-medium text-[var(--app-text-muted)]">Mitarbeiter aus 10-K-Text (Historie)</p>
          <PaSecLinienChart
            jahre={zusatz.mitarbeiterHistorie.map((e) => e.jahr)}
            reihen={[
              {
                label: 'Mitarbeiter (10-K)',
                farbe: '#a78bfa',
                werte: new Map(zusatz.mitarbeiterHistorie.map((e) => [e.jahr, e.anzahl])),
              },
            ]}
          />
        </div>
      ) : null}
    </PaCard>
  )
}
