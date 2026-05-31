'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { PageSection, PageSectionPanel } from '@/components/page-shell'
import {
  FINANZ_KATEGORIEN,
  summiereNachKategorie,
  type FinanzKategorieKey,
} from '@/lib/finanz-kategorisierung'
import {
  ladeBudgets,
  setzeBudget,
  loescheBudget,
  type BudgetRow,
} from '@/lib/finanz-extra-db'

type Buchung = { kategorie?: string | null; beschreibung?: string | null; betrag?: number | string | null }

function eur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

/** Ausgaben-Kategorien (ohne „Einkommen“). */
const BUDGET_KATEGORIEN = FINANZ_KATEGORIEN.filter((k) => k.key !== 'einkommen')

export function BudgetSection({
  ausgabenAnsicht,
  monatLabel,
}: {
  ausgabenAnsicht: Buchung[]
  monatLabel: string
}) {
  const [schemaOk, setSchemaOk] = useState<boolean | null>(null)
  const [budgets, setBudgets] = useState<BudgetRow[]>([])
  const [editKey, setEditKey] = useState<FinanzKategorieKey | null>(null)
  const [editWert, setEditWert] = useState('')
  const [speichert, setSpeichert] = useState(false)

  async function laden() {
    const res = await ladeBudgets()
    setSchemaOk(res.schemaOk)
    setBudgets(res.rows)
  }

  useEffect(() => {
    void laden()
  }, [])

  const ausgabenJeKategorie = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of summiereNachKategorie(ausgabenAnsicht, false)) m.set(s.key, s.betrag)
    return m
  }, [ausgabenAnsicht])

  const budgetByKey = useMemo(() => {
    const m = new Map<string, BudgetRow>()
    for (const b of budgets) m.set(b.kategorie_key, b)
    return m
  }, [budgets])

  async function speichereLimit(key: FinanzKategorieKey) {
    const wert = Number.parseFloat(editWert.replace(',', '.'))
    if (!Number.isFinite(wert) || wert < 0) {
      toast.error('Bitte ein gültiges Limit eingeben.')
      return
    }
    setSpeichert(true)
    try {
      const { error } = await setzeBudget(key, Math.round(wert * 100) / 100)
      if (error) {
        toast.error(error.message || 'Budget konnte nicht gespeichert werden.')
        return
      }
      toast.success('Budget gespeichert.')
      setEditKey(null)
      setEditWert('')
      await laden()
    } finally {
      setSpeichert(false)
    }
  }

  async function entferneLimit(row: BudgetRow) {
    setSpeichert(true)
    try {
      const { error } = await loescheBudget(row.id)
      if (error) {
        toast.error('Budget konnte nicht entfernt werden.')
        return
      }
      toast.success('Budget entfernt.')
      await laden()
    } finally {
      setSpeichert(false)
    }
  }

  return (
    <PageSection titleId="finanzen-budget-heading" title="Budgets" density="compact">
      <PageSectionPanel density="compact">
        {schemaOk === null ? (
          <p className="text-sm text-slate-500">Wird geladen …</p>
        ) : schemaOk === false ? (
          <div className="rounded-xl border border-amber-700/50 bg-amber-950/25 p-4 text-[13px] leading-relaxed text-amber-200/90">
            Budget-Tabelle fehlt. In Supabase einmal die Migration ausführen:
            <code className="mt-1.5 block rounded bg-slate-950/80 px-1.5 py-1 text-[11px] text-slate-300">
              supabase/migrations/20260531120000_finanz_budget.sql
            </code>
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-[12px] text-slate-500">
              Monatslimits je Kategorie für <span className="font-semibold text-slate-300">{monatLabel}</span>. Verbrauch wird
              automatisch aus den Buchungen des Ansichtsmonats berechnet.
            </p>
            <ul className="space-y-2">
              {BUDGET_KATEGORIEN.map((def) => {
                const verbraucht = ausgabenJeKategorie.get(def.key) ?? 0
                const row = budgetByKey.get(def.key)
                const limit = row?.monatslimit ?? 0
                const hatLimit = Boolean(row) && limit > 0
                const anteil = hatLimit ? Math.min(1.5, verbraucht / limit) : 0
                const ueber = hatLimit && verbraucht > limit
                const istEdit = editKey === def.key
                return (
                  <li
                    key={def.key}
                    className="rounded-xl border border-slate-800/90 bg-slate-950/45 p-3 sm:p-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: def.farbe }} aria-hidden />
                        <span className="truncate text-[14px] font-semibold text-slate-100">{def.label}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[12px] tabular-nums">
                        <span className={ueber ? 'font-semibold text-rose-400' : 'text-slate-300'}>{eur(verbraucht)}</span>
                        <span className="text-slate-600">/</span>
                        <span className="text-slate-400">{hatLimit ? eur(limit) : '—'}</span>
                      </div>
                    </div>

                    {hatLimit && (
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full rounded-full ${ueber ? 'bg-rose-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(100, anteil * 100)}%` }}
                        />
                      </div>
                    )}
                    {ueber && (
                      <p className="mt-1.5 text-[11px] font-medium text-rose-300/90">
                        Limit um {eur(verbraucht - limit)} überschritten.
                      </p>
                    )}

                    {istEdit ? (
                      <div className="mt-2.5 flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          autoFocus
                          value={editWert}
                          onChange={(e) => setEditWert(e.target.value)}
                          placeholder="Monatslimit €"
                          className="w-32 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/30"
                        />
                        <button
                          type="button"
                          disabled={speichert}
                          onClick={() => void speichereLimit(def.key)}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
                        >
                          Speichern
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditKey(null)
                            setEditWert('')
                          }}
                          className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                        >
                          Abbrechen
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2.5 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditKey(def.key)
                            setEditWert(hatLimit ? String(limit).replace('.', ',') : '')
                          }}
                          className="rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/15"
                        >
                          {hatLimit ? 'Limit ändern' : 'Limit setzen'}
                        </button>
                        {hatLimit && row && (
                          <button
                            type="button"
                            disabled={speichert}
                            onClick={() => void entferneLimit(row)}
                            className="rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-1.5 text-xs font-semibold text-rose-300/95 transition hover:bg-rose-500/15 disabled:opacity-40"
                          >
                            Entfernen
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </PageSectionPanel>
    </PageSection>
  )
}
