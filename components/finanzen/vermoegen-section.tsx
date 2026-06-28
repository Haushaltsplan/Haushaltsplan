'use client'

import {
  finanzEmptyClass,
  finanzInputClass,
  finanzKpiCardCompactClass,
  finanzLabelMutedClass,
  finanzListItemClass,
  finanzSecondaryBtnClass,
  finanzTitleClass,
} from '@/components/finanzen/finanzen-ui'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { PageSection, PageSectionPanel } from '@/components/page-shell'
import {
  ladeVermoegen,
  speichereVermoegenPosten,
  loescheVermoegenPosten,
  ladeSparziele,
  type VermoegenRow,
} from '@/lib/finanz-extra-db'

function eur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

type FormState = { id?: string; titel: string; betrag: string }
const LEER: FormState = { titel: '', betrag: '' }

/**
 * Gesamtvermögen = erarbeiteter Puffer + Sparziele + manuelle Posten (Depot, Tagesgeld, Bargeld …).
 * Investments sind im App-Modul nur eine Watchlist ohne Geldbeträge — daher hier manuell pflegbar.
 */
export function VermoegenSection({ puffer }: { puffer: number }) {
  const [schemaOk, setSchemaOk] = useState<boolean | null>(null)
  const [posten, setPosten] = useState<VermoegenRow[]>([])
  const [sparzieleSumme, setSparzieleSumme] = useState(0)
  const [form, setForm] = useState<FormState>(LEER)
  const [formOffen, setFormOffen] = useState(false)
  const [speichert, setSpeichert] = useState(false)

  async function laden() {
    const [v, s] = await Promise.all([ladeVermoegen(), ladeSparziele()])
    setSchemaOk(v.schemaOk)
    setPosten(v.rows)
    setSparzieleSumme(s.rows.reduce((a, z) => a + (Number(z.aktuell) || 0), 0))
  }

  useEffect(() => {
    void laden()
  }, [])

  const postenSumme = useMemo(() => posten.reduce((a, p) => a + (Number(p.betrag) || 0), 0), [posten])
  const gesamt = Math.round((puffer + sparzieleSumme + postenSumme) * 100) / 100

  function startBearbeiten(p: VermoegenRow) {
    setForm({ id: p.id, titel: p.titel, betrag: String(p.betrag).replace('.', ',') })
    setFormOffen(true)
  }

  async function speichern() {
    const titel = form.titel.trim()
    if (!titel) return toast.error('Bitte eine Bezeichnung eingeben.')
    const betrag = Number.parseFloat(form.betrag.replace(',', '.'))
    if (!Number.isFinite(betrag)) return toast.error('Bitte einen gültigen Betrag eingeben.')
    setSpeichert(true)
    try {
      const { error } = await speichereVermoegenPosten({ id: form.id, titel, betrag: Math.round(betrag * 100) / 100 })
      if (error) {
        toast.error(error.message || 'Posten konnte nicht gespeichert werden.')
        return
      }
      toast.success(form.id ? 'Posten aktualisiert.' : 'Posten angelegt.')
      setForm(LEER)
      setFormOffen(false)
      await laden()
    } finally {
      setSpeichert(false)
    }
  }

  async function entfernen(p: VermoegenRow) {
    if (!window.confirm(`Posten wirklich löschen?\n\n${p.titel}`)) return
    const { error } = await loescheVermoegenPosten(p.id)
    if (error) {
      toast.error('Löschen fehlgeschlagen.')
      return
    }
    toast.success('Posten gelöscht.')
    await laden()
  }

  return (
    <PageSection titleId="finanzen-vermoegen-heading" title="Vermögensübersicht" density="compact">
      <PageSectionPanel density="compact">
        {schemaOk === null ? (
          <p className="text-sm text-[var(--app-text-muted)]">Wird geladen …</p>
        ) : schemaOk === false ? (
          <div className="rounded-xl border border-amber-700/50 bg-amber-950/25 p-4 text-[13px] leading-relaxed text-amber-200/90">
            Vermögens-Tabelle fehlt. In Supabase einmal die Migration ausführen:
            <code className="mt-1.5 block rounded bg-[var(--app-surface-muted)] px-1.5 py-1 text-[11px] text-[var(--app-text)]">
              supabase/migrations/20260531130100_finanz_vermoegen.sql
            </code>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl border border-indigo-800/50 bg-indigo-950/25 p-4 shadow-inner">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-300/90">Gesamtvermögen</p>
              <p className={`mt-1 text-3xl font-bold tabular-nums ${gesamt >= 0 ? 'text-indigo-100' : 'text-rose-300'}`}>
                {eur(gesamt)}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className={finanzKpiCardCompactClass}>
                  <p className={finanzLabelMutedClass}>Erarbeiteter Puffer</p>
                  <p className="mt-0.5 text-base font-semibold tabular-nums text-violet-200">{eur(puffer)}</p>
                </div>
                <div className={finanzKpiCardCompactClass}>
                  <p className={finanzLabelMutedClass}>Sparziele</p>
                  <p className="mt-0.5 text-base font-semibold tabular-nums text-teal-200">{eur(sparzieleSumme)}</p>
                </div>
                <div className={finanzKpiCardCompactClass}>
                  <p className={finanzLabelMutedClass}>Weitere Posten</p>
                  <p className="mt-0.5 text-base font-semibold tabular-nums text-sky-200">{eur(postenSumme)}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              {!formOffen && (
                <button
                  type="button"
                  onClick={() => {
                    setForm(LEER)
                    setFormOffen(true)
                  }}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-950/30 transition hover:bg-indigo-500"
                >
                  Posten hinzufügen
                </button>
              )}
            </div>

            {formOffen && (
              <div className={`space-y-3 ${finanzListItemClass} flex-col items-stretch`}>
                <p className={finanzLabelMutedClass}>
                  {form.id ? 'Posten bearbeiten' : 'Neuer Posten'}
                </p>
                <input
                  type="text"
                  value={form.titel}
                  onChange={(e) => setForm((p) => ({ ...p, titel: e.target.value }))}
                  placeholder="Bezeichnung (z. B. Depot Trade Republic, Tagesgeld, Bargeld)"
                  className={finanzInputClass}
                />
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">Aktueller Wert €</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.betrag}
                    onChange={(e) => setForm((p) => ({ ...p, betrag: e.target.value }))}
                    placeholder="z. B. 12500"
                    className={`${finanzInputClass} tabular-nums`}
                  />
                </div>
                <div className="flex gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setForm(LEER)
                      setFormOffen(false)
                    }}
                    className={`flex-1 ${finanzSecondaryBtnClass}`}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    disabled={speichert}
                    onClick={() => void speichern()}
                    className="flex-[2] rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-950/25 transition hover:bg-indigo-500 disabled:opacity-40"
                  >
                    {speichert ? '…' : form.id ? 'Änderungen speichern' : 'Posten speichern'}
                  </button>
                </div>
              </div>
            )}

            {posten.length === 0 && !formOffen ? (
              <p className={finanzEmptyClass}>
                Noch keine weiteren Posten. Trage z. B. deinen Depotwert oder dein Tagesgeld ein.
              </p>
            ) : (
              posten.length > 0 && (
                <ul className="space-y-2">
                  {posten.map((p) => (
                    <li
                      key={p.id}
                      className={finanzListItemClass}
                    >
                      <p className={`min-w-0 flex-1 truncate ${finanzTitleClass}`}>{p.titel}</p>
                      <p className="shrink-0 text-[14px] font-bold tabular-nums text-sky-200">{eur(Number(p.betrag) || 0)}</p>
                      <span className="flex shrink-0 gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => startBearbeiten(p)}
                          className="font-semibold text-sky-300 hover:text-sky-200"
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => void entfernen(p)}
                          className="font-semibold text-rose-300/90 hover:text-rose-200"
                        >
                          Löschen
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        )}
      </PageSectionPanel>
    </PageSection>
  )
}
