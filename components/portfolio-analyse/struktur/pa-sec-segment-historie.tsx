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
  SecSegmentHistorieKategorie,
  SecSegmentHistoriePaket,
} from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { segmentFarben } from '@/lib/portfolio-analyse/fundamentaldaten-struktur-hilfen'

function alleSegmentNamen(hist: SecSegmentHistorie): string[] {
  const namen = new Set<string>()
  for (const j of hist.jahre) {
    for (const s of j.segmente) namen.add(s.name)
  }
  return [...namen].sort()
}

function anteilFuerSegment(hist: SecSegmentHistorie, jahr: number, name: string): number | null {
  return hist.jahre.find((j) => j.jahr === jahr)?.segmente.find((s) => s.name === name)?.anteilPct ?? null
}

function umsatzFuerSegment(hist: SecSegmentHistorie, jahr: number, name: string): number | null {
  return hist.jahre.find((j) => j.jahr === jahr)?.segmente.find((s) => s.name === name)?.umsatzMio ?? null
}

function barBreite(anzahl: number): number {
  if (anzahl > 12) return 20
  if (anzahl > 8) return 26
  if (anzahl > 6) return 32
  return 40
}

function PaSecSegmentStackedChart({ hist, farben }: { hist: SecSegmentHistorie; farben: string[] }) {
  const namen = useMemo(() => alleSegmentNamen(hist), [hist])
  const jahre = hist.jahre.map((j) => j.jahr)
  const barW = barBreite(jahre.length)
  const gap = jahre.length > 10 ? 6 : 12
  const chartH = 220
  const padL = 4
  const padB = 28
  const width = Math.max(360, padL + jahre.length * (barW + gap) + 12)

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={chartH + padB} viewBox={`0 0 ${width} ${chartH + padB}`} className="block min-w-full">
        {jahre.map((jahr, ji) => {
          const x = padL + ji * (barW + gap)
          const segmente = [...(hist.jahre.find((j) => j.jahr === jahr)?.segmente ?? [])]
            .filter((s) => (s.anteilPct ?? 0) > 0)
            .sort((a, b) => namen.indexOf(a.name) - namen.indexOf(b.name))
          let yAcc = chartH
          return (
            <g key={jahr}>
              {segmente.map((s) => {
                const pct = s.anteilPct ?? 0
                const h = (pct / 100) * chartH
                yAcc -= h
                const farbe = farben[namen.indexOf(s.name) % farben.length]!
                return (
                  <rect key={s.name} x={x} y={yAcc} width={barW} height={h} fill={farbe} opacity={0.9} rx={1}>
                    <title>{jahr}: {s.name} — {pct.toFixed(1)} % ({s.umsatzMio?.toLocaleString('de-DE')} Mio.)</title>
                  </rect>
                )
              })}
              <text x={x + barW / 2} y={chartH + 16} textAnchor="middle" className="fill-[var(--app-text-muted)]" style={{ fontSize: 9 }}>
                {jahr}
              </text>
            </g>
          )
        })}
        <line x1={padL} y1={chartH} x2={width - 8} y2={chartH} stroke="var(--app-border-strong)" strokeOpacity={0.5} />
      </svg>
    </div>
  )
}

