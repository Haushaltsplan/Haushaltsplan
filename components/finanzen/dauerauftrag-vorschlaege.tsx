'use client'

import {
  finanzListItemClass,
  finanzSecondaryBtnClass,
  finanzTitleClass,
} from '@/components/finanzen/finanzen-ui'
import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Buchung = { kategorie?: string | null; betrag?: number | string | null; datum?: string | null; beschreibung?: string | null }
type Dauerauftrag = { typ?: string; kategorie?: string | null }

type Vorschlag = {
  key: string
  typ: 'einnahme' | 'ausgabe'
  kategorie: string
  betrag: number
  tag: number
  monate: number
}

function eur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function monatsKey(iso?: string | null): string | null {
  if (!iso) return null
  const m = String(iso).slice(0, 7).match(/^(\d{4})-(\d{2})$/)
  if (m) return `${m[1]}-${m[2]}`
  const d = new Date(String(iso))
  return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function tagDesMonats(iso?: string | null): number | null {
  if (!iso) return null
  const m = String(iso).slice(0, 10).match(/^\d{4}-\d{2}-(\d{2})$/)
  if (m) return Number(m[1])
  const d = new Date(String(iso))
  return Number.isNaN(d.getTime()) ? null : d.getDate()
}

function median(werte: number[]): number {
  if (werte.length === 0) return 0
  const s = [...werte].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function istAutoDauerauftrag(b?: string | null) {
  return typeof b === 'string' && b.includes('Dauerauftrag (Auto)')
}

/**
 * Erkennt wiederkehrende Buchungen (gleicher Anbieter in ≥ 3 Monaten, ähnlicher Betrag), die noch
 * keinen Dauerauftrag haben, und bietet das Anlegen per Klick an.
 */
export function DauerauftragVorschlaege({
  einnahmen,
  ausgaben,
  dauerauftraege,
  onAngelegt,
}: {
  einnahmen: Buchung[]
  ausgaben: Buchung[]
  dauerauftraege: Dauerauftrag[]
  onAngelegt: () => void | Promise<void>
}) {
  const [verworfen, setVerworfen] = useState<Set<string>>(new Set())
  const [laeuftKey, setLaeuftKey] = useState<string | null>(null)

  const vorhandene = useMemo(
    () => new Set(dauerauftraege.map((d) => String(d.kategorie ?? '').trim().toLowerCase())),
    [dauerauftraege],
  )

  const vorschlaege = useMemo<Vorschlag[]>(() => {
    type Gruppe = { namen: Map<string, number>; monate: Set<string>; betraege: number[]; tage: number[] }
    const baueFuer = (rows: Buchung[], typ: 'einnahme' | 'ausgabe'): Vorschlag[] => {
      const gruppen = new Map<string, Gruppe>()
      for (const r of rows) {
        if (istAutoDauerauftrag(r.beschreibung)) continue
        const name = String(r.kategorie ?? '').trim()
        if (!name) continue
        const norm = name.toLowerCase()
        const betrag = Number(r.betrag)
        const mk = monatsKey(r.datum)
        if (!Number.isFinite(betrag) || betrag <= 0 || !mk) continue
        const g: Gruppe = gruppen.get(norm) ?? { namen: new Map(), monate: new Set(), betraege: [], tage: [] }
        g.namen.set(name, (g.namen.get(name) ?? 0) + 1)
        g.monate.add(mk)
        g.betraege.push(betrag)
        const t = tagDesMonats(r.datum)
        if (t != null) g.tage.push(t)
        gruppen.set(norm, g)
      }
      const out: Vorschlag[] = []
      for (const [norm, g] of gruppen) {
        if (vorhandene.has(norm)) continue
        if (g.monate.size < 3) continue
        const min = Math.min(...g.betraege)
        const max = Math.max(...g.betraege)
        if (min > 0 && max > min * 3) continue // zu unterschiedliche Beträge → vermutlich kein Dauerauftrag
        const name = [...g.namen.entries()].sort((a, b) => b[1] - a[1])[0][0]
        const betrag = Math.round(median(g.betraege) * 100) / 100
        const tag = Math.min(Math.max(Math.round(median(g.tage)) || 1, 1), 31)
        out.push({ key: `${typ}:${norm}`, typ, kategorie: name, betrag, tag, monate: g.monate.size })
      }
      return out
    }
    return [...baueFuer(ausgaben, 'ausgabe'), ...baueFuer(einnahmen, 'einnahme')]
      .filter((v) => !verworfen.has(v.key))
      .sort((a, b) => b.monate - a.monate || b.betrag - a.betrag)
      .slice(0, 6)
  }, [einnahmen, ausgaben, vorhandene, verworfen])

  async function anlegen(v: Vorschlag) {
    setLaeuftKey(v.key)
    try {
      const { error } = await supabase.from('dauerauftraege').insert([
        { typ: v.typ, kategorie: v.kategorie, betrag: v.betrag, tag_des_monats: v.tag },
      ])
      if (error) {
        toast.error('Dauerauftrag konnte nicht angelegt werden.')
        return
      }
      toast.success(`Dauerauftrag angelegt: ${v.kategorie}`)
      setVerworfen((prev) => new Set(prev).add(v.key))
      await onAngelegt()
    } finally {
      setLaeuftKey(null)
    }
  }

  if (vorschlaege.length === 0) return null

  return (
    <div className="mb-4 rounded-xl border border-amber-700/40 bg-amber-950/15 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300/90">Erkannte wiederkehrende Buchungen</p>
      <p className="mt-1 text-[12px] text-[var(--app-text-muted)]">
        Diese Positionen tauchen regelmäßig auf, haben aber noch keinen Dauerauftrag. Per Klick übernehmen:
      </p>
      <ul className="mt-3 space-y-2">
        {vorschlaege.map((v) => (
          <li
            key={v.key}
            className={`flex flex-col gap-2 ${finanzListItemClass} sm:flex-row sm:items-center sm:justify-between`}
          >
            <div className="min-w-0">
              <p className={finanzTitleClass}>{v.kategorie}</p>
              <p className="text-[11px] text-[var(--app-text-muted)]">
                <span className={v.typ === 'einnahme' ? 'text-emerald-400/95' : 'text-rose-400/95'}>
                  {v.typ === 'einnahme' ? 'Einnahme' : 'Ausgabe'}
                </span>{' '}
                · ca. {eur(v.betrag)} · Tag {v.tag} · {v.monate} Monate erkannt
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={laeuftKey === v.key}
                onClick={() => void anlegen(v)}
                className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-sky-500 disabled:opacity-40"
              >
                {laeuftKey === v.key ? '…' : 'Als Dauerauftrag anlegen'}
              </button>
              <button
                type="button"
                onClick={() => setVerworfen((prev) => new Set(prev).add(v.key))}
                className={finanzSecondaryBtnClass}
              >
                Ignorieren
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
