'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { CollapsibleRowHeaderEnd, LABEL_EINKLAPPEN } from '@/components/collapsible-ui'
import { supabase } from '@/lib/supabase'

export type LagerVerlaufProduktInfo = { id: string; name: string; einheit: string }

type EinkaufRow = {
  id: string
  produkt_id: string
  menge: number
  basis_menge?: number | null
  gesamtpreis: number
  erstellt_am: string
  quelle: string | null
}

type VerbrauchRow = {
  id: string
  produkt_id: string
  menge: number
  notiz: string | null
  erstellt_am: string
  quelle: string | null
  mahlzeit_id: string | null
}

type MahlzeitKurz = { id: string; titel: string }

type VerlaufEintrag =
  | {
      key: string
      kind: 'einkauf'
      zeit: string
      produkt_id: string
      menge: number
      gesamtpreis: number
      quelle: string
      id: string
    }
  | {
      key: string
      kind: 'verbrauch'
      zeit: string
      produkt_id: string
      menge: number
      notiz: string | null
      quelle: string
      id: string
      mahlzeit_id: string | null
    }

function formatEur(n: number) {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatZeit(iso: string) {
  try {
    return new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

type Props = {
  produktInfos: LagerVerlaufProduktInfo[]
  refreshKey: number
  onNachAenderung: () => void
}

export function LagerBestandVerlauf({ produktInfos, refreshKey, onNachAenderung }: Props) {
  const [open, setOpen] = useState(false)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [einkaeufe, setEinkaeufe] = useState<EinkaufRow[]>([])
  const [verbraeuche, setVerbraeuche] = useState<VerbrauchRow[]>([])
  const [mahlzeitTitel, setMahlzeitTitel] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState('')
  const [rueckgaengigId, setRueckgaengigId] = useState<string | null>(null)

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of produktInfos) m.set(p.id, p.name)
    return m
  }, [produktInfos])

  const einheitById = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of produktInfos) m.set(p.id, p.einheit)
    return m
  }, [produktInfos])

  const ladeAlles = useCallback(async () => {
    setLaden(true)
    setFehler(null)
    try {
      const [einRes, verRes] = await Promise.all([
        supabase
          .from('lager_einkauf')
          .select('id, produkt_id, menge, basis_menge, gesamtpreis, erstellt_am, quelle')
          .order('erstellt_am', { ascending: false })
          .limit(200),
        supabase
          .from('lager_verbrauch')
          .select('id, produkt_id, menge, notiz, erstellt_am, quelle, mahlzeit_id')
          .order('erstellt_am', { ascending: false })
          .limit(200),
      ])

      if (einRes.error) {
        setFehler(einRes.error.message || 'Einkäufe konnten nicht geladen werden.')
        setEinkaeufe([])
      } else {
        setEinkaeufe((einRes.data || []) as EinkaufRow[])
      }

      if (verRes.error) {
        setFehler(verRes.error.message || 'Verbrauch konnte nicht geladen werden.')
        setVerbraeuche([])
      } else {
        const vb = (verRes.data || []) as VerbrauchRow[]
        setVerbraeuche(vb)
        const mids = [...new Set(vb.map((v) => v.mahlzeit_id).filter(Boolean))] as string[]
        if (mids.length) {
          const { data: mz, error: mErr } = await supabase.from('lager_mahlzeit').select('id, titel').in('id', mids)
          if (!mErr && mz) {
            const map: Record<string, string> = {}
            for (const row of mz as MahlzeitKurz[]) map[row.id] = row.titel
            setMahlzeitTitel(map)
          } else {
            setMahlzeitTitel({})
          }
        } else {
          setMahlzeitTitel({})
        }
      }
    } finally {
      setLaden(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void ladeAlles()
  }, [open, refreshKey, ladeAlles])

  const zeilen = useMemo(() => {
    const f = filter.trim().toLowerCase()
    const out: VerlaufEintrag[] = []
    for (const e of einkaeufe) {
      const basis = Number(e.basis_menge) > 0 ? Number(e.basis_menge) : Number(e.menge) || 0
      const name = (nameById.get(e.produkt_id) || '').toLowerCase()
      if (f && !name.includes(f)) continue
      out.push({
        key: `e-${e.id}`,
        kind: 'einkauf',
        zeit: e.erstellt_am,
        produkt_id: e.produkt_id,
        menge: basis,
        gesamtpreis: Number(e.gesamtpreis) || 0,
        quelle: (e.quelle || 'kassenzettel').trim() || 'kassenzettel',
        id: e.id,
      })
    }
    for (const v of verbraeuche) {
      const name = (nameById.get(v.produkt_id) || '').toLowerCase()
      if (f && !name.includes(f)) continue
      out.push({
        key: `v-${v.id}`,
        kind: 'verbrauch',
        zeit: v.erstellt_am,
        produkt_id: v.produkt_id,
        menge: Number(v.menge) || 0,
        notiz: v.notiz,
        quelle: (v.quelle || 'manuell').trim() || 'manuell',
        id: v.id,
        mahlzeit_id: v.mahlzeit_id,
      })
    }
    out.sort((a, b) => new Date(b.zeit).getTime() - new Date(a.zeit).getTime())
    return out
  }, [einkaeufe, verbraeuche, filter, nameById])

  async function macheRueckgaengig(verbrauchId: string) {
    if (!confirm('Diese Ausbuchung wirklich rückgängig machen? Der Bestand wird wieder erhöht.')) return
    setRueckgaengigId(verbrauchId)
    try {
      const res = await fetch('/api/lager/verbrauch/rueckgaengig', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verbrauch_id: verbrauchId }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.status === 501) {
        toast.error(typeof body.error === 'string' ? body.error : 'Service Role fehlt.')
        return
      }
      if (!res.ok) {
        toast.error(typeof body.error === 'string' ? body.error : 'Stornieren fehlgeschlagen.')
        return
      }
      toast.success('Ausbuchung wurde storniert.')
      void ladeAlles()
      onNachAenderung()
    } catch {
      toast.error('Netzwerkfehler.')
    } finally {
      setRueckgaengigId(null)
    }
  }

  return (
    <div className="rounded-[2rem] border border-slate-800 bg-slate-900 shadow-xl shadow-black/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-slate-800/40 md:px-8"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-lg font-black text-sky-300">Bestandsverlauf</h2>
          <p className="mt-1 text-sm text-slate-500">
            Einkäufe und Ausbuchungen chronologisch. Bei Ausbuchungen: <span className="font-semibold text-slate-400">Storno</span>{' '}
            stellt den Bestand wieder her (braucht Service Role).
          </p>
        </div>
        <CollapsibleRowHeaderEnd open={open} labels={LABEL_EINKLAPPEN} tone="sky" />
      </button>

      {open && (
        <div className="border-t border-slate-800 px-4 pb-5 pt-3 md:px-8">
          {fehler && (
            <p className="mb-3 rounded-xl border border-amber-800/60 bg-amber-950/35 p-3 text-xs leading-relaxed text-amber-100">
              {fehler}
            </p>
          )}

          <div className="mb-3 flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Filter (Produktname)</label>
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="z. B. Tomate"
                className="mt-1 w-full max-w-md rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/40"
              />
            </div>
            <button
              type="button"
              disabled={laden}
              onClick={() => void ladeAlles()}
              className="rounded-lg border border-slate-600 bg-slate-800/80 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              Aktualisieren
            </button>
          </div>

          {laden && <p className="text-xs text-slate-500">Lade Verlauf …</p>}

          {!laden && zeilen.length === 0 && !fehler && (
            <p className="text-sm text-slate-500">Noch keine Einträge oder Filter passt zu nichts.</p>
          )}

          {!laden && zeilen.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-800/90">
              <table className="min-w-[42rem] w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <th className="px-2 py-2 md:px-3">Zeit</th>
                    <th className="px-2 py-2 md:px-3">Art</th>
                    <th className="px-2 py-2 md:px-3">Produkt</th>
                    <th className="px-2 py-2 md:px-3">Menge</th>
                    <th className="px-2 py-2 md:px-3">Details</th>
                    <th className="px-2 py-2 text-right md:px-3">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {zeilen.map((z) => {
                    const pname = nameById.get(z.produkt_id) || z.produkt_id.slice(0, 8)
                    const eu = einheitById.get(z.produkt_id) || ''
                    if (z.kind === 'einkauf') {
                      return (
                        <tr key={z.key} className="border-b border-slate-800/80 hover:bg-slate-950/40">
                          <td className="whitespace-nowrap px-2 py-2 tabular-nums text-slate-400 md:px-3">
                            {formatZeit(z.zeit)}
                          </td>
                          <td className="px-2 py-2 md:px-3">
                            <span className="rounded-md bg-emerald-950/70 px-1.5 py-0.5 font-bold text-emerald-200">Einkauf</span>
                          </td>
                          <td className="max-w-[14rem] truncate px-2 py-2 font-semibold text-slate-200 md:px-3">{pname}</td>
                          <td className="whitespace-nowrap px-2 py-2 font-mono tabular-nums text-emerald-200 md:px-3">
                            +{z.menge} {eu}
                          </td>
                          <td className="max-w-[18rem] truncate px-2 py-2 text-slate-500 md:px-3">
                            {formatEur(z.gesamtpreis)} · {z.quelle}
                          </td>
                          <td className="px-2 py-2 text-right text-slate-600 md:px-3">—</td>
                        </tr>
                      )
                    }
                    const mt = z.mahlzeit_id ? mahlzeitTitel[z.mahlzeit_id] : null
                    return (
                      <tr key={z.key} className="border-b border-slate-800/80 hover:bg-slate-950/40">
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums text-slate-400 md:px-3">
                          {formatZeit(z.zeit)}
                        </td>
                        <td className="px-2 py-2 md:px-3">
                          <span className="rounded-md bg-amber-950/70 px-1.5 py-0.5 font-bold text-amber-200">Abgang</span>
                        </td>
                        <td className="max-w-[14rem] truncate px-2 py-2 font-semibold text-slate-200 md:px-3">{pname}</td>
                        <td className="whitespace-nowrap px-2 py-2 font-mono tabular-nums text-amber-200 md:px-3">
                          −{z.menge} {eu}
                        </td>
                        <td className="max-w-[18rem] px-2 py-2 text-slate-500 md:px-3">
                          <span className="line-clamp-2">
                            {z.notiz ? <span>{z.notiz}</span> : <span className="text-slate-600">—</span>}
                            {mt ? (
                              <span className="mt-0.5 block text-[10px] text-slate-600">Mahlzeit: {mt}</span>
                            ) : null}
                            <span className="mt-0.5 block text-[10px] text-slate-600">{z.quelle}</span>
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right md:px-3">
                          <button
                            type="button"
                            disabled={rueckgaengigId !== null}
                            onClick={() => void macheRueckgaengig(z.id)}
                            className="rounded-lg border border-rose-800/60 bg-rose-950/35 px-2 py-1 text-[11px] font-bold text-rose-100 hover:bg-rose-900/40 disabled:opacity-40"
                          >
                            {rueckgaengigId === z.id ? '…' : 'Rückgängig'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
            Einkäufe können hier nicht storniert werden (nur Abgänge). Gehört eine Abgang-Zeile zu einer Mahlzeit, wird die
            Kostenschätzung der Mahlzeit neu berechnet; war es die letzte Zeile, wird die Mahlzeit entfernt.
          </p>
        </div>
      )}
    </div>
  )
}