function PaSecLinienChart({
  reihen,
  jahre,
  height = 140,
}: {
  reihen: { label: string; farbe: string; werte: Map<number, number> }[]
  jahre: number[]
  height?: number
}) {
  if (jahre.length < 2 || reihen.length === 0) return null
  const pad = { l: 8, r: 8, t: 8, b: 24 }
  const w = Math.max(320, jahre.length * 40 + pad.l + pad.r)
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
          const pts = jahre.map((j, ji) => { const v = r.werte.get(j); return v != null ? `${xFor(ji)},${yFor(v)}` : null }).filter(Boolean)
          if (pts.length < 2) return null
          return (
            <g key={r.label}>
              <polyline fill="none" stroke={r.farbe} strokeWidth={2} points={pts.join(' ')} />
              {jahre.map((j, ji) => { const v = r.werte.get(j); return v != null ? <circle key={j} cx={xFor(ji)} cy={yFor(v)} r={2.5} fill={r.farbe} /> : null })}
            </g>
          )
        })}
        {jahre.map((j, ji) => (
          <text key={j} x={xFor(ji)} y={h - 4} textAnchor="middle" className="fill-[var(--app-text-muted)]" style={{ fontSize: 9 }}>{j}</text>
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

function PaSecSegmentTabelle({ hist, farben }: { hist: SecSegmentHistorie; farben: string[] }) {
  const namen = alleSegmentNamen(hist)
  const jahre = hist.jahre.map((j) => j.jahr)
  const metrik = hist.art === 'geo_assets' ? 'Mio. USD (Assets)' : 'Mio. USD'

  return (
    <div className={appTableScrollClassName}>
      <table className="app-data-table min-w-full text-left text-xs">
        <thead className="text-[var(--app-text-muted)]">
          <tr>
            <th className="sticky left-0 z-10 bg-[var(--app-surface)] pb-2 pr-3 font-medium">Position</th>
            {jahre.map((j) => (
              <th key={j} className="pb-2 px-2 text-right font-medium tabular-nums">{j}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {namen.map((name, i) => (
            <tr key={name} className="border-t border-[var(--app-border)]/40">
              <td className="sticky left-0 z-10 bg-[var(--app-surface)] py-2 pr-3">
                <span className="mr-2 inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: farben[i % farben.length] }} />
                {name}
              </td>
              {jahre.map((j) => {
                const pct = anteilFuerSegment(hist, j, name)
                const mio = umsatzFuerSegment(hist, j, name)
                return (
                  <td key={j} className="py-2 px-2 text-right tabular-nums">
                    {pct != null ? <span className="font-medium text-[var(--app-text)]">{pct.toFixed(1)} %</span> : '–'}
                    {mio != null ? <span className="block text-[10px] text-[var(--app-text-muted)]">{mio.toLocaleString('de-DE')} {metrik}</span> : null}
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

function PaSecKennzahlenPanel({ kz }: { kz: SecKennzahlenHistorie }) {
  const [tab, setTab] = useState<'umsatz' | 'margen' | 'invest' | 'bilanz' | 'personal'>('umsatz')
  const jahreUmsatz = kz.umsatzMio.map((e) => e.jahr)

  return (
    <div className="space-y-4 border-t border-[var(--app-border)]/60 pt-4">
      <div>
        <p className="text-sm font-medium text-white">XBRL-Kennzahlen (SEC Company Facts)</p>
        <p className="text-xs text-[var(--app-text-muted)]">{kz.aeltestesJahr}–{kz.juengstesJahr} · {kz.anzahlJahre} Geschäftsjahre · US-GAAP</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {([
          ['umsatz', 'Umsatz & Gewinn'],
          ['margen', 'Margen & R&D'],
          ['invest', 'CapEx & FCF'],
          ['bilanz', 'Bilanz'],
          ['personal', 'Mitarbeiter'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${tab === id ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40' : 'bg-[var(--app-surface-muted)]/50 text-[var(--app-text-muted)]'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'umsatz' && <PaSecLinienChart jahre={jahreUmsatz} reihen={[{ label: 'Umsatz', farbe: '#2dd4bf', werte: reiheZuMap(kz.umsatzMio) }, { label: 'EBIT', farbe: '#34d399', werte: reiheZuMap(kz.ebitMio) }, { label: 'Nettogewinn', farbe: '#60a5fa', werte: reiheZuMap(kz.nettogewinnMio) }]} />}
      {tab === 'margen' && <PaSecLinienChart jahre={gemeinsameJahre(kz.ebitMargePct, kz.rndAnteilPct)} reihen={[{ label: 'EBIT-Marge %', farbe: '#34d399', werte: reiheZuMap(kz.ebitMargePct) }, { label: 'Netto-Marge %', farbe: '#60a5fa', werte: reiheZuMap(kz.nettoMargePct) }, { label: 'R&D/Umsatz %', farbe: '#f472b6', werte: reiheZuMap(kz.rndAnteilPct) }]} />}
      {tab === 'invest' && <PaSecLinienChart jahre={gemeinsameJahre(kz.capexMio, kz.fcfMio)} reihen={[{ label: 'CapEx', farbe: '#fbbf24', werte: reiheZuMap(kz.capexMio) }, { label: 'R&D', farbe: '#f472b6', werte: reiheZuMap(kz.rndMio) }, { label: 'FCF', farbe: '#2dd4bf', werte: reiheZuMap(kz.fcfMio) }]} />}
      {tab === 'bilanz' && <PaSecLinienChart jahre={gemeinsameJahre(kz.assetsMio, kz.eigenkapitalMio)} reihen={[{ label: 'Assets', farbe: '#94a3b8', werte: reiheZuMap(kz.assetsMio) }, { label: 'Eigenkapital', farbe: '#34d399', werte: reiheZuMap(kz.eigenkapitalMio) }, { label: 'LT-Schulden', farbe: '#f87171', werte: reiheZuMap(kz.langfristigeSchuldenMio) }]} />}
      {tab === 'personal' && <PaSecLinienChart jahre={kz.mitarbeiter.map((e) => e.jahr)} reihen={[{ label: 'Mitarbeiter', farbe: '#a78bfa', werte: reiheZuMap(kz.mitarbeiter) }]} />}
      <div className={appTableScrollClassName}>
        <table className="app-data-table min-w-full text-left text-[10px]">
          <thead><tr><th className="sticky left-0 bg-[var(--app-surface)] pb-1 pr-2">Kennzahl</th>{jahreUmsatz.slice(-14).map((j) => <th key={j} className="px-1 text-right">{j}</th>)}</tr></thead>
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
              const cols = jahreUmsatz.slice(-14)
              if (cols.every((j) => map.get(j) == null)) return null
              return (
                <tr key={row.label} className="border-t border-[var(--app-border)]/40">
                  <td className="sticky left-0 bg-[var(--app-surface)] py-1 pr-2 text-[var(--app-text-muted)]">{row.label}</td>
                  {cols.map((j) => <td key={j} className="px-1 py-1 text-right tabular-nums">{map.get(j)?.toLocaleString('de-DE') ?? '–'}</td>)}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PaSecKategoriePanel({ kat }: { kat: SecSegmentHistorieKategorie }) {
  const hist = kat.historie
  const farben = segmentFarben(alleSegmentNamen(hist).length)
  const metrikLabel = kat.metrik === 'assets' ? 'Anlagevermögen' : 'Umsatz'

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--app-text-muted)]">
        {kat.titel} · {hist.anzahlJahre} Jahre ({hist.aeltestesJahr}–{hist.juengstesJahr}) · {metrikLabel} · SEC 10-K XBRL
      </p>
      <PaSecSegmentStackedChart hist={hist} farben={farben} />
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {alleSegmentNamen(hist).map((name, i) => (
          <span key={name} className="flex items-center gap-1 text-[10px] text-[var(--app-text-muted)]">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: farben[i % farben.length] }} />
            {name}
          </span>
        ))}
      </div>
      <PaSecSegmentTabelle hist={hist} farben={farben} />
    </div>
  )
}

export function PaSecSegmentHistorie({ paket }: { paket: SecSegmentHistoriePaket }) {
  const kategorien = paket.kategorien.length > 0
    ? paket.kategorien
    : [
        ...(paket.geo ? [{ id: 'geo', titel: 'Geografie', art: 'geo' as const, metrik: 'umsatz' as const, historie: paket.geo }] : []),
        ...(paket.produkt ? [{ id: 'produkt', titel: 'Produktsegmente', art: 'produkt' as const, metrik: 'umsatz' as const, historie: paket.produkt }] : []),
      ]

  const [aktivId, setAktivId] = useState(
    () =>
      kategorien.find((k) => k.id === 'umsatz_detail')?.id ??
      kategorien.find((k) => k.id === 'geo_umsatz')?.id ??
      kategorien[0]?.id ??
      'umsatz_detail',
  )
  const aktiv = kategorien.find((k) => k.id === aktivId) ?? kategorien[0]
  const zusatz = paket.zusatz

  const jahresSpanne = useMemo(() => {
    const alle = [
      ...kategorien.flatMap((k) => [k.historie.aeltestesJahr, k.historie.juengstesJahr]),
      ...(paket.kennzahlen ? [paket.kennzahlen.aeltestesJahr, paket.kennzahlen.juengstesJahr] : []),
    ]
    if (alle.length === 0) return null
    return { min: Math.min(...alle), max: Math.max(...alle) }
  }, [kategorien, paket.kennzahlen])

  if (kategorien.length === 0 && !paket.kennzahlen && !zusatz.mitarbeiterAnzahl) return null

  return (
    <PaCard variant="elevated" className="space-y-5 p-5 sm:p-6">
      <PaStrukturSectionHeader
        titel="SEC 10-K — Strukturdaten"
        untertitel={`${paket.anzahl10k} Jahresberichte · ${kategorien.length} XBRL-Tabellen · ${jahresSpanne ? `${jahresSpanne.min}–${jahresSpanne.max}` : '–'}`}
      />

      {(zusatz.mitarbeiterAnzahl != null || zusatz.auslandsumsatzAnteilPct != null || zusatz.hauptkunden.length > 0) && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <PaStrukturKennzahl label="Mitarbeiter (10-K)" wert={zusatz.mitarbeiterAnzahl?.toLocaleString('de-DE') ?? null} />
          <PaStrukturKennzahl label="Auslandsanteil Umsatz (10-K)" wert={zusatz.auslandsumsatzAnteilPct != null ? `${zusatz.auslandsumsatzAnteilPct} %` : null} />
          {zusatz.hauptkunden.slice(0, 3).map((k) => (
            <PaStrukturKennzahl key={k.name} label={`Kunde: ${k.name}`} wert={`${k.anteilPct} % Umsatz`} />
          ))}
        </div>
      )}

      {paket.kennzahlen ? <PaSecKennzahlenPanel kz={paket.kennzahlen} /> : null}

      {kategorien.length > 0 && (
        <div className="space-y-4 border-t border-[var(--app-border)]/60 pt-4">
          <p className="text-sm font-medium text-white">Umsatzmix nach Segment</p>
          <p className="text-xs text-[var(--app-text-muted)]">
            Geo- & Produktsegmente aus 10-K-Tabellen · SEC XBRL
          </p>
          <div className="flex flex-wrap gap-1.5">
            {kategorien.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setAktivId(k.id)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  aktiv?.id === k.id
                    ? 'bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/40'
                    : 'bg-[var(--app-surface-muted)]/50 text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                }`}
              >
                {k.titel} ({k.historie.anzahlJahre}J)
              </button>
            ))}
          </div>
          {aktiv ? <PaSecKategoriePanel kat={aktiv} /> : null}
        </div>
      )}

      {zusatz.mitarbeiterHistorie.length >= 2 && (
        <div className="border-t border-[var(--app-border)]/60 pt-4">
          <p className="mb-2 text-xs font-medium text-[var(--app-text-muted)]">Mitarbeiter (10-K-Text, Historie)</p>
          <PaSecLinienChart
            jahre={zusatz.mitarbeiterHistorie.map((e) => e.jahr)}
            reihen={[{ label: 'Mitarbeiter', farbe: '#a78bfa', werte: new Map(zusatz.mitarbeiterHistorie.map((e) => [e.jahr, e.anzahl])) }]}
          />
        </div>
      )}

      {zusatz.kundenKonzentrationHistorie.length >= 1 && (
        <div className={appTableScrollClassName}>
          <p className="mb-2 text-xs font-medium text-[var(--app-text-muted)]">Kundenkonzentration (10-K-Text)</p>
          <table className="app-data-table min-w-full text-left text-xs">
            <thead><tr><th className="pb-2 pr-3">Jahr</th><th className="pb-2 pr-3">Kunde</th><th className="pb-2 text-right">Anteil</th></tr></thead>
            <tbody>
              {zusatz.kundenKonzentrationHistorie.map((k) => (
                <tr key={k.jahr} className="border-t border-[var(--app-border)]/40">
                  <td className="py-2 pr-3">{k.jahr}</td>
                  <td className="py-2 pr-3">{k.name ?? '–'}</td>
                  <td className="py-2 text-right tabular-nums">{k.anteilPct} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PaCard>
  )
}
