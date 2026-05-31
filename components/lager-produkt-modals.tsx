'use client'

import { appModalBackdropClassName, appModalPanelClassName } from '@/lib/app-modal-overlay'
import { basisEinheitFuerPreisanzeige } from '@/lib/lager-einheiten'
import { LAGER_PRODUKT_KATEGORIEN, normalisiereLagerKategorie } from '@/lib/lager-produkt-kategorie'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

export type LagerProduktModalZeile = {
  id: string
  name: string
  einheit: string
  /** Basiseinheit für Bestand / Verbrauch (kg, Liter, Stück). */
  basis_einheit: string
  kategorie: string
  bestand: number
  /** MHD als 'YYYY-MM-DD' oder null. */
  mhd?: string | null
  /** Mindestvorrat in Basiseinheit oder null. */
  mindestbestand?: number | null
  /** Immer auf Einkaufsliste wenn unter Mindestbestand. */
  immer_da?: boolean
}

type Modus = 'bearbeiten' | 'verbrauch' | null

type Props = {
  modus: Modus
  produkt: LagerProduktModalZeile | null
  onClose: () => void
  onErfolg: () => void
}

function BearbeitenForm({
  produkt,
  onClose,
  onErfolg,
}: {
  produkt: LagerProduktModalZeile
  onClose: () => void
  onErfolg: () => void
}) {
  const [name, setName] = useState(produkt.name)
  const [kategorie, setKategorie] = useState<string>(normalisiereLagerKategorie(produkt.kategorie))
  const [mhd, setMhd] = useState<string>(produkt.mhd ?? '')
  const [mindestbestand, setMindestbestand] = useState<string>(
    produkt.mindestbestand != null && produkt.mindestbestand > 0 ? String(produkt.mindestbestand).replace('.', ',') : '',
  )
  const [immerDa, setImmerDa] = useState(Boolean(produkt.immer_da))
  const [pending, setPending] = useState(false)
  const einheitLabel = basisEinheitFuerPreisanzeige(produkt.basis_einheit)

  async function speichernProdukt() {
    const n = name.trim()
    if (!n) {
      toast.error('Name fehlt.')
      return
    }
    const pid = produkt.id
    const kat = normalisiereLagerKategorie(kategorie)

    const mhdWert = mhd.trim() ? mhd.trim() : null
    const minRoh = mindestbestand.trim().replace(',', '.')
    let minWert: number | null = null
    if (minRoh) {
      const num = Number(minRoh)
      if (!Number.isFinite(num) || num < 0) {
        toast.error('Mindestbestand muss eine Zahl ≥ 0 sein.')
        return
      }
      minWert = num > 0 ? Math.round(num * 1000) / 1000 : null
    }

    setPending(true)
    try {
      const res = await fetch('/api/lager/produkt', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: pid,
          name: n,
          kategorie: kat,
          mhd: mhdWert,
          mindestbestand: minWert,
          immer_da: immerDa,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok && res.status !== 501) {
        toast.error(data.error || 'Speichern fehlgeschlagen.')
        return
      }
      if (res.status === 501) {
        const { error } = await supabase
          .from('produkte')
          .update({ name: n, kategorie: kat, mhd: mhdWert, mindestbestand: minWert, immer_da: immerDa })
          .eq('id', pid)
        if (error) {
          toast.error(
            error.message.includes('policy') || error.message.includes('RLS')
              ? 'Speichern nicht erlaubt: UPDATE für „produkte“ mit dem Anon-Key erlauben, oder SUPABASE_SERVICE_ROLE_KEY setzen.'
              : error.message,
          )
          return
        }
      }
      toast.success(res.status === 501 ? 'Artikel gespeichert (ohne Service Role).' : 'Artikel gespeichert.')
      onErfolg()
      onClose()
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <h3 id="lager-modal-title" className="mb-4 text-lg font-bold text-slate-100">
        Artikel bearbeiten
      </h3>
      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Name</label>
      <input
        className="mb-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/40"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={pending}
      />
      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Kategorie</label>
      <select
        className="mb-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/40"
        value={kategorie}
        onChange={(e) => setKategorie(e.target.value)}
        disabled={pending}
      >
        {LAGER_PRODUKT_KATEGORIEN.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Haltbar bis (MHD)
          <input
            type="date"
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-amber-500/40"
            value={mhd}
            onChange={(e) => setMhd(e.target.value)}
            disabled={pending}
          />
        </label>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Mindestbestand ({einheitLabel})
          <input
            type="text"
            inputMode="decimal"
            placeholder="z. B. 2"
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/40"
            value={mindestbestand}
            onChange={(e) => setMindestbestand(e.target.value)}
            disabled={pending}
          />
        </label>
      </div>
      <label className="mb-4 flex cursor-pointer items-center gap-2.5 rounded-lg border border-teal-800/40 bg-teal-950/20 px-3 py-2.5">
        <input
          type="checkbox"
          checked={immerDa}
          onChange={(e) => setImmerDa(e.target.checked)}
          disabled={pending}
          className="h-4 w-4 rounded border-slate-600"
        />
        <span className="text-sm font-semibold text-teal-100">Immer da (Favorit)</span>
        <span className="text-[11px] text-slate-500">— bleibt auf der Einkaufsliste, wenn leer oder unter Mindestbestand</span>
      </label>
      <p className="mb-6 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-400">
        Basiseinheit (fest): <span className="font-semibold text-slate-200">{einheitLabel}</span>
        <span className="mt-1 block text-slate-500">
          MHD speist die Ablauf-Ampel, der Mindestbestand die „Nachkaufen"-Liste in der Übersicht.
        </span>
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          className="flex-1 rounded-xl border border-slate-600 py-3 font-bold text-slate-300 transition hover:bg-slate-800"
          onClick={() => !pending && onClose()}
          disabled={pending}
        >
          Abbrechen
        </button>
        <button
          type="button"
          className="flex-1 rounded-xl bg-emerald-600 py-3 font-black text-white transition hover:bg-emerald-500 disabled:opacity-50"
          onClick={() => void speichernProdukt()}
          disabled={pending}
        >
          {pending ? '…' : 'Speichern'}
        </button>
      </div>
    </>
  )
}

function VerbrauchForm({
  produkt,
  onClose,
  onErfolg,
}: {
  produkt: LagerProduktModalZeile
  onClose: () => void
  onErfolg: () => void
}) {
  const [verbrauchMenge, setVerbrauchMenge] = useState('')
  const [verbrauchNotiz, setVerbrauchNotiz] = useState('')
  const [pending, setPending] = useState(false)

  async function bucheVerbrauch() {
    const m = Number(String(verbrauchMenge).replace(',', '.'))
    if (!Number.isFinite(m) || m <= 0) {
      toast.error('Bitte eine positive Menge eingeben.')
      return
    }
    const pid = produkt.id
    setPending(true)
    try {
      const res = await fetch('/api/lager/verbrauch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produkt_id: pid,
          menge: m,
          notiz: verbrauchNotiz.trim() || undefined,
        }),
      })
      const data = (await res.json()) as { error?: string; neue_menge?: number }
      if (!res.ok) {
        toast.error(data.error || 'Ausbuchen fehlgeschlagen.')
        return
      }
      const u = basisEinheitFuerPreisanzeige(produkt.basis_einheit)
      toast.success(
        typeof data.neue_menge === 'number'
          ? `Verbrauch gebucht. Neuer Bestand: ${data.neue_menge} ${u}.`
          : 'Verbrauch gebucht.',
      )
      onErfolg()
      onClose()
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <h3 id="lager-modal-title" className="mb-1 text-lg font-bold text-slate-100">
        Verbrauch ausbuchen
      </h3>
      <p className="mb-4 text-sm text-slate-400">
        <span className="font-semibold text-slate-200">{produkt.name}</span> — aktuell{' '}
        <span className="tabular-nums text-amber-200/95">
          {produkt.bestand} {basisEinheitFuerPreisanzeige(produkt.basis_einheit)}
        </span>
      </p>
      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
        Menge (Abgang in {basisEinheitFuerPreisanzeige(produkt.basis_einheit)})
      </label>
      <input
        type="text"
        inputMode="decimal"
        className="mb-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-amber-500/40"
        value={verbrauchMenge}
        onChange={(e) => setVerbrauchMenge(e.target.value)}
        placeholder="z. B. 1 oder 0,5"
        disabled={pending}
      />
      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Notiz (optional)</label>
      <input
        className="mb-6 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none focus:ring-2 focus:ring-amber-500/40"
        value={verbrauchNotiz}
        onChange={(e) => setVerbrauchNotiz(e.target.value)}
        placeholder="z. B. gegessen, geschenkt …"
        disabled={pending}
      />
      <div className="flex gap-3">
        <button
          type="button"
          className="flex-1 rounded-xl border border-slate-600 py-3 font-bold text-slate-300 transition hover:bg-slate-800"
          onClick={() => !pending && onClose()}
          disabled={pending}
        >
          Abbrechen
        </button>
        <button
          type="button"
          className="flex-1 rounded-xl bg-amber-600 py-3 font-black text-white transition hover:bg-amber-500 disabled:opacity-50"
          onClick={() => void bucheVerbrauch()}
          disabled={pending}
        >
          {pending ? '…' : 'Ausbuchen'}
        </button>
      </div>
    </>
  )
}

export function LagerProduktModals({ modus, produkt, onClose, onErfolg }: Props) {
  useEffect(() => {
    if (!modus || !produkt) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modus, produkt, onClose])

  if (!modus || !produkt) return null

  const formKey = `${modus}-${produkt.id}`

  return (
    <div
      className={appModalBackdropClassName}
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`${appModalPanelClassName} p-6`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lager-modal-title"
      >
        {modus === 'bearbeiten' ? (
          <BearbeitenForm key={formKey} produkt={produkt} onClose={onClose} onErfolg={onErfolg} />
        ) : (
          <VerbrauchForm key={formKey} produkt={produkt} onClose={onClose} onErfolg={onErfolg} />
        )}
      </div>
    </div>
  )
}
