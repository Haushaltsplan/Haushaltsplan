'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  erstelleManuelleBuchung,
  manuellerImportErgebnis,
  parseManuelleZahl,
  validiereManuelleBuchungInput,
} from '@/lib/portfolio-analyse/manuelle-buchung'
import type { PortfolioImportErgebnis } from '@/lib/portfolio-analyse/types'
import {
  ASSET_KLASSE_LABEL,
  BUCHUNGS_TYP_LABEL,
  type AssetKlasse,
  type BuchungsTyp,
} from '@/lib/portfolio-analyse/types'

const BUCHUNGS_TYPEN = Object.keys(BUCHUNGS_TYP_LABEL) as BuchungsTyp[]
const ASSET_KLASSEN = Object.keys(ASSET_KLASSE_LABEL) as AssetKlasse[]

function heuteIso(): string {
  return new Date().toISOString().slice(0, 10)
}

type Props = {
  disabled?: boolean
  onErstellt: (ergebnis: PortfolioImportErgebnis, label: string) => void | Promise<void>
}

export function PortfolioImportManuell({ disabled, onErstellt }: Props) {
  const [offen, setOffen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [datum, setDatum] = useState(heuteIso)
  const [typ, setTyp] = useState<BuchungsTyp>('kauf')
  const [isin, setIsin] = useState('')
  const [wertpapierName, setWertpapierName] = useState('')
  const [stueckStr, setStueckStr] = useState('')
  const [betragStr, setBetragStr] = useState('')
  const [kursStr, setKursStr] = useState('')
  const [assetKlasse, setAssetKlasse] = useState<AssetKlasse>('aktie')

  const handelsTyp = typ === 'kauf' || typ === 'verkauf' || typ === 'dividende'
  const zeigtStueck = typ === 'kauf' || typ === 'verkauf'

  const vorschauBetrag = useMemo(() => parseManuelleZahl(betragStr), [betragStr])
  const vorschauStueck = useMemo(() => parseManuelleZahl(stueckStr), [stueckStr])
  const vorschauKurs = useMemo(() => {
    const k = parseManuelleZahl(kursStr)
    if (k != null && k > 0) return k
    if (vorschauBetrag != null && vorschauStueck != null && vorschauStueck > 0) {
      return Math.round((vorschauBetrag / vorschauStueck) * 10000) / 10000
    }
    return null
  }, [kursStr, vorschauBetrag, vorschauStueck])

  function formularZuruecksetzen() {
    setDatum(heuteIso())
    setTyp('kauf')
    setIsin('')
    setWertpapierName('')
    setStueckStr('')
    setBetragStr('')
    setKursStr('')
    setAssetKlasse('aktie')
  }

  async function absenden(e: React.FormEvent) {
    e.preventDefault()
    if (disabled || busy) return

    const betragEur = parseManuelleZahl(betragStr)
    if (betragEur == null) {
      toast.error('Gültigen Betrag eingeben.')
      return
    }

    const input = {
      datum,
      typ,
      isin: isin.trim() || null,
      wertpapierName: wertpapierName.trim() || null,
      stueck: zeigtStueck && stueckStr.trim() ? parseManuelleZahl(stueckStr) : null,
      betragEur,
      kursEur: kursStr.trim() ? parseManuelleZahl(kursStr) : null,
      assetKlasse,
    }

    const fehler = validiereManuelleBuchungInput(input)
    if (fehler) {
      toast.error(fehler)
      return
    }

    setBusy(true)
    try {
      const buchung = await erstelleManuelleBuchung(input)
      const ergebnis = manuellerImportErgebnis(buchung)
      const label = `Manuell: ${BUCHUNGS_TYP_LABEL[typ]} ${wertpapierName.trim() || isin.trim() || datum}`
      await onErstellt(ergebnis, label)
      formularZuruecksetzen()
      setOffen(false)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Buchung konnte nicht erstellt werden.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]/30">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left disabled:opacity-50"
      >
        <div>
          <p className="text-sm font-medium text-[var(--app-text)]">Manuell hinzufügen</p>
          <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
            Einzelne Buchung erfassen — z. B. fehlender Trade, Dividende oder Einzahlung.
          </p>
        </div>
        <span className="shrink-0 text-lg text-[var(--app-text-muted)]" aria-hidden>
          {offen ? '−' : '+'}
        </span>
      </button>

      {offen ? (
        <form onSubmit={(e) => void absenden(e)} className="space-y-4 border-t border-[var(--app-border)] px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[var(--app-text-muted)]">Datum</span>
              <input
                type="date"
                required
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[var(--app-text-muted)]">Typ</span>
              <select
                value={typ}
                onChange={(e) => setTyp(e.target.value as BuchungsTyp)}
                className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)]"
              >
                {BUCHUNGS_TYPEN.map((t) => (
                  <option key={t} value={t}>
                    {BUCHUNGS_TYP_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[var(--app-text-muted)]">ISIN</span>
              <input
                type="text"
                value={isin}
                onChange={(e) => setIsin(e.target.value.toUpperCase())}
                placeholder="z. B. US5949181045"
                className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 font-mono text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
                autoComplete="off"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[var(--app-text-muted)]">Bezeichnung</span>
              <input
                type="text"
                value={wertpapierName}
                onChange={(e) => setWertpapierName(e.target.value)}
                placeholder={handelsTyp ? 'z. B. Microsoft' : 'optional'}
                className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
                autoComplete="off"
              />
            </label>

            {zeigtStueck ? (
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--app-text-muted)]">Stück</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={stueckStr}
                  onChange={(e) => setStueckStr(e.target.value)}
                  placeholder="z. B. 2,5"
                  className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
                />
              </label>
            ) : null}

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[var(--app-text-muted)]">Betrag (EUR)</span>
              <input
                type="text"
                inputMode="decimal"
                required
                value={betragStr}
                onChange={(e) => setBetragStr(e.target.value)}
                placeholder="z. B. 500,00"
                className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
              />
            </label>

            {zeigtStueck ? (
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--app-text-muted)]">Kurs (EUR, optional)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={kursStr}
                  onChange={(e) => setKursStr(e.target.value)}
                  placeholder={vorschauKurs != null ? `auto: ${vorschauKurs}` : 'wird aus Betrag/Stück berechnet'}
                  className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
                />
              </label>
            ) : null}

            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-[var(--app-text-muted)]">Asset-Klasse</span>
              <select
                value={assetKlasse}
                onChange={(e) => setAssetKlasse(e.target.value as AssetKlasse)}
                className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)] sm:max-w-xs"
              >
                {ASSET_KLASSEN.map((k) => (
                  <option key={k} value={k}>
                    {ASSET_KLASSE_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                formularZuruecksetzen()
                setOffen(false)
              }}
              className="rounded-lg border border-[var(--app-border-strong)] px-4 py-2 text-xs text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={busy || disabled}
              className="rounded-lg border border-teal-600/50 bg-teal-950/40 px-4 py-2 text-xs font-medium text-teal-100 hover:bg-teal-950/60 disabled:opacity-50"
            >
              {busy ? 'Erstellt …' : 'Zur Vorschau'}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
