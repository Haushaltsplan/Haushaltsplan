'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { CollapsibleRowHeaderEnd, LABEL_EINKLAPPEN } from '@/components/collapsible-ui'
import {
  verbrauchKennzahlenFuerProdukt,
  type LagerVerbrauchHistorieZeile,
} from '@/lib/lager-einkaufsliste-verbrauch'
import { basisEinheitFuerPreisanzeige, istLagerBasisEinheit, produktEinheitZuBasis } from '@/lib/lager-einheiten'
import { vorschlagMindestbestand } from '@/lib/lager-verbrauch-vorschlaege'

type ProduktKurz = {
  id: string
  name: string
  einheit: string
  basis_einheit?: string | null
  mindestbestand?: number | null
  lagerbestand?: { aktuelle_menge?: number } | { aktuelle_menge?: number }[] | null
}

type Props = {
  produkte: ProduktKurz[]
  verbrauchHistorie: LagerVerbrauchHistorieZeile[]
  letzterEinkaufAm: Map<string, string>
  onMindestbestandSetzen: (id: string, wert: number) => Promise<void>
}

function lagerMenge(p: ProduktKurz): number {
  const lb = p.lagerbestand
  if (Array.isArray(lb)) return Number(lb[0]?.aktuelle_menge) || 0
  if (lb && typeof lb === 'object' && 'aktuelle_menge' in lb) return Number(lb.aktuelle_menge) || 0
  return 0
}

export function LagerVerbrauchHinweise({ produkte, verbrauchHistorie, letzterEinkaufAm, onMindestbestandSetzen }: Props) {
  const [offen, setOffen] = useState(false)
  const [ladenId, setLadenId] = useState<string | null>(null)

  const { minVorschlaege, toteArtikel } = useMemo(() => {
    const minVorschlaege: {
      id: string
      name: string
      vorschlag: number
      aktuell: number | null
      einheit: string
    }[] = []
    const toteArtikel: { id: string; name: string; menge: number; einheit: string; tage: number }[] = []
    const jetzt = Date.now()

    for (const p of produkte) {
      const basis = p.basis_einheit && istLagerBasisEinheit(p.basis_einheit) ? p.basis_einheit : produktEinheitZuBasis(p.einheit)
      const einheit = basisEinheitFuerPreisanzeige(basis)
      const k = verbrauchKennzahlenFuerProdukt(verbrauchHistorie, p.id)
      const v = vorschlagMindestbestand(k)
      const min = p.mindestbestand
      if (v != null && (min == null || min <= 0 || min < v * 0.8)) {
        minVorschlaege.push({ id: p.id, name: p.name, vorschlag: v, aktuell: min ?? null, einheit })
      }
      const m = lagerMenge(p)
      if (m > 0) {
        const iso = letzterEinkaufAm.get(p.id)
        if (iso) {
          const tage = Math.floor((jetzt - new Date(iso).getTime()) / 86_400_000)
          if (tage >= 120) {
            toteArtikel.push({ id: p.id, name: p.name, menge: m, einheit, tage })
          }
        }
      }
    }
    minVorschlaege.sort((a, b) => a.name.localeCompare(b.name, 'de'))
    toteArtikel.sort((a, b) => b.tage - a.tage)
    return { minVorschlaege: minVorschlaege.slice(0, 6), toteArtikel: toteArtikel.slice(0, 5) }
  }, [produkte, verbrauchHistorie, letzterEinkaufAm])

  if (minVorschlaege.length === 0 && toteArtikel.length === 0) return null

  async function uebernehmen(id: string, wert: number) {
    setLadenId(id)
    try {
      await onMindestbestandSetzen(id, wert)
      toast.success('Mindestbestand übernommen.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    } finally {
      setLadenId(null)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-teal-800/40 bg-[var(--app-surface-muted)] shadow-md shadow-black/20">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-[var(--app-surface-hover)] sm:px-4"
        aria-expanded={offen}
      >
        <div>
          <h2 className="text-sm font-bold text-teal-100 sm:text-base">Lager-Tipps</h2>
          <p className="text-[10px] text-[var(--app-text-muted)] sm:text-[11px]">Mindestbestand & ungenutzter Vorrat</p>
        </div>
        <CollapsibleRowHeaderEnd open={offen} labels={LABEL_EINKLAPPEN} tone="neutral" size="sm" />
      </button>
      {offen && (
        <div className="space-y-3 border-t border-[var(--app-border)] px-3 pb-3 pt-2 sm:px-4">
          {minVorschlaege.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">Mindestbestand (≈ 2 Wochen Verbrauch)</p>
              <div className="space-y-1.5">
                {minVorschlaege.map((v) => (
                  <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-2.5 py-2">
                    <span className="min-w-0 truncate text-[13px] font-semibold text-[var(--app-text)]">{v.name}</span>
                    <button
                      type="button"
                      disabled={ladenId === v.id}
                      onClick={() => void uebernehmen(v.id, v.vorschlag)}
                      className="shrink-0 rounded border border-teal-700/50 bg-teal-900/30 px-2 py-1 text-[11px] font-bold text-teal-100 hover:bg-teal-800/40 disabled:opacity-40"
                    >
                      {v.aktuell != null && v.aktuell > 0 ? `${v.aktuell} → ` : ''}
                      {v.vorschlag} {v.einheit}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {toteArtikel.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">Lange nicht nachgekauft</p>
              <div className="space-y-1">
                {toteArtikel.map((t) => (
                  <p key={t.id} className="text-[12px] text-[var(--app-text-muted)]">
                    <span className="font-semibold text-[var(--app-text)]">{t.name}</span> — {t.menge} {t.einheit} im Lager, seit {t.tage} Tagen kein Einkauf
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
