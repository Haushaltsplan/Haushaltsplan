'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { merkeFuerEinkauf } from '@/lib/einkaufsliste-merker'
import { parseEinzelGericht, type RezeptGericht } from '@/lib/rezept-coach-types'
import { supabase } from '@/lib/supabase'

export type WasKochenArtikel = { id: string; name: string; menge: number; einheit: string }

type Props = { artikel: WasKochenArtikel[]; refreshKey: number }

type Fehlend = { name: string; fehlt: number; einheit: string; produktId?: string }

type RezeptTreffer = {
  id: string
  titel: string
  portionen: number
  gericht: RezeptGericht
  fehlend: Fehlend[]
  machbar: boolean
}

function fehlendeZutaten(gericht: RezeptGericht, artikel: WasKochenArtikel[]): Fehlend[] {
  const out: Fehlend[] = []
  for (const z of gericht.zutaten || []) {
    if (!z.aus_lager || !z.produkt_id) continue
    const pid = String(z.produkt_id).trim()
    const vor = artikel.find((a) => a.id === pid)?.menge ?? 0
    if (z.menge > vor + 1e-6) {
      out.push({
        name: z.name,
        fehlt: Math.round((z.menge - vor) * 1000) / 1000,
        einheit: z.einheit,
        produktId: pid,
      })
    }
  }
  return out
}

export function LagerWasKochen({ artikel, refreshKey }: Props) {
  const [treffer, setTreffer] = useState<RezeptTreffer[]>([])
  const [laden, setLaden] = useState(false)
  const [offen, setOffen] = useState(true)

  const lade = useCallback(async () => {
    setLaden(true)
    try {
      const { data, error } = await supabase
        .from('lager_rezept_katalog')
        .select('id, titel, portionen, gericht_json')
        .order('erstellt_am', { ascending: false })
        .limit(40)
      if (error) {
        setTreffer([])
        return
      }
      const rows: RezeptTreffer[] = []
      for (const r of data || []) {
        const o = r as Record<string, unknown>
        const id = String(o.id || '')
        const ger = parseEinzelGericht(o.gericht_json)
        if (!id || !ger) continue
        const fehlend = fehlendeZutaten(ger, artikel)
        const lagerZ = (ger.zutaten || []).filter((z) => z.aus_lager && z.produkt_id)
        if (lagerZ.length === 0) continue
        rows.push({
          id,
          titel: typeof o.titel === 'string' ? o.titel : ger.titel,
          portionen: Number(o.portionen) || ger.portionen,
          gericht: ger,
          fehlend,
          machbar: fehlend.length === 0,
        })
      }
      rows.sort((a, b) => {
        if (a.machbar !== b.machbar) return a.machbar ? -1 : 1
        return a.fehlend.length - b.fehlend.length
      })
      setTreffer(rows.slice(0, 8))
    } finally {
      setLaden(false)
    }
  }, [artikel])

  useEffect(() => {
    void lade()
  }, [lade, refreshKey])

  const machbare = useMemo(() => treffer.filter((t) => t.machbar), [treffer])
  const fastFertig = useMemo(() => treffer.filter((t) => !t.machbar && t.fehlend.length <= 2), [treffer])

  function fehlendeAufListe(t: RezeptTreffer) {
    let n = 0
    for (const f of t.fehlend) {
      if (f.produktId) {
        merkeFuerEinkauf(f.produktId)
        n++
      }
    }
    if (n > 0) toast.success(`${n} fehlende Zutat(en) auf die Einkaufsliste gesetzt.`)
    else toast.error('Keine Lager-Zutaten mit Produkt-ID zum Merken.')
  }

  if (laden && treffer.length === 0) {
    return (
      <div className="rounded-xl border border-violet-800/40 bg-violet-950/15 px-4 py-6 text-center text-sm text-slate-500">
        Rezepte werden geprüft…
      </div>
    )
  }

  if (treffer.length === 0) {
    return null
  }

  return (
    <div className="overflow-hidden rounded-xl border border-violet-800/45 bg-slate-900/95 shadow-md shadow-black/20">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-800/40"
        aria-expanded={offen}
      >
        <div>
          <h2 className="text-sm font-bold text-violet-100 sm:text-base">Was kann ich kochen?</h2>
          <p className="text-[11px] text-slate-500">
            {machbare.length} sofort machbar · {fastFertig.length} fast komplett
          </p>
        </div>
        <span className="text-xs font-bold text-violet-300">{offen ? '▲' : '▼'}</span>
      </button>
      {offen && (
        <div className="space-y-2 border-t border-slate-800/80 px-3 pb-3 pt-2 sm:px-4">
          {treffer.map((t) => (
            <div
              key={t.id}
              className={`rounded-xl border px-3 py-2.5 ${
                t.machbar ? 'border-emerald-800/45 bg-emerald-950/20' : 'border-slate-700/60 bg-slate-950/40'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-100">{t.titel}</p>
                  <p className="text-[11px] text-slate-500">{t.portionen} Portionen</p>
                </div>
                {t.machbar ? (
                  <span className="shrink-0 rounded border border-emerald-700/50 bg-emerald-900/40 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                    Alles da
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => fehlendeAufListe(t)}
                    className="shrink-0 rounded-lg border border-sky-600/55 bg-sky-950/40 px-2.5 py-1 text-[11px] font-bold text-sky-100 hover:bg-sky-900/40"
                  >
                    Fehlendes merken
                  </button>
                )}
              </div>
              {!t.machbar && t.fehlend.length > 0 ? (
                <p className="mt-1.5 text-[11px] text-amber-200/90">
                  Fehlt: {t.fehlend.map((f) => `${f.name} (${f.fehlt} ${f.einheit})`).join(', ')}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
