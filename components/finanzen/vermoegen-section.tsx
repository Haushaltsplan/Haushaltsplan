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
import { DonutChart } from '@/components/finanzen/donut-chart'
import { PageSection, PageSectionPanel } from '@/components/page-shell'
import { KategorieMark } from '@/lib/kategorie-icon'
import {
  ladeVermoegen,
  speichereVermoegenPosten,
  loescheVermoegenPosten,
  ladeLetztesDepotSnapshot,
  type VermoegenRow,
} from '@/lib/finanz-extra-db'
import {
  VERMOEGEN_KLASSEN,
  FINANZEN_DEPOT_EINBEZIEHEN_LS,
  effektiveVermoegenKlasse,
  gruppiereVermoegen,
  inferiereVermoegenKlasse,
  type VermoegenAnzeigePosten,
  type VermoegenKlasse,
} from '@/lib/finanz-vermoegen'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

function eur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatSnapshotDatum(iso?: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}

type FormState = { id?: string; titel: string; betrag: string; klasse: VermoegenKlasse }
const LEER: FormState = { titel: '', betrag: '', klasse: 'bank' }

const SCHNELL: Array<{ titel: string; klasse: VermoegenKlasse }> = [
  { titel: 'Girokonto', klasse: 'bank' },
  { titel: 'Tagesgeld', klasse: 'bank' },
  { titel: 'Mintos', klasse: 'p2p' },
  { titel: 'Schwäbisch Hall Bausparer', klasse: 'bausparer' },
  { titel: 'UniGlobal Fond', klasse: 'fonds' },
  { titel: 'Allianz Lebensversicherung', klasse: 'rente' },
]

function leseDepotEinbeziehen(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const v = window.localStorage.getItem(FINANZEN_DEPOT_EINBEZIEHEN_LS)
    if (v === '0' || v === 'false') return false
    return true
  } catch {
    return true
  }
}

/**
 * Gesamtvermögen nach Anlageklasse: manuelle Posten plus optional Depot aus der Portfolio-Analyse.
 * Der erarbeitete Puffer wird nur zum Abgleich gezeigt — er steckt typischerweise schon im Bankguthaben.
 */
