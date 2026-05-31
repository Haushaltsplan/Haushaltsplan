'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { PageSection, PageSectionPanel } from '@/components/page-shell'
import {
  ladeSparziele,
  speichereSparziel,
  loescheSparziel,
  type SparzielRow,
} from '@/lib/finanz-extra-db'

function eur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

/** Anzahl voller Monate von heute bis Zieldatum (mind. 0). */
function monateBisDatum(zieldatum: string | null): number | null {
  if (!zieldatum) return null
  const ziel = new Date(zieldatum)
  if (Number.isNaN(ziel.getTime())) return null
  const jetzt = new Date()
  const monate = (ziel.getFullYear() - jetzt.getFullYear()) * 12 + (ziel.getMonth() - jetzt.getMonth())
  return Math.max(0, monate)
}

type FormState = {
  id?: string
  titel: string
  zielbetrag: string
  aktuell: string
  zieldatum: string
}

const LEER: FormState = { titel: '', zielbetrag: '', aktuell: '', zieldatum: '' }

export function SparzieleSection() {
  const [schemaOk, setSchemaOk] = useState<boolean | null>(null)
  const [ziele, setZiele] = useState<SparzielRow[]>([])
  const [form, setForm] = useState<FormState>(LEER)
  const [formOffen, setFormOffen] = useState(false)
  const [speichert, setSpeichert] = useState(false)

  async function laden() {
    const res = await ladeSparziele()
    setSchemaOk(res.schemaOk)
    setZiele(res.rows)
  }

  useEffect(() => {
    void laden()
  }, [])

  function startNeu() {
    setForm(LEER)
    setFormOffen(true)
  }

  function startBearbeiten(z: SparzielRow) {
    setForm({
      id: z.id,
      titel: z.titel,
      zielbetrag: String(z.zielbetrag).replace('.', ','),
      aktuell: String(z.aktuell).replace('.', ','),
      zieldatum: z.zieldatum ? String(z.zieldatum).slice(0, 10) : '',
    })
    setFormOffen(true)
  }

  async function speichern() {
    const titel = form.titel.trim()
    if (!titel) return toast.error('Bitte einen Titel eingeben.')
    const zielbetrag = Number.parseFloat(form.zielbetrag.replace(',', '.'))
    if (!Number.isFinite(zielbetrag) || zielbetrag <= 0) return toast.error('Bitte einen gültigen Zielbetrag eingeben.')
    const aktuell = Number.parseFloat((form.aktuell || '0').replace(',', '.'))
    if (!Number.isFinite(aktuell) || aktuell < 0) return toast.error('Aktueller Stand ungültig.')

    setSpeichert(true)
    try {
      const { error } = await speichereSparziel({
        id: form.id,
        titel,
        zielbetrag: Math.round(zielbetrag * 100) / 100,
        aktuell: Math.round(aktuell * 100) / 100,
        zieldatum: form.zieldatum ? form.zieldatum : null,
      })
      if (error) {
        toast.error(error.message || 'Sparziel konnte nicht gespeichert werden.')
        return
      }
      toast.success(form.id ? 'Sparziel aktualisiert.' : 'Sparziel angelegt.')
      setForm(LEER)
      setFormOffen(false)
      await laden()
    } finally {
      setSpeichert(false)
    }
  }

  async function entfernen(z: SparzielRow) {
    if (!window.confirm(`Sparziel wirklich löschen?\n\n${z.titel}`)) return
    const { error } = await loescheSparziel(z.id)
    if (error) {
      toast.error('Löschen fehlgeschlagen.')
      return
    }
    toast.success('Sparziel gelöscht.')
    await laden()
  }

  return (
    <PageSection titleId="finanzen-sparziele-heading" title="Sparziele" density="compact">
      <PageSectionPanel density="compact">
        {schemaOk === null ? (
          <p className="text-sm text-slate-500">Wird geladen …</p>
        ) : schemaOk === false ? (
          <div className="rounded-xl border border-amber-700/50 bg-amber-950/25 p-4 text-[13px] leading-relaxed text-amber-200/90">
            Sparziel-Tabelle fehlt. In Supabase einmal die Migration ausführen:
            <code className="mt-1.5 block rounded bg-slate-950/80 px-1.5 py-1 text-[11px] text-slate-300">
              supabase/migrations/20260531120100_finanz_sparziel.sql
            </code>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-end">
              {!formOffen && (
                <button
                  type="button"
                  onClick={startNeu}
                  className="rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-teal-950/30 transition hover:bg-teal-500"
                >
                  Neues Sparziel
                </button>
              )}
            </div>

            {formOffen && (
              <div className="space-y-3 rounded-xl border border-slate-800/90 bg-slate-950/45 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {form.id ? 'Sparziel bearbeiten' : 'Neues Sparziel'}
                </p>
                <input
                  type="text"
                  value={form.titel}
                  onChange={(e) => setForm((p) => ({ ...p, titel: e.target.value }))}
                  placeholder="Titel (z. B. Urlaub, Notgroschen, neues Rad)"
                  className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-teal-500/30"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Zielbetrag €</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.zielbetrag}
                      onChange={(e) => setForm((p) => ({ ...p, zielbetrag: e.target.value }))}
                      placeholder="z. B. 2000"
                      className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-3 py-2.5 text-sm tabular-nums text-slate-100 outline-none focus:ring-2 focus:ring-teal-500/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Schon gespart €</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.aktuell}
                      onChange={(e) => setForm((p) => ({ ...p, aktuell: e.target.value }))}
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-3 py-2.5 text-sm tabular-nums text-slate-100 outline-none focus:ring-2 focus:ring-teal-500/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Zieldatum (optional)</label>
                  <input
                    type="date"
                    value={form.zieldatum}
                    onChange={(e) => setForm((p) => ({ ...p, zieldatum: e.target.value }))}
                    className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-teal-500/30"
                  />
                </div>
                <div className="flex gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setForm(LEER)
                      setFormOffen(false)
                    }}
                    className="flex-1 rounded-xl border border-slate-600/90 bg-slate-900 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    disabled={speichert}
                    onClick={() => void speichern()}
                    className="flex-[2] rounded-xl bg-teal-600 py-2.5 text-sm font-bold text-white shadow-md shadow-teal-950/25 transition hover:bg-teal-500 disabled:opacity-40"
                  >
                    {speichert ? '…' : form.id ? 'Änderungen speichern' : 'Sparziel speichern'}
                  </button>
                </div>
              </div>
            )}

            {ziele.length === 0 && !formOffen ? (
              <p className="rounded-xl border border-slate-800/90 bg-slate-950/35 p-8 text-center text-sm italic text-slate-600">
                Noch keine Sparziele — z. B. Notgroschen oder Urlaub anlegen.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {ziele.map((z) => {
                  const anteil = z.zielbetrag > 0 ? Math.min(1, z.aktuell / z.zielbetrag) : 0
                  const fertig = z.aktuell >= z.zielbetrag
                  const rest = Math.max(0, z.zielbetrag - z.aktuell)
                  const monate = monateBisDatum(z.zieldatum)
                  const proMonat = monate && monate > 0 && rest > 0 ? rest / monate : null
                  return (
                    <li key={z.id} className="rounded-xl border border-slate-800/90 bg-slate-950/45 p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="truncate text-[15px] font-semibold text-slate-100">{z.titel}</p>
                        <p className="text-[12px] tabular-nums text-slate-300">
                          <span className={fertig ? 'font-semibold text-emerald-400' : 'font-semibold text-teal-300'}>
                            {eur(z.aktuell)}
                          </span>
                          <span className="text-slate-600"> / </span>
                          <span className="text-slate-400">{eur(z.zielbetrag)}</span>
                        </p>
                      </div>
                      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full rounded-full ${fertig ? 'bg-emerald-500' : 'bg-teal-500'}`}
                          style={{ width: `${anteil * 100}%` }}
                        />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        <span>
                          {fertig ? (
                            <span className="font-semibold text-emerald-400">Ziel erreicht 🎉</span>
                          ) : (
                            <>noch {eur(rest)}{' '}
                              {proMonat ? `· ${eur(proMonat)}/Monat bis Ziel` : ''}
                            </>
                          )}
                        </span>
                        <span className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startBearbeiten(z)}
                            className="font-semibold text-sky-300 hover:text-sky-200"
                          >
                            Bearbeiten
                          </button>
                          <button
                            type="button"
                            onClick={() => void entfernen(z)}
                            className="font-semibold text-rose-300/90 hover:text-rose-200"
                          >
                            Löschen
                          </button>
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </PageSectionPanel>
    </PageSection>
  )
}
