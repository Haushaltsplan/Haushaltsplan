'use client'

import { useEffect, useMemo, useState } from 'react'
import { DonutChart, type DonutSegment } from '@/components/finanzen/donut-chart'
import { normalisiereLagerKategorie } from '@/lib/lager-produkt-kategorie'
import { basisEinheitFuerPreisanzeige } from '@/lib/lager-einheiten'
import { supabase } from '@/lib/supabase'

type ProduktInfo = { id: string; name: string; kategorie?: string | null; einheit: string }

type Props = { produkte: ProduktInfo[]; refreshKey: number }

type EinkaufRow = { produkt_id: string; gesamtpreis: number; basis_menge: number | null; erstellt_am: string }
type VerbrauchRow = { produkt_id: string; menge: number; erstellt_am: string }

const PALETTE = [
  '#34d399', '#38bdf8', '#f59e0b', '#a78bfa', '#f472b6', '#fb7185',
  '#22d3ee', '#a3e635', '#fbbf24', '#60a5fa', '#c084fc', '#4ade80',
]

function eur(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function monatsKey(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monatsLabel(key: string): string {
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
}

function letzteMonate(anzahl: number): string[] {
  const out: string[] = []
  const d = new Date()
  d.setDate(1)
  for (let i = anzahl - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

function Karte({ titel, hint, children }: { titel: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-black/20">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-100">{titel}</h3>
        {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
      </div>
      {children}
    </div>
  )
}

/** Einreihiges Balkendiagramm (ein Wert je Monat) als reines SVG. */
function MonatsBalken({ daten, hoehe = 180 }: { daten: { key: string; wert: number }[]; hoehe?: number }) {
  const breite = Math.max(320, daten.length * 52)
  const padLinks = 8
  const padUnten = 24
  const padOben = 14
  const plot = hoehe - padUnten - padOben
  const max = Math.max(1, ...daten.map((d) => d.wert))
  const gruppenBreite = (breite - padLinks * 2) / Math.max(1, daten.length)
  const balkenBreite = Math.min(26, gruppenBreite * 0.62)

  if (daten.every((d) => d.wert <= 0)) {
    return <div className="py-8 text-center text-[12px] text-slate-600">Noch keine Daten.</div>
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${breite} ${hoehe}`} preserveAspectRatio="xMidYMid meet" style={{ minWidth: breite }} role="img" aria-label="Werte je Monat">
        <line x1={padLinks} y1={padOben + plot} x2={breite - padLinks} y2={padOben + plot} stroke="#334155" strokeWidth={1} />
        {daten.map((d, i) => {
          const h = (d.wert / max) * plot
          const xMitte = padLinks + gruppenBreite * i + gruppenBreite / 2
          return (
            <g key={d.key}>
              <rect x={xMitte - balkenBreite / 2} y={padOben + (plot - h)} width={balkenBreite} height={Math.max(0, h)} rx={3} fill="#34d399">
                <title>{`${monatsLabel(d.key)}: ${eur(d.wert)}`}</title>
              </rect>
              <text x={xMitte} y={hoehe - 7} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 10 }}>
                {monatsLabel(d.key)}
              </text>
            </g>
          )
        })}
        <text x={padLinks} y={padOben + 2} className="fill-slate-600" style={{ fontSize: 9 }}>
          {eur(max)}
        </text>
      </svg>
    </div>
  )
}

/** Liniendiagramm für eine Reihe von (Label, Wert)-Punkten. */
function LinienChart({
  punkte,
  hoehe = 180,
  farbe = '#38bdf8',
  format = eur,
}: {
  punkte: { label: string; wert: number }[]
  hoehe?: number
  farbe?: string
  format?: (n: number) => string
}) {
  const breite = Math.max(320, punkte.length * 46)
  const padLinks = 8
  const padUnten = 24
  const padOben = 14
  const padRechts = 8
  const plot = hoehe - padUnten - padOben
  if (punkte.length === 0) {
    return <div className="py-8 text-center text-[12px] text-slate-600">Noch keine Daten.</div>
  }
  const werte = punkte.map((p) => p.wert)
  const max = Math.max(...werte)
  const min = Math.min(0, ...werte)
  const spanne = Math.max(1, max - min)
  const xFuer = (i: number) =>
    padLinks + (punkte.length === 1 ? (breite - padLinks - padRechts) / 2 : (i * (breite - padLinks - padRechts)) / (punkte.length - 1))
  const yFuer = (w: number) => padOben + plot - ((w - min) / spanne) * plot
  const linie = punkte.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFuer(i).toFixed(1)} ${yFuer(p.wert).toFixed(1)}`).join(' ')
  const flaeche = `${linie} L ${xFuer(punkte.length - 1).toFixed(1)} ${(padOben + plot).toFixed(1)} L ${xFuer(0).toFixed(1)} ${(padOben + plot).toFixed(1)} Z`

  return (
    <div className="w-full overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${breite} ${hoehe}`} preserveAspectRatio="xMidYMid meet" style={{ minWidth: breite }} role="img" aria-label="Verlauf">
        <line x1={padLinks} y1={padOben + plot} x2={breite - padRechts} y2={padOben + plot} stroke="#334155" strokeWidth={1} />
        <path d={flaeche} fill={farbe} opacity={0.12} />
        <path d={linie} fill="none" stroke={farbe} strokeWidth={1.9} strokeLinejoin="round" />
        {punkte.map((p, i) => (
          <g key={i}>
            <circle cx={xFuer(i)} cy={yFuer(p.wert)} r={2.6} fill={farbe}>
              <title>{`${p.label}: ${format(p.wert)}`}</title>
            </circle>
            {punkte.length <= 14 ? (
              <text x={xFuer(i)} y={hoehe - 7} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 9 }}>
                {p.label}
              </text>
            ) : null}
          </g>
        ))}
        <text x={padLinks} y={padOben + 2} className="fill-slate-600" style={{ fontSize: 9 }}>
          {format(max)}
        </text>
      </svg>
    </div>
  )
}

function Ranking({ zeilen }: { zeilen: { id: string; name: string; wert: number; anzeige: string; farbe: string }[] }) {
  const max = Math.max(1, ...zeilen.map((z) => z.wert))
  if (zeilen.length === 0) return <div className="py-6 text-center text-[12px] text-slate-600">Noch keine Daten.</div>
  return (
    <div className="space-y-2">
      {zeilen.map((z) => (
        <div key={z.id} className="min-w-0">
          <div className="mb-0.5 flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-[12px] font-semibold text-slate-200">{z.name}</span>
            <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-300">{z.anzeige}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full" style={{ width: `${Math.max(3, (z.wert / max) * 100)}%`, backgroundColor: z.farbe }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function LagerAuswertungen({ produkte, refreshKey }: Props) {
  const [einkauf, setEinkauf] = useState<EinkaufRow[]>([])
  const [verbrauch, setVerbrauch] = useState<VerbrauchRow[]>([])
  const [laden, setLaden] = useState(true)
  const [preisArtikel, setPreisArtikel] = useState<string>('')

  const infoMap = useMemo(() => {
    const m = new Map<string, ProduktInfo>()
    for (const p of produkte) m.set(p.id, p)
    return m
  }, [produkte])

  useEffect(() => {
    let abbruch = false
    setLaden(true)
    void (async () => {
      const [{ data: e }, { data: v }] = await Promise.all([
        supabase.from('lager_einkauf').select('produkt_id, gesamtpreis, basis_menge, erstellt_am').order('erstellt_am', { ascending: true }),
        supabase.from('lager_verbrauch').select('produkt_id, menge, erstellt_am').order('erstellt_am', { ascending: true }),
      ])
      if (abbruch) return
      setEinkauf(((e || []) as EinkaufRow[]).filter((r) => r.erstellt_am))
      setVerbrauch(((v || []) as VerbrauchRow[]).filter((r) => r.erstellt_am))
      setLaden(false)
    })()
    return () => {
      abbruch = true
    }
  }, [refreshKey])

  // (a) Ausgaben pro Monat — letzte 12 Monate.
  const ausgabenMonat = useMemo(() => {
    const proMonat = new Map<string, number>()
    for (const r of einkauf) {
      const k = monatsKey(r.erstellt_am)
      if (!k) continue
      proMonat.set(k, (proMonat.get(k) || 0) + (Number(r.gesamtpreis) || 0))
    }
    return letzteMonate(12).map((k) => ({ key: k, wert: Math.round((proMonat.get(k) || 0) * 100) / 100 }))
  }, [einkauf])

  // (b) Ausgaben nach Warengruppe.
  const warengruppe = useMemo<DonutSegment[]>(() => {
    const proKat = new Map<string, number>()
    for (const r of einkauf) {
      const info = infoMap.get(r.produkt_id)
      const kat = normalisiereLagerKategorie(info?.kategorie ?? null)
      proKat.set(kat, (proKat.get(kat) || 0) + (Number(r.gesamtpreis) || 0))
    }
    return [...proKat.entries()]
      .filter(([, b]) => b > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([kat, betrag], i) => ({ key: kat, label: kat, betrag: Math.round(betrag * 100) / 100, farbe: PALETTE[i % PALETTE.length] }))
  }, [einkauf, infoMap])

  // (c) Top-Artikel nach Ausgaben.
  const topArtikel = useMemo(() => {
    const proP = new Map<string, number>()
    for (const r of einkauf) proP.set(r.produkt_id, (proP.get(r.produkt_id) || 0) + (Number(r.gesamtpreis) || 0))
    return [...proP.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, wert], i) => ({
        id,
        name: infoMap.get(id)?.name ?? '—',
        wert: Math.round(wert * 100) / 100,
        anzeige: eur(wert),
        farbe: PALETTE[i % PALETTE.length],
      }))
  }, [einkauf, infoMap])

  // (d) Verbrauch — meistverbrauchte Artikel (Summe Menge in Basiseinheit) + Verbrauch je Monat (Anzahl Buchungen).
  const topVerbrauch = useMemo(() => {
    const proP = new Map<string, number>()
    for (const r of verbrauch) proP.set(r.produkt_id, (proP.get(r.produkt_id) || 0) + (Number(r.menge) || 0))
    return [...proP.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, menge], i) => {
        const info = infoMap.get(id)
        const einheit = basisEinheitFuerPreisanzeige(info?.einheit ?? 'Stück')
        return {
          id,
          name: info?.name ?? '—',
          wert: Math.round(menge * 1000) / 1000,
          anzeige: `${menge.toLocaleString('de-DE', { maximumFractionDigits: 2 })} ${einheit}`,
          farbe: PALETTE[i % PALETTE.length],
        }
      })
  }, [verbrauch, infoMap])

  const verbrauchMonat = useMemo(() => {
    const proMonat = new Map<string, number>()
    for (const r of verbrauch) {
      const k = monatsKey(r.erstellt_am)
      if (!k) continue
      proMonat.set(k, (proMonat.get(k) || 0) + 1)
    }
    return letzteMonate(12).map((k) => ({ label: monatsLabel(k), wert: proMonat.get(k) || 0 }))
  }, [verbrauch])

  // (e) Preisentwicklung je Artikel (Einzelpreis = gesamtpreis / basis_menge).
  const artikelMitEinkaeufen = useMemo(() => {
    const ids = new Set(einkauf.map((r) => r.produkt_id))
    return [...ids]
      .map((id) => ({ id, name: infoMap.get(id)?.name ?? '—' }))
      .filter((x) => x.name !== '—')
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
  }, [einkauf, infoMap])

  useEffect(() => {
    if (!preisArtikel && artikelMitEinkaeufen.length > 0) setPreisArtikel(artikelMitEinkaeufen[0].id)
  }, [artikelMitEinkaeufen, preisArtikel])

  const preisVerlauf = useMemo(() => {
    if (!preisArtikel) return []
    return einkauf
      .filter((r) => r.produkt_id === preisArtikel)
      .map((r) => {
        const basis = Number(r.basis_menge) > 0 ? Number(r.basis_menge) : 0
        const preis = basis > 0 ? (Number(r.gesamtpreis) || 0) / basis : null
        const d = new Date(r.erstellt_am)
        return preis != null && Number.isFinite(preis)
          ? { label: d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }), wert: Math.round(preis * 100) / 100 }
          : null
      })
      .filter((x): x is { label: string; wert: number } => x != null)
  }, [einkauf, preisArtikel])

  // (f) Vorratswert-Verlauf (Näherung): kumuliert Einkaufswert − Verbrauchswert (Ø-Preis je Artikel) je Monat.
  const vorratswertVerlauf = useMemo(() => {
    const avg = new Map<string, number>()
    {
      const sumP = new Map<string, number>()
      const sumM = new Map<string, number>()
      for (const r of einkauf) {
        const m = Number(r.basis_menge) > 0 ? Number(r.basis_menge) : 0
        sumP.set(r.produkt_id, (sumP.get(r.produkt_id) || 0) + (Number(r.gesamtpreis) || 0))
        sumM.set(r.produkt_id, (sumM.get(r.produkt_id) || 0) + m)
      }
      for (const id of sumP.keys()) {
        const m = sumM.get(id) || 0
        if (m > 0) avg.set(id, (sumP.get(id) || 0) / m)
      }
    }
    const netto = new Map<string, number>()
    for (const r of einkauf) {
      const k = monatsKey(r.erstellt_am)
      if (k) netto.set(k, (netto.get(k) || 0) + (Number(r.gesamtpreis) || 0))
    }
    for (const r of verbrauch) {
      const k = monatsKey(r.erstellt_am)
      if (!k) continue
      const wert = (Number(r.menge) || 0) * (avg.get(r.produkt_id) || 0)
      netto.set(k, (netto.get(k) || 0) - wert)
    }
    let lauf = 0
    return letzteMonate(12).map((k) => {
      lauf += netto.get(k) || 0
      return { label: monatsLabel(k), wert: Math.max(0, Math.round(lauf * 100) / 100) }
    })
  }, [einkauf, verbrauch])

  if (laden) {
    return <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-10 text-center text-sm text-slate-500">Auswertungen werden geladen…</div>
  }

  const keineDaten = einkauf.length === 0 && verbrauch.length === 0
  if (keineDaten) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-10 text-center text-sm text-slate-500">
        Noch keine Einkäufe oder Verbräuche erfasst — sobald du buchst, erscheinen hier Diagramme.
      </div>
    )
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <Karte titel="Ausgaben pro Monat" hint="Summe der Einkäufe je Monat (letzte 12)">
        <MonatsBalken daten={ausgabenMonat} />
      </Karte>

      <Karte titel="Ausgaben nach Warengruppe" hint="Wofür das Geld ausgegeben wurde">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <DonutChart segmente={warengruppe} />
          <div className="min-w-0 flex-1 space-y-1.5">
            {warengruppe.slice(0, 8).map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.farbe }} />
                  <span className="truncate text-slate-300">{s.label}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-200">{eur(s.betrag)}</span>
              </div>
            ))}
            {warengruppe.length === 0 ? <p className="text-[12px] text-slate-600">Keine Daten.</p> : null}
          </div>
        </div>
      </Karte>

      <Karte titel="Top-Artikel nach Ausgaben" hint="Wohin am meisten Geld floss">
        <Ranking zeilen={topArtikel} />
      </Karte>

      <Karte titel="Meistverbrauchte Artikel" hint="Summe ausgebuchter Menge je Artikel">
        <Ranking zeilen={topVerbrauch} />
      </Karte>

      <Karte titel="Preisentwicklung je Artikel" hint="Einzelpreis je Basiseinheit pro Einkauf">
        {artikelMitEinkaeufen.length > 0 ? (
          <select
            value={preisArtikel}
            onChange={(e) => setPreisArtikel(e.target.value)}
            className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            {artikelMitEinkaeufen.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        ) : null}
        <LinienChart punkte={preisVerlauf} farbe="#fbbf24" />
      </Karte>

      <Karte titel="Vorratswert-Verlauf" hint="Geschätzt: Einkäufe − Verbrauch (Ø-Preis), kumuliert">
        <LinienChart punkte={vorratswertVerlauf} farbe="#a78bfa" />
      </Karte>

      <Karte titel="Verbrauch je Monat" hint="Anzahl Ausbuchungen je Monat (letzte 12)">
        <LinienChart punkte={verbrauchMonat} farbe="#34d399" format={(n) => `${n}`} />
      </Karte>
    </div>
  )
}