export function VermoegenSection({ puffer }: { puffer: number }) {
  const [schemaOk, setSchemaOk] = useState<boolean | null>(null)
  const [posten, setPosten] = useState<VermoegenRow[]>([])
  const [form, setForm] = useState<FormState>(LEER)
  const [formOffen, setFormOffen] = useState(false)
  const [speichert, setSpeichert] = useState(false)
  const [depot, setDepot] = useState<{ wert: number | null; erfasstAm: string | null }>({
    wert: null,
    erfasstAm: null,
  })
  const [depotEinbeziehen, setDepotEinbeziehen] = useState(leseDepotEinbeziehen)

  async function laden() {
    const [v, snap] = await Promise.all([ladeVermoegen(), ladeLetztesDepotSnapshot()])
    setSchemaOk(v.schemaOk)
    setPosten(v.rows)
    setDepot({ wert: snap.depotwertEur, erfasstAm: snap.erfasstAm })
  }

  useEffect(() => {
    void laden()
  }, [])

  function setzeDepotEinbeziehen(an: boolean) {
    setDepotEinbeziehen(an)
    try {
      window.localStorage.setItem(FINANZEN_DEPOT_EINBEZIEHEN_LS, an ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  const anzeigePosten = useMemo<VermoegenAnzeigePosten[]>(() => {
    const rows: VermoegenAnzeigePosten[] = posten.map((p) => ({
      id: p.id,
      titel: p.titel,
      betrag: Number(p.betrag) || 0,
      klasse: effektiveVermoegenKlasse(p.titel, p.klasse),
      quelle: 'manuell',
    }))
    if (depotEinbeziehen && depot.wert != null && depot.wert !== 0) {
      rows.push({
        id: '__depot',
        titel: 'Depot (Portfolio-Analyse)',
        betrag: depot.wert,
        klasse: 'aktien',
        quelle: 'depot',
      })
    }
    return rows
  }, [posten, depot, depotEinbeziehen])

  const { gesamt, klassenMitWert } = useMemo(() => gruppiereVermoegen(anzeigePosten), [anzeigePosten])

  const hatManuelleAktien = useMemo(
    () => anzeigePosten.some((p) => p.quelle === 'manuell' && p.klasse === 'aktien'),
    [anzeigePosten],
  )
  const depotDoppeltHinweis =
    depotEinbeziehen && depot.wert != null && depot.wert !== 0 && hatManuelleAktien

  const donutSegmente = useMemo(
    () =>
      klassenMitWert
        .filter((k) => k.betrag > 0)
        .map((k) => ({ key: k.key, label: k.kurz, farbe: k.farbe, betrag: k.betrag })),
    [klassenMitWert],
  )

  function startNeu(vorgabe?: { titel: string; klasse: VermoegenKlasse }) {
    setForm({
      titel: vorgabe?.titel ?? '',
      betrag: '',
      klasse: vorgabe?.klasse ?? 'bank',
    })
    setFormOffen(true)
  }

  function startBearbeiten(p: VermoegenAnzeigePosten) {
    if (p.quelle !== 'manuell') return
    setForm({
      id: p.id,
      titel: p.titel,
      betrag: String(p.betrag).replace('.', ','),
      klasse: p.klasse,
    })
    setFormOffen(true)
  }

  async function speichern() {
    const titel = form.titel.trim()
    if (!titel) return toast.error('Bitte eine Bezeichnung eingeben.')
    const betrag = Number.parseFloat(form.betrag.replace(',', '.'))
    if (!Number.isFinite(betrag)) return toast.error('Bitte einen gültigen Betrag eingeben.')
    setSpeichert(true)
    try {
      const { error } = await speichereVermoegenPosten({
        id: form.id,
        titel,
        betrag: Math.round(betrag * 100) / 100,
        klasse: form.klasse,
      })
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

  async function entfernen(p: VermoegenAnzeigePosten) {
    if (p.quelle !== 'manuell') return
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
    <PageSection titleId="finanzen-vermoegen-heading" title="Vermögen" density="compact">
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
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                Bank, Aktien, P2P, Bausparer, Fonds und weitere Posten — Stand, den du pflegst
                {depotEinbeziehen && depot.wert != null ? ', plus Depot aus der Portfolio-Analyse' : ''}.
              </p>

              {donutSegmente.length > 0 && (
                <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                  <DonutChart
                    segmente={donutSegmente}
                    groesse={152}
                    dicke={20}
                    mitte={{ wert: eur(gesamt), label: 'GESAMT' }}
                  />
                  <ul className="w-full min-w-0 flex-1 space-y-1.5">
                    {klassenMitWert.map((k) => (
                      <li key={k.key} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: k.farbe }} />
                        <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--app-text)]">{k.label}</span>
                        <span className="shrink-0 text-[11px] tabular-nums text-[var(--app-text-muted)]">
                          {Math.round(k.anteil * 100)} %
                        </span>
                        <span className={`shrink-0 text-[13px] font-semibold tabular-nums ${k.textClass}`}>
                          {eur(k.betrag)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {klassenMitWert.length > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {klassenMitWert.map((k) => (
                    <div key={`kpi-${k.key}`} className={finanzKpiCardCompactClass}>
                      <p className={finanzLabelMutedClass}>{k.label}</p>
                      <p className={`mt-0.5 text-base font-semibold tabular-nums ${k.textClass}`}>{eur(k.betrag)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {depot.wert != null && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2.5 text-[12px] leading-snug text-[var(--app-text)]">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={depotEinbeziehen}
                  onChange={(e) => setzeDepotEinbeziehen(e.target.checked)}
                />
                <span>
                  Depot aus der Portfolio-Analyse einbeziehen ({eur(depot.wert)}
                  {formatSnapshotDatum(depot.erfasstAm) ? ` · Stand ${formatSnapshotDatum(depot.erfasstAm)}` : ''}).
                  {depotDoppeltHinweis ? (
                    <span className="mt-1 block text-amber-200/90">
                      Du hast zusätzlich manuelle Aktien-Posten — prüfe, ob das Depot sonst doppelt zählt.
                    </span>
                  ) : null}
                </span>
              </label>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-[var(--app-text-muted)]">
                Werte von Giro, P2P, Bausparer &amp; Fonds hier aktuell halten.
              </p>
              {!formOffen && (
                <button
                  type="button"
                  onClick={() => startNeu()}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-950/30 transition hover:bg-indigo-500"
                >
                  Posten hinzufügen
                </button>
              )}
            </div>

            {!formOffen && (
              <div className="flex flex-wrap gap-1.5">
                {SCHNELL.map((s) => (
                  <button
                    key={s.titel}
                    type="button"
                    onClick={() => startNeu(s)}
                    className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--app-text-muted)] transition hover:border-[var(--app-border-strong)] hover:text-[var(--app-text)]"
                  >
                    {s.titel}
                  </button>
                ))}
              </div>
            )}

            {!formOffen && anzeigePosten.length === 0 && (
              <p className={finanzEmptyClass}>
                Noch keine Posten. Lege Bankguthaben, P2P, Bausparer oder Fonds an — das Aktien-Depot kommt
                automatisch aus der Portfolio-Analyse, sobald ein Snapshot da ist.
              </p>
            )}

            {formOffen && (
              <div className={`space-y-3 ${finanzListItemClass} flex-col items-stretch`}>
                <p className={finanzLabelMutedClass}>{form.id ? 'Posten bearbeiten' : 'Neuer Posten'}</p>
                <input
                  type="text"
                  value={form.titel}
                  onChange={(e) => {
                    const titel = e.target.value
                    const inferiert = inferiereVermoegenKlasse(titel)
                    setForm((p) => ({
                      ...p,
                      titel,
                      klasse: Boolean(p.id) || inferiert === 'sonstiges' ? p.klasse : inferiert,
                    }))
                  }}
                  placeholder="Bezeichnung (z. B. Giro Sparkasse, Mintos, Schwäbisch Hall)"
                  className={finanzInputClass}
                />
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
                    Anlageklasse
                  </label>
                  <select
                    value={form.klasse}
                    onChange={(e) => setForm((p) => ({ ...p, klasse: e.target.value as VermoegenKlasse }))}
                    className={finanzInputClass}
                  >
                    {VERMOEGEN_KLASSEN.map((k) => (
                      <option key={k.key} value={k.key}>
                        {k.label} — {k.beispiele}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
                    Aktueller Wert €
                  </label>
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

            {klassenMitWert.map((k) => (
              <div key={`grp-${k.key}`} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2 px-0.5">
                  <p className={`text-[11px] font-bold uppercase tracking-[0.16em] ${k.textClass}`}>{k.label}</p>
                  <p className="text-[12px] font-semibold tabular-nums text-[var(--app-text-muted)]">{eur(k.betrag)}</p>
                </div>
                <ul className="space-y-2">
                  {k.posten.map((p) => (
                    <li key={p.id} className={finanzListItemClass}>
                      <KategorieMark kategorie={p.titel} groesse="sm" className="shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate ${finanzTitleClass}`}>{p.titel}</p>
                        {p.quelle === 'depot' ? (
                          <p className="text-[11px] text-[var(--app-text-muted)]">
                            {formatSnapshotDatum(depot.erfasstAm) ? `Stand ${formatSnapshotDatum(depot.erfasstAm)} · ` : ''}
                            <Link href="/portfolioanalyse" className="font-semibold text-indigo-300 hover:text-indigo-200">
                              Portfolio-Analyse
                            </Link>
                          </p>
                        ) : null}
                      </div>
                      <p className="shrink-0 text-[14px] font-bold tabular-nums text-sky-200">{eur(p.betrag)}</p>
                      {p.quelle === 'manuell' ? (
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
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {Number.isFinite(puffer) && (
              <p className="text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                Erarbeiteter Puffer zum Abgleich: {eur(puffer)} — nicht extra addiert, weil er in der Regel schon im
                Bankguthaben steckt.
              </p>
            )}
          </div>
        )}
      </PageSectionPanel>
    </PageSection>
  )
}
