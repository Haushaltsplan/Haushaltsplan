'use client'

import { LagerEinkaufsliste } from '@/components/lager-einkaufsliste'
import { LagerKassenzettelPanel } from '@/components/lager-kassenzettel-panel'
import { LagerProduktModals } from '@/components/lager-produkt-modals'
import { LagerBestandVerlauf } from '@/components/lager-bestand-verlauf'
import { LagerGekochteMahlzeiten } from '@/components/lager-gekochte-mahlzeiten'
import { LagerRezeptCoach } from '@/components/lager-rezept-coach'
import { LagerRezeptKatalog } from '@/components/lager-rezept-katalog'
import { LagerUebersicht } from '@/components/lager-uebersicht'
import { LagerAuswertungen } from '@/components/lager-auswertungen'
import { LagerAblaufTimeline } from '@/components/lager-ablauf-timeline'
import { LagerBarcodeScanner } from '@/components/lager-barcode-scanner'
import { LagerWasKochen } from '@/components/lager-was-kochen'
import { LagerVerbrauchHinweise } from '@/components/lager-verbrauch-hinweise'
import { istUnterMindestbestand, mhdKurzLabel, mhdStatus } from '@/lib/lager-mhd'
import { preisAenderungLabel, preisAenderungProzent } from '@/lib/lager-preis-trend'
import { bucheSchnellMinus, bucheSchnellPlus } from '@/lib/lager-schnellbuchung'
import { abonniereMerker, istGemerkt, toggleMerker } from '@/lib/einkaufsliste-merker'
import {
  basisEinheitFuerPreisanzeige,
  defaultBasisEinheitAusKauf,
  istLagerBasisEinheit,
  kaufEinheitFuerDb,
  mengeInBasisEinheit,
  normalisiereKaufEinheit,
  produktEinheitZuBasis,
  type LagerBasisEinheit,
  type LagerKaufEinheit,
} from '@/lib/lager-einheiten'
import { einkaufsdatumLokalZuIsoMitMittag } from '@/lib/lager-einkaufsdatum'
import { findeProduktIdNachLagerZuordnung } from '@/lib/lager-artikel-kanonisch'
import {
  LAGER_PRODUKT_KATEGORIEN,
  lagerKategorieAusArtikel,
  lagerKategorieFuerErfassung,
  normalisiereLagerKategorie,
} from '@/lib/lager-produkt-kategorie'
import { gruppiereProduktIdsFuerLagerDuplikate, mergeProduktDuplikateFuerSchluessel } from '@/lib/merge-produkt-duplikate'
import {
  namenGleichFuerLager,
  produktAnzeigeNameAusBon,
  produktNameNormalisieren,
} from '@/lib/produkt-name-normalize'
import type { LagerVerbrauchHistorieZeile } from '@/lib/lager-einkaufsliste-verbrauch'
import { supabase } from '@/lib/supabase'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { CollapsibleRowHeaderEnd, LABEL_EINKLAPPEN } from '@/components/collapsible-ui'
import { PageChrome, PageHero, appTableScrollInlineClassName, pageCardClass, pageSectionPanelClass, pageSectionShellClass, PageSubTabs } from '@/components/page-shell'
import { lagerFilterChipInactiveClass, lagerInputClass, lagerKpiCardClass, lagerLabelClass, lagerLabelSmClass, lagerSecondaryBtnClass } from '@/components/lager/lager-ui'

type Lb = { aktuelle_menge?: number }
type ProduktRow = {
  id: string
  name: string
  einheit: string
  /** Nach Migration: Warengruppe (Gemüse, Getränke, …). */
  kategorie?: string | null
  /** Nach Migration: kg | Liter | Stück — Vergleichs- und Bestandseinheit. */
  basis_einheit?: string | null
  lagerbestand?: Lb | Lb[] | null
  durchschnittspreis?: number | null
  /** Einzelpreis der chronologisch letzten Einkaufszeile (gesamtpreis / Basis-Menge). */
  letzterEinkaufspreis?: number | null
  /** Nächstes Mindesthaltbarkeitsdatum 'YYYY-MM-DD' (Grocy-Ablaufampel). */
  mhd?: string | null
  /** Mindestvorrat in Basiseinheit (Nachkauf-Schwelle). */
  mindestbestand?: number | null
  /** Gebundener Barcode/EAN. */
  barcode?: string | null
  /** Immer auf Einkaufsliste wenn unter Mindestbestand. */
  immer_da?: boolean | null
  /** Preis je Basiseinheit vor letztem Einkauf (für Trend). */
  vorletzterEinkaufspreis?: number | null
}

function lagerMenge(p: Pick<ProduktRow, 'lagerbestand'>): number {
  const lb = p.lagerbestand
  if (Array.isArray(lb)) return Number(lb[0]?.aktuelle_menge) || 0
  if (lb && typeof lb === 'object' && 'aktuelle_menge' in lb) return Number((lb as Lb).aktuelle_menge) || 0
  return 0
}

function formatEur(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function basisEinheitAnzeige(p: ProduktRow): LagerBasisEinheit {
  const b = p.basis_einheit
  if (b && istLagerBasisEinheit(b)) return b
  return produktEinheitZuBasis(p.einheit)
}

function formatEurJeBasiseinheit(n: number | null | undefined, basis: LagerBasisEinheit) {
  if (n == null || !Number.isFinite(n)) return '—'
  const eur = formatEur(n)
  const u = basisEinheitFuerPreisanzeige(basis)
  return `${eur}/${u}`
}

/** Ø-Preis je Basiseinheit, sonst letzter Einkauf — für Bestandswert (Menge × Preis). */
function preisJeBasisFuerBestandswert(p: ProduktRow): number | null {
  const d = p.durchschnittspreis
  if (d != null && Number.isFinite(d) && d >= 0) return d
  const l = p.letzterEinkaufspreis
  if (l != null && Number.isFinite(l) && l >= 0) return l
  return null
}

function bestandswertEur(p: ProduktRow): number | null {
  const m = lagerMenge(p)
  if (m <= 0) return null
  const pr = preisJeBasisFuerBestandswert(p)
  if (pr == null) return null
  return Math.round(m * pr * 100) / 100
}

function summeBestandswert(list: ProduktRow[]): number {
  let s = 0
  for (const p of list) {
    const w = bestandswertEur(p)
    if (w != null && Number.isFinite(w)) s += w
  }
  return Math.round(s * 100) / 100
}

function heuteAlsYYYYMMD() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseDeZahl(s: string): number {
  return Number(String(s).trim().replace(',', '.'))
}

export default function LagerPage() {
  const [produkte, setProdukte] = useState<ProduktRow[]>([])
  const [name, setName] = useState('')
  const [neuBasisEinheit, setNeuBasisEinheit] = useState<LagerBasisEinheit>('Stück')
  const [neuKaufEinheit, setNeuKaufEinheit] = useState<LagerKaufEinheit | ''>('Stück')
  const [einkaufsdatum, setEinkaufsdatum] = useState(heuteAlsYYYYMMD)
  const [neuMenge, setNeuMenge] = useState('')
  const [neuGesamtpreis, setNeuGesamtpreis] = useState('')
  const [neuKategorie, setNeuKategorie] = useState<string>('Sonstiges')
  const [neuMhd, setNeuMhd] = useState('')
  const [neuMindestbestand, setNeuMindestbestand] = useState('')
  const [formularLaden, setFormularLaden] = useState(false)
  const [duplikatLaden, setDuplikatLaden] = useState(false)
  const [bestandLeerenLaden, setBestandLeerenLaden] = useState(false)
  const [alleArtikelLoeschenLaden, setAlleArtikelLoeschenLaden] = useState(false)
  const [modal, setModal] = useState<{ typ: 'bearbeiten' | 'verbrauch'; p: ProduktRow } | null>(null)
  const [artikelSuche, setArtikelSuche] = useState('')
  /** Leer = alle Warengruppen. */
  const [lagerKategorieFilter, setLagerKategorieFilter] = useState('')
  /** Schnellfilter Bestandsliste (Grocy-Stil). */
  const [bestandFilter, setBestandFilter] = useState<'ablauf' | 'nachkaufen' | 'leer' | 'ohne_mhd' | ''>('')
  const [letzterEinkaufAmMap, setLetzterEinkaufAmMap] = useState<Map<string, string>>(new Map())
  const [lagerSort, setLagerSort] = useState<{
    key: 'name' | 'durchschnitt' | 'letzter' | 'bestand' | 'wert'
    dir: 'asc' | 'desc'
  }>({ key: 'name', dir: 'asc' })
  const [lagerRefreshKey, setLagerRefreshKey] = useState(0)
  const [rezeptKatalogRefreshKey, setRezeptKatalogRefreshKey] = useState(0)
  const [verbrauchHistorie, setVerbrauchHistorie] = useState<LagerVerbrauchHistorieZeile[]>([])
  /** Reduziert vertikale Blähung: Bestand vs. Küche/Rezepte vs. Auswertungen. */
  const [lagerHauptTab, setLagerHauptTab] = useState<'bestand' | 'kueche' | 'auswertungen'>('bestand')
  const [lagerManuellOffen, setLagerManuellOffen] = useState(false)
  const [scannerOffen, setScannerOffen] = useState(false)
  /** Tick, damit „auf Liste gemerkt"-Markierungen in der Tabelle live aktualisieren. */
  const [, setMerkerTick] = useState(0)

  useEffect(() => abonniereMerker(() => setMerkerTick((t) => t + 1)), [])

  useEffect(() => {
    if (!neuKaufEinheit) return
    setNeuBasisEinheit(defaultBasisEinheitAusKauf(neuKaufEinheit))
  }, [neuKaufEinheit])

  const ladeDaten = useCallback(async () => {
    const verbrauchSeitIso = new Date(Date.now() - 400 * 86_400_000).toISOString()

    const { data: produkteRaw, error: pErr } = await supabase
      .from('produkte')
      .select('*, lagerbestand(aktuelle_menge)')
      .order('name', { ascending: true })
    if (pErr) {
      console.error(pErr)
      toast.error('Vorratsdaten konnten nicht geladen werden.')
      setProdukte([])
      setVerbrauchHistorie([])
      return
    }
    const base = (produkteRaw || []) as ProduktRow[]

    const [{ data: einRows, error: eErr }, { data: vRows, error: vErr }] = await Promise.all([
      supabase
        .from('lager_einkauf')
        .select('produkt_id, menge, basis_menge, gesamtpreis, erstellt_am')
        .order('erstellt_am', { ascending: false }),
      supabase.from('lager_verbrauch').select('produkt_id, menge, erstellt_am').gte('erstellt_am', verbrauchSeitIso),
    ])

    if (vErr) {
      console.error(vErr)
      setVerbrauchHistorie([])
    } else {
      const hist: LagerVerbrauchHistorieZeile[] = []
      for (const r of vRows || []) {
        const row = r as { produkt_id: string; menge: number; erstellt_am: string }
        const m = Number(row.menge)
        if (!Number.isFinite(m) || m <= 0) continue
        hist.push({
          produkt_id: String(row.produkt_id),
          menge: m,
          erstellt_am: String(row.erstellt_am),
        })
      }
      setVerbrauchHistorie(hist)
    }

    if (eErr) {
      setProdukte(base.map((p) => ({ ...p, durchschnittspreis: null, letzterEinkaufspreis: null, vorletzterEinkaufspreis: null })))
      setLetzterEinkaufAmMap(new Map())
      setLagerRefreshKey((k) => k + 1)
      return
    }

    const acc = new Map<string, { sumP: number; sumM: number }>()
    const preiseProPid = new Map<string, number[]>()
    const einkaufAm = new Map<string, string>()
    for (const r of einRows || []) {
      const row = r as {
        produkt_id: string
        menge: number
        basis_menge?: number | null
        gesamtpreis: number
        erstellt_am: string
      }
      const pid = String(row.produkt_id)
      const basisM = Number(row.basis_menge) > 0 ? Number(row.basis_menge) : Number(row.menge) || 0
      const nu = acc.get(pid) || { sumP: 0, sumM: 0 }
      nu.sumP += Number(row.gesamtpreis) || 0
      nu.sumM += basisM
      acc.set(pid, nu)

      if (!einkaufAm.has(pid) && row.erstellt_am) {
        einkaufAm.set(pid, String(row.erstellt_am))
      }
      const m = basisM
      const g = Number(row.gesamtpreis) || 0
      if (m > 0 && Number.isFinite(g)) {
        const einzel = Math.round((g / m) * 1000000) / 1000000
        const arr = preiseProPid.get(pid) || []
        if (arr.length < 2) arr.push(einzel)
        preiseProPid.set(pid, arr)
      }
    }

    setLetzterEinkaufAmMap(einkaufAm)
    setProdukte(
      base.map((p) => {
        const a = acc.get(p.id)
        const avg = a && a.sumM > 0 ? Math.round((a.sumP / a.sumM) * 1_000_000) / 1_000_000 : null
        const preise = preiseProPid.get(p.id) || []
        const zuletzt = preise[0] ?? null
        const vorher = preise[1] ?? null
        return { ...p, durchschnittspreis: avg, letzterEinkaufspreis: zuletzt, vorletzterEinkaufspreis: vorher }
      }),
    )
    setLagerRefreshKey((k) => k + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void ladeDaten()
    })
    return () => {
      cancelled = true
    }
  }, [ladeDaten])

  /** Ohne Service Role: gleiche Buchung mit Anon-Key (nach Migration INSERT auf lager_einkauf). */
  async function buchungNeuesProduktDirekt(
    bezeichnung: string,
    kaufMenge: number,
    kaufEinheit: LagerKaufEinheit,
    basisNeu: LagerBasisEinheit,
    gesamtpreis: number,
    datum: string,
    kategorieRo: string,
    mhdOptional?: string | null,
  ): Promise<{ neuerArtikel: boolean }> {
    const erstelltAm = einkaufsdatumLokalZuIsoMitMittag(datum)
    const kaufR = Math.round(kaufMenge * 1000) / 1000
    const gR = Math.round(gesamtpreis * 100) / 100

    const { data: alle, error: aErr } = await supabase.from('produkte').select('id, name')
    if (aErr) throw new Error(aErr.message)
    const vorhanden = findeProduktIdNachLagerZuordnung((alle || []) as { id: string; name: string }[], bezeichnung)
    const kategorie = lagerKategorieFuerErfassung(bezeichnung, kategorieRo)

    let neuAngelegt = false
    let basis: LagerBasisEinheit
    let pid = vorhanden || ''

    if (vorhanden) {
      const { data: pr, error: prErr } = await supabase
        .from('produkte')
        .select('basis_einheit, einheit')
        .eq('id', vorhanden)
        .single()
      if (prErr) throw new Error(prErr.message)
      const raw = pr?.basis_einheit ?? pr?.einheit
      basis = istLagerBasisEinheit(String(raw)) ? (String(raw) as LagerBasisEinheit) : produktEinheitZuBasis(String(pr?.einheit))
    } else {
      basis = basisNeu
    }

    let basisMenge: number
    try {
      basisMenge = mengeInBasisEinheit(kaufR, kaufEinheit, basis)
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Umrechnung Kauf → Basis fehlgeschlagen.')
    }
    const basisR = Math.round(basisMenge * 1_000_000) / 1_000_000

    if (vorhanden) {
      const { data: lb } = await supabase.from('lagerbestand').select('aktuelle_menge').eq('produkt_id', pid).maybeSingle()
      const neu = (Number(lb?.aktuelle_menge) || 0) + basisR
      const { error: lbErr } = await supabase.from('lagerbestand').upsert(
        { produkt_id: pid, aktuelle_menge: neu },
        { onConflict: 'produkt_id' },
      )
      if (lbErr) throw new Error(lbErr.message)
      if (kategorie !== 'Sonstiges') {
        const { data: pk } = await supabase.from('produkte').select('kategorie').eq('id', pid).maybeSingle()
        if (normalisiereLagerKategorie(pk?.kategorie ?? null) === 'Sonstiges') {
          await supabase.from('produkte').update({ kategorie }).eq('id', pid)
        }
      }
    } else {
      const einheitLabel = basis === 'Liter' ? 'Liter' : basis === 'kg' ? 'kg' : 'Stück'
      const { data: ins, error: iErr } = await supabase
        .from('produkte')
        .insert([
          {
            name: produktAnzeigeNameAusBon(bezeichnung.trim()),
            einheit: einheitLabel,
            basis_einheit: basis,
            kategorie,
          },
        ])
        .select('id')
        .single()
      if (iErr || !ins) throw new Error(iErr?.message || 'Produkt anlegen fehlgeschlagen.')
      pid = ins.id as string
      neuAngelegt = true
      const { error: lbErr } = await supabase.from('lagerbestand').upsert(
        { produkt_id: pid, aktuelle_menge: basisR },
        { onConflict: 'produkt_id' },
      )
      if (lbErr) {
        await supabase.from('produkte').delete().eq('id', pid)
        throw new Error(lbErr.message)
      }
    }

    const einkaufRow: Record<string, unknown> = {
      produkt_id: pid,
      menge: basisR,
      gesamtpreis: gR,
      erstellt_am: erstelltAm,
      quelle: 'manuell',
      kauf_menge: kaufR,
      kauf_einheit: kaufEinheitFuerDb(kaufEinheit),
      basis_menge: basisR,
      basis_einheit: basis,
    }

    const { error: eErr } = await supabase.from('lager_einkauf').insert(einkaufRow)
    if (eErr) {
      if (neuAngelegt) await supabase.from('produkte').delete().eq('id', pid)
      throw new Error(
        eErr.message.includes('policy') || eErr.message.includes('RLS')
          ? 'Einkaufszeile nicht erlaubt: Migration „lager_einkauf_anon_insert“ in Supabase ausführen, oder SUPABASE_SERVICE_ROLE_KEY setzen.'
          : eErr.message.includes('kauf_menge') || eErr.message.includes('basis_menge')
            ? 'Bitte Migration „lager_basis_einheiten“ in Supabase ausführen (neue Spalten).'
            : eErr.message,
      )
    }
    const mhdCharge = mhdOptional?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(mhdOptional.trim()) ? mhdOptional.trim() : null
    if (mhdCharge) {
      await supabase.from('produkte').update({ mhd: mhdCharge }).eq('id', pid)
    }
    await supabase.from('lager_charge').insert({
      produkt_id: pid,
      menge: basisR,
      ...(mhdCharge ? { mhd: mhdCharge } : {}),
    })
    return { neuerArtikel: !vorhanden }
  }

  async function duplikateZusammenfuehren() {
    setDuplikatLaden(true)
    try {
      const res = await fetch('/api/lager/produkt/merge-duplicates', { method: 'POST' })
      const data = (await res.json()) as { error?: string; entfernteDuplikate?: number }

      if (res.ok) {
        const n = data.entfernteDuplikate ?? 0
        toast.success(
          n > 0 ? `${n} doppelte(r) Artikel zusammengeführt.` : 'Keine zusammenführbaren Artikel (gleicher Name oder gleiche Sammelgruppe).',
        )
        await ladeDaten()
        return
      }
      if (res.status !== 501) {
        toast.error(data.error || 'Zusammenführen fehlgeschlagen.')
        return
      }

      const { data: rows, error } = await supabase.from('produkte').select('id, name')
      if (error) {
        toast.error(error.message)
        return
      }
      const gruppen = gruppiereProduktIdsFuerLagerDuplikate((rows || []) as { id: string; name: string }[])
      let entfernt = 0
      for (const [, ids] of gruppen) {
        if (ids.length < 2) continue
        const r = await mergeProduktDuplikateFuerSchluessel(supabase, ids)
        entfernt += r.entfernt
      }
      toast.success(
        entfernt > 0
          ? `${entfernt} doppelte(r) Artikel zusammengeführt.`
          : 'Keine zusammenführbaren Artikel (oder fehlende UPDATE-Rechte auf lager_einkauf — siehe Migration 20260418230000).',
      )
      await ladeDaten()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Zusammenführen fehlgeschlagen.')
    } finally {
      setDuplikatLaden(false)
    }
  }

  async function speichernNeuesProdukt() {
    const bezeichnung = name.trim()
    if (!bezeichnung) return toast.error('Bezeichnung fehlt.')
    const m = parseDeZahl(neuMenge)
    if (!Number.isFinite(m) || m <= 0) return toast.error('Menge muss eine positive Zahl sein.')
    const g = parseDeZahl(neuGesamtpreis)
    if (!Number.isFinite(g) || g < 0) return toast.error('Gesamtpreis muss eine Zahl ≥ 0 sein.')
    if (!einkaufsdatum) return toast.error('Einkaufsdatum fehlt.')
    if (!neuKaufEinheit) return toast.error('Bitte Kauf-Einheit wählen.')
    const kaufE = neuKaufEinheit
    const basisNeu = neuBasisEinheit

    setFormularLaden(true)
    try {
      const res = await fetch('/api/lager/produkt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bezeichnung,
          kauf_menge: m,
          kauf_einheit: kaufE,
          basis_einheit: basisNeu,
          gesamtpreis: g,
          einkaufsdatum,
          kategorie: neuKategorie,
          mhd: neuMhd.trim() || null,
          mindestbestand: neuMindestbestand.trim() ? parseDeZahl(neuMindestbestand) : null,
        }),
      })
      const data = (await res.json()) as { error?: string; neuerArtikel?: boolean }

      let neuerArtikel = true
      if (res.status === 501) {
        try {
          const r = await buchungNeuesProduktDirekt(bezeichnung, m, kaufE, basisNeu, g, einkaufsdatum, neuKategorie, neuMhd.trim() || null)
          neuerArtikel = r.neuerArtikel
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Anlegen fehlgeschlagen.')
          return
        }
      } else if (!res.ok) {
        toast.error(data.error || 'Anlegen fehlgeschlagen.')
        return
      } else {
        neuerArtikel = data.neuerArtikel !== false
      }

      const ohneSr = res.status === 501
      if (neuerArtikel) {
        toast.success(ohneSr ? 'Produkt mit Einkauf angelegt (ohne Service Role).' : 'Produkt mit Einkauf angelegt.')
      } else {
        toast.success(ohneSr ? 'Einkauf zum passenden Artikel gebucht (ohne Service Role).' : 'Einkauf zum passenden Artikel gebucht.')
      }
      setName('')
      setNeuMenge('')
      setNeuGesamtpreis('')
      setNeuKaufEinheit('Stück')
      setNeuBasisEinheit('Stück')
      setNeuKategorie('Sonstiges')
      setNeuMhd('')
      setNeuMindestbestand('')
      setEinkaufsdatum(heuteAlsYYYYMMD())
      await ladeDaten()
    } finally {
      setFormularLaden(false)
    }
  }

  async function produktLoeschen(p: ProduktRow) {
    const ok = window.confirm(
      `„${p.name}“ wirklich löschen? Alle Bestände, Einkäufe und Verbräuche zu diesem Artikel werden entfernt.`,
    )
    if (!ok) return
    const res = await fetch('/api/lager/produkt', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id }),
    })
    const data = (await res.json()) as { error?: string }
    if (!res.ok && res.status !== 501) {
      toast.error(data.error || 'Löschen fehlgeschlagen.')
      return
    }
    if (res.status === 501) {
      const { error } = await supabase.from('produkte').delete().eq('id', p.id)
      if (error) {
        toast.error(
          error.message.includes('policy') || error.message.includes('RLS')
            ? 'Löschen nicht erlaubt: in Supabase DELETE für „produkte“ mit dem Anon-Key erlauben, oder SUPABASE_SERVICE_ROLE_KEY setzen.'
            : error.message,
        )
        return
      }
    }
    if (modal?.p.id === p.id) setModal(null)
    toast.success(res.status === 501 ? 'Artikel gelöscht (ohne Service Role).' : 'Artikel gelöscht.')
    await ladeDaten()
  }

  const gesamtProdukte = produkte.length
  const mitBestand = produkte.filter((p) => lagerMenge(p) > 0).length
  const lagerwertGesamt = useMemo(() => summeBestandswert(produkte), [produkte])

  const uebersichtItems = useMemo(
    () =>
      produkte.map((p) => ({
        id: p.id,
        name: p.name,
        menge: lagerMenge(p),
        einheit: basisEinheitFuerPreisanzeige(basisEinheitAnzeige(p)),
        mhd: p.mhd ?? null,
        mindestbestand: p.mindestbestand ?? null,
      })),
    [produkte],
  )

  const oeffneArtikel = useCallback(
    (id: string) => {
      const p = produkte.find((x) => x.id === id)
      if (p) setModal({ typ: 'bearbeiten', p })
    },
    [produkte],
  )

  async function schnellBuchen(p: ProduktRow, richtung: 'plus' | 'minus') {
    const menge = lagerMenge(p)
    const r = richtung === 'plus' ? await bucheSchnellPlus(p.id, menge) : await bucheSchnellMinus(p.id, menge)
    if (!r.ok) {
      toast.error(r.fehler || 'Buchung fehlgeschlagen.')
      return
    }
    const u = basisEinheitFuerPreisanzeige(basisEinheitAnzeige(p))
    toast.success(`${richtung === 'plus' ? '+1' : '−1'} ${u} · ${p.name}`)
    await ladeDaten()
  }

  async function mindestbestandSetzen(id: string, wert: number) {
    const res = await fetch('/api/lager/produkt', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, mindestbestand: wert }),
    })
    const data = (await res.json()) as { error?: string }
    if (!res.ok && res.status !== 501) throw new Error(data.error || 'Speichern fehlgeschlagen.')
    if (res.status === 501) {
      const { error } = await supabase.from('produkte').update({ mindestbestand: wert }).eq('id', id)
      if (error) throw new Error(error.message)
    }
    await ladeDaten()
  }

  const scannerProdukte = useMemo(
    () =>
      produkte.map((p) => ({
        id: p.id,
        name: p.name,
        barcode: p.barcode ?? null,
        menge: lagerMenge(p),
        einheit: basisEinheitFuerPreisanzeige(basisEinheitAnzeige(p)),
      })),
    [produkte],
  )

  const produkteGefiltert = useMemo(() => {
    const q = artikelSuche.trim()
    let rows = produkte
    if (lagerKategorieFilter) {
      rows = rows.filter((p) => normalisiereLagerKategorie(p.kategorie ?? null) === lagerKategorieFilter)
    }
    if (bestandFilter === 'ablauf') {
      rows = rows.filter((p) => {
        const st = mhdStatus(p.mhd ?? null)
        return lagerMenge(p) > 0 && (st === 'bald' || st === 'abgelaufen')
      })
    } else if (bestandFilter === 'nachkaufen') {
      rows = rows.filter((p) => istUnterMindestbestand(lagerMenge(p), p.mindestbestand ?? null))
    } else if (bestandFilter === 'leer') {
      rows = rows.filter((p) => lagerMenge(p) <= 0)
    } else if (bestandFilter === 'ohne_mhd') {
      rows = rows.filter((p) => lagerMenge(p) > 0 && !p.mhd)
    }
    if (q) {
      const qLower = q.toLowerCase()
      const qNorm = produktNameNormalisieren(q)
      rows = rows.filter((p) => {
        const n = String(p.name).toLowerCase()
        const e = String(p.einheit).toLowerCase()
        const b = String(p.basis_einheit ?? '').toLowerCase()
        const k = String(p.kategorie ?? '').toLowerCase()
        if (n.includes(qLower) || e.includes(qLower) || b.includes(qLower) || k.includes(qLower)) return true
        if (qNorm && produktNameNormalisieren(p.name).includes(qNorm)) return true
        if (namenGleichFuerLager(q, p.name)) return true
        return false
      })
    }

    const mul = lagerSort.dir === 'asc' ? 1 : -1
    const sorted = [...rows]
    sorted.sort((a, b) => {
      let c = 0
      if (lagerSort.key === 'name') {
        c = String(a.name).localeCompare(String(b.name), 'de', { sensitivity: 'base' })
      } else if (lagerSort.key === 'bestand') {
        c = lagerMenge(a) - lagerMenge(b)
      } else if (lagerSort.key === 'durchschnitt') {
        const va = a.durchschnittspreis
        const vb = b.durchschnittspreis
        const na = va != null && Number.isFinite(va) ? Number(va) : null
        const nb = vb != null && Number.isFinite(vb) ? Number(vb) : null
        if (na == null && nb == null) c = 0
        else if (na == null) c = 1
        else if (nb == null) c = -1
        else c = na - nb
      } else if (lagerSort.key === 'wert') {
        const wa = bestandswertEur(a)
        const wb = bestandswertEur(b)
        if (wa == null && wb == null) c = 0
        else if (wa == null) c = 1
        else if (wb == null) c = -1
        else c = wa - wb
      } else {
        const va = a.letzterEinkaufspreis
        const vb = b.letzterEinkaufspreis
        const na = va != null && Number.isFinite(va) ? Number(va) : null
        const nb = vb != null && Number.isFinite(vb) ? Number(vb) : null
        if (na == null && nb == null) c = 0
        else if (na == null) c = 1
        else if (nb == null) c = -1
        else c = na - nb
      }
      if (c !== 0) return c * mul
      return String(a.name).localeCompare(String(b.name), 'de', { sensitivity: 'base' })
    })
    return sorted
  }, [produkte, artikelSuche, lagerKategorieFilter, bestandFilter, lagerSort])

  const lagerwertGefiltert = useMemo(() => summeBestandswert(produkteGefiltert), [produkteGefiltert])

  async function alleLagerbestaendeLeeren() {
    const ok = window.confirm(
      'Alle Bestände auf 0 setzen?\n\nArtikel, Einkäufe und Ø-Preise bleiben erhalten — nur die aktuelle Menge pro Artikel wird gelöscht (auf 0).',
    )
    if (!ok) return
    setBestandLeerenLaden(true)
    try {
      const res = await fetch('/api/lager/bestand/alle-nullen', { method: 'POST' })
      const data = (await res.json()) as { error?: string; aktualisiert?: number }
      if (res.ok) {
        toast.success(
          typeof data.aktualisiert === 'number'
            ? `Alle Bestände geleert (${data.aktualisiert} Zeilen).`
            : 'Alle Bestände geleert.',
        )
        await ladeDaten()
        return
      }
      if (res.status === 501) {
        const { data: lbRows, error: lbErr } = await supabase.from('lagerbestand').select('produkt_id')
        if (lbErr) {
          toast.error(
            lbErr.message.includes('policy') || lbErr.message.includes('RLS')
              ? 'Ohne Service Role: UPDATE auf „lagerbestand“ für den Anon-Key erlauben, oder SUPABASE_SERVICE_ROLE_KEY setzen.'
              : lbErr.message,
          )
          return
        }
        for (const r of lbRows || []) {
          const pid = (r as { produkt_id: string }).produkt_id
          const { error: uErr } = await supabase.from('lagerbestand').update({ aktuelle_menge: 0 }).eq('produkt_id', pid)
          if (uErr) {
            toast.error(uErr.message)
            return
          }
        }
        toast.success('Alle Bestände auf 0 gesetzt (ohne Service Role).')
        await ladeDaten()
        return
      }
      toast.error(data.error || 'Leeren fehlgeschlagen.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Leeren fehlgeschlagen.')
    } finally {
      setBestandLeerenLaden(false)
    }
  }

  async function alleLagerArtikelLoeschen() {
    const ok = window.confirm(
      'Wirklich ALLE erfassten Artikel unwiderruflich löschen?\n\n' +
        'Dabei werden alle Produkte inkl. Bestand, Einkaufs- und Verbrauchshistorie entfernt. Der Button „Alle Bestände leeren“ ist dafür nicht nötig — hier geht es um komplettes Löschen der Einträge.',
    )
    if (!ok) return
    setAlleArtikelLoeschenLaden(true)
    try {
      const res = await fetch('/api/lager/produkt/alle-loeschen', { method: 'POST' })
      const data = (await res.json()) as { error?: string; geloescht?: number }
      if (res.ok) {
        toast.success(
          typeof data.geloescht === 'number'
            ? data.geloescht === 0
              ? 'Es waren keine Artikel zum Löschen.'
              : `${data.geloescht} Artikel gelöscht.`
            : 'Alle Artikel gelöscht.',
        )
        setModal(null)
        await ladeDaten()
        return
      }
      if (res.status === 501) {
        const ids = produkte.map((p) => p.id)
        if (ids.length === 0) {
          toast.success('Keine Artikel vorhanden.')
          return
        }
        for (const id of ids) {
          const { error } = await supabase.from('produkte').delete().eq('id', id)
          if (error) {
            toast.error(
              error.message.includes('policy') || error.message.includes('RLS')
                ? 'Ohne Service Role: DELETE auf „produkte“ für den Anon-Key erlauben, oder SUPABASE_SERVICE_ROLE_KEY setzen.'
                : error.message,
            )
            return
          }
        }
        toast.success(`${ids.length} Artikel gelöscht (ohne Service Role).`)
        setModal(null)
        await ladeDaten()
        return
      }
      toast.error(data.error || 'Löschen fehlgeschlagen.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.')
    } finally {
      setAlleArtikelLoeschenLaden(false)
    }
  }

  function lagerSortKlick(key: 'name' | 'durchschnitt' | 'letzter' | 'bestand' | 'wert') {
    setLagerSort((s) => {
      if (s.key !== key) {
        const defaultDir: 'asc' | 'desc' =
          key === 'name' ? 'asc' : key === 'bestand' || key === 'wert' ? 'desc' : 'desc'
        return { key, dir: defaultDir }
      }
      return { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
    })
  }

  function lagerSortPfeil(key: 'name' | 'durchschnitt' | 'letzter' | 'bestand' | 'wert') {
    if (lagerSort.key !== key) return ''
    return lagerSort.dir === 'asc' ? '↑' : '↓'
  }

  const modalZeile = modal
    ? {
        id: modal.p.id,
        name: modal.p.name,
        einheit: modal.p.einheit,
        basis_einheit: basisEinheitAnzeige(modal.p),
        kategorie: normalisiereLagerKategorie(modal.p.kategorie ?? null),
        bestand: lagerMenge(modal.p),
        mhd: modal.p.mhd ?? null,
        mindestbestand: modal.p.mindestbestand ?? null,
        immer_da: modal.p.immer_da ?? false,
      }
    : null

  return (
    <PageChrome>
      <PageHero eyebrow="Speisekammer" title="Vorrat & Einkauf" />

      <section className={pageSectionShellClass}>
        <div className={pageSectionPanelClass}>
          <LagerUebersicht
            items={uebersichtItems}
            artikelGesamt={gesamtProdukte}
            mitBestand={mitBestand}
            vorratswert={lagerwertGesamt}
            onOeffnen={oeffneArtikel}
          />
        </div>
      </section>

      <PageSubTabs
        selectId="lager-haupt-tab"
        ariaLabel="Speisekammer: Bereiche"
        className="mb-1"
        tabs={[
          { id: 'bestand' as const, label: 'Bestand', shortLabel: 'Bestand', accent: 'emerald' },
          { id: 'kueche' as const, label: 'Küche & Verlauf', shortLabel: 'Küche', accent: 'violet' },
          { id: 'auswertungen' as const, label: 'Auswertungen', shortLabel: 'Stats', accent: 'sky' },
        ]}
        active={lagerHauptTab}
        onChange={setLagerHauptTab}
      />

      {lagerHauptTab === 'bestand' && (
        <>
          <LagerKassenzettelPanel onBuchungFertig={() => void ladeDaten()} />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setScannerOffen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-sky-600/55 bg-sky-950/40 px-4 py-2.5 text-sm font-bold text-sky-100 transition hover:bg-sky-900/40"
            >
              <span aria-hidden>▦</span> Barcode scannen
            </button>
            <span className={`text-[11px] ${lagerLabelClass}`}>Artikel per Kamera ein-/ausbuchen oder neu zuordnen.</span>
          </div>

          <LagerWasKochen
            refreshKey={lagerRefreshKey}
            artikel={produkte.map((p) => ({
              id: p.id,
              name: p.name,
              menge: lagerMenge(p),
              einheit: basisEinheitFuerPreisanzeige(basisEinheitAnzeige(p)),
            }))}
          />

          <LagerVerbrauchHinweise
            produkte={produkte}
            verbrauchHistorie={verbrauchHistorie}
            letzterEinkaufAm={letzterEinkaufAmMap}
            onMindestbestandSetzen={mindestbestandSetzen}
          />

          <LagerAblaufTimeline items={uebersichtItems} onOeffnen={oeffneArtikel} />

          <LagerEinkaufsliste produkte={produkte} verbrauchHistorie={verbrauchHistorie} refreshKey={lagerRefreshKey} />

          <div className="grid min-w-0 gap-5 lg:grid-cols-3 lg:gap-6">
            <div className={`h-fit min-w-0 overflow-hidden ${pageCardClass}`}>
              <button
                type="button"
                onClick={() => setLagerManuellOffen((o) => !o)}
                className="group flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-[var(--app-surface-hover)]"
                aria-expanded={lagerManuellOffen}
              >
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-[var(--app-text)] sm:text-base">Manuell erfassen</h2>
                </div>
                <CollapsibleRowHeaderEnd open={lagerManuellOffen} labels={LABEL_EINKLAPPEN} tone="neutral" size="sm" />
              </button>
              {lagerManuellOffen && (
                <div className="border-t border-[var(--app-border)] px-4 pb-4 pt-2">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <label className={`block ${lagerLabelSmClass} sm:col-span-2`}>
                      Bezeichnung
                      <input
                        type="text"
                        placeholder="z. B. Vollmilch 3,5 %"
                        className={`${lagerInputClass} mt-1 py-2 font-semibold focus:ring-emerald-500/45`}
                        value={name}
                        onChange={(e) => {
                          const v = e.target.value
                          setName(v)
                          if (neuKategorie === 'Sonstiges') {
                            const k = lagerKategorieAusArtikel(v)
                            if (k !== 'Sonstiges') setNeuKategorie(k)
                          }
                        }}
                        disabled={formularLaden}
                      />
                    </label>
                    <label className={`block ${lagerLabelSmClass}`}>
                      Kategorie
                      <select
                        className={`${lagerInputClass} mt-1 py-2 text-xs font-bold focus:ring-emerald-500/45 sm:text-sm`}
                        value={neuKategorie}
                        onChange={(e) => setNeuKategorie(e.target.value)}
                        disabled={formularLaden}
                      >
                        {LAGER_PRODUKT_KATEGORIEN.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={`block ${lagerLabelSmClass}`}>
                      Einkaufsdatum
                      <input
                        type="date"
                        className={`${lagerInputClass} mt-1 py-2 font-bold focus:ring-emerald-500/45`}
                        value={einkaufsdatum}
                        onChange={(e) => setEinkaufsdatum(e.target.value)}
                        disabled={formularLaden}
                      />
                    </label>
                    <label className={`block ${lagerLabelSmClass}`}>
                      Kauf-Menge
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="z. B. 250"
                        className={`${lagerInputClass} mt-1 py-2 font-semibold focus:ring-emerald-500/45`}
                        value={neuMenge}
                        onChange={(e) => setNeuMenge(e.target.value)}
                        disabled={formularLaden}
                      />
                    </label>
                    <label className={`block ${lagerLabelSmClass}`}>
                      Kauf-Einheit
                      <select
                        className={`${lagerInputClass} mt-1 py-2 text-xs font-bold focus:ring-emerald-500/45 sm:text-sm`}
                        value={neuKaufEinheit}
                        onChange={(e) => setNeuKaufEinheit(e.target.value as LagerKaufEinheit)}
                        disabled={formularLaden}
                      >
                        <option value="Stück">Stück</option>
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="ml">ml</option>
                        <option value="Liter">Liter</option>
                      </select>
                    </label>
                    <label className={`block ${lagerLabelSmClass}`}>
                      Basiseinheit
                      <select
                        className={`${lagerInputClass} mt-1 py-2 text-xs font-bold focus:ring-emerald-500/45 sm:text-sm`}
                        value={neuBasisEinheit}
                        onChange={(e) => setNeuBasisEinheit(e.target.value as LagerBasisEinheit)}
                        disabled={formularLaden}
                      >
                        <option value="Stück">Stück</option>
                        <option value="kg">kg</option>
                        <option value="Liter">Liter</option>
                      </select>
                    </label>
                    <label className={`block ${lagerLabelSmClass}`}>
                      Haltbar bis (MHD)
                      <input
                        type="date"
                        className={`${lagerInputClass} mt-1 py-2 font-bold focus:ring-amber-500/45`}
                        value={neuMhd}
                        onChange={(e) => setNeuMhd(e.target.value)}
                        disabled={formularLaden}
                      />
                    </label>
                    <label className={`block ${lagerLabelSmClass}`}>
                      Mindestbestand
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="optional, z. B. 2"
                        className={`${lagerInputClass} mt-1 py-2 font-semibold focus:ring-sky-500/45`}
                        value={neuMindestbestand}
                        onChange={(e) => setNeuMindestbestand(e.target.value)}
                        disabled={formularLaden}
                      />
                    </label>
                    <label className={`block ${lagerLabelSmClass} sm:col-span-2`}>
                      Gesamtpreis (€)
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="z. B. 5,99"
                        className={`${lagerInputClass} mt-1 py-2 font-semibold focus:ring-emerald-500/45`}
                        value={neuGesamtpreis}
                        onChange={(e) => setNeuGesamtpreis(e.target.value)}
                        disabled={formularLaden}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void speichernNeuesProdukt()}
                      disabled={formularLaden}
                      className="rounded-lg bg-emerald-600 py-2.5 text-sm font-black text-white shadow transition enabled:active:scale-[0.99] disabled:opacity-50 sm:col-span-2"
                    >
                      {formularLaden ? 'Wird gespeichert…' : 'Produkt anlegen'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className={`min-w-0 overflow-hidden ${pageCardClass} lg:col-span-2`}>
          <div className="border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4 md:p-5">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
              <label htmlFor="lager-artikel-suche" className={`${lagerLabelClass} font-bold tracking-[0.2em]`}>
                Artikel suchen
              </label>
              {artikelSuche.trim() || lagerKategorieFilter ? (
                <span className="text-xs tabular-nums text-[var(--app-text-muted)]">
                  {produkteGefiltert.length} / {gesamtProdukte} {gesamtProdukte === 1 ? 'Artikel' : 'Artikel'}
                </span>
              ) : null}
            </div>
            <input
              id="lager-artikel-suche"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder="Name, Einheit oder ähnliche Schreibweise …"
              value={artikelSuche}
              onChange={(e) => setArtikelSuche(e.target.value)}
              className={`${lagerInputClass} mt-2.5 py-3 shadow-inner transition placeholder:text-[var(--app-text-muted)] focus:border-emerald-600/50 focus:ring-emerald-500/25 sm:text-[15px]`}
            />
            <div className="mt-4 min-w-0">
              <p className={`${lagerLabelClass} font-bold tracking-[0.18em]`}>Schnellfilter</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(
                  [
                    ['', 'Alle'],
                    ['ablauf', 'Ablauf'],
                    ['nachkaufen', 'Nachkaufen'],
                    ['leer', 'Leer'],
                    ['ohne_mhd', 'Ohne MHD'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key || 'alle'}
                    type="button"
                    onClick={() => setBestandFilter(key)}
                    className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition sm:text-[13px] ${
                      bestandFilter === key
                        ? 'border-emerald-600/60 bg-emerald-950/40 text-emerald-100'
                        : lagerFilterChipInactiveClass
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 min-w-0">
              <p className={`${lagerLabelClass} font-bold tracking-[0.18em]`}>Warengruppe</p>
              <div className="mt-2 flex max-h-[11rem] flex-wrap gap-1.5 overflow-y-auto pr-0.5 sm:max-h-none sm:overflow-visible">
                <button
                  type="button"
                  onClick={() => setLagerKategorieFilter('')}
                  className={`rounded-lg border px-2.5 py-1.5 text-left text-[12px] font-semibold transition sm:text-[13px] ${
                    !lagerKategorieFilter
                      ? 'border-emerald-600/60 bg-emerald-950/40 text-emerald-100'
                      : lagerFilterChipInactiveClass
                  }`}
                >
                  Alle
                </button>
                {LAGER_PRODUKT_KATEGORIEN.map((kat) => {
                  const aktiv = lagerKategorieFilter === kat
                  return (
                    <button
                      key={kat}
                      type="button"
                      onClick={() => setLagerKategorieFilter(aktiv ? '' : kat)}
                      className={`max-w-[10.5rem] truncate rounded-lg border px-2.5 py-1.5 text-left text-[12px] font-semibold transition sm:max-w-[12rem] sm:text-[13px] ${
                        aktiv
                          ? 'border-sky-600/60 bg-sky-950/45 text-sky-100'
                          : lagerFilterChipInactiveClass
                      }`}
                      title={kat}
                    >
                      {kat}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className={`${lagerKpiCardClass} mt-4 flex flex-col gap-3 p-3 sm:p-4`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <button
                  type="button"
                  onClick={() => void duplikateZusammenfuehren()}
                  disabled={
                    duplikatLaden ||
                    formularLaden ||
                    bestandLeerenLaden ||
                    alleArtikelLoeschenLaden ||
                    gesamtProdukte === 0
                  }
                  className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-sky-950/40 transition hover:bg-sky-500 disabled:pointer-events-none disabled:opacity-35"
                >
                  {duplikatLaden ? '…' : 'Duplikate zusammenführen'}
                </button>
                <button
                  type="button"
                  onClick={() => void alleLagerbestaendeLeeren()}
                  disabled={
                    bestandLeerenLaden ||
                    formularLaden ||
                    duplikatLaden ||
                    alleArtikelLoeschenLaden ||
                    gesamtProdukte === 0
                  }
                  className={lagerSecondaryBtnClass}
                >
                  {bestandLeerenLaden ? '…' : 'Nur Bestände auf 0'}
                </button>
                <button
                  type="button"
                  onClick={() => void alleLagerArtikelLoeschen()}
                  disabled={
                    alleArtikelLoeschenLaden ||
                    formularLaden ||
                    duplikatLaden ||
                    bestandLeerenLaden ||
                    gesamtProdukte === 0
                  }
                  className="rounded-xl border border-rose-600/70 bg-rose-950/50 px-4 py-2.5 text-sm font-bold text-rose-100 transition hover:bg-rose-900/55 disabled:pointer-events-none disabled:opacity-35"
                >
                  {alleArtikelLoeschenLaden ? '…' : 'Alle Artikel löschen'}
                </button>
                {artikelSuche.trim() || lagerKategorieFilter ? (
                  <span className="text-sm tabular-nums text-[var(--app-text-muted)] sm:ml-auto">
                    Summe Ansicht: <span className="font-semibold text-violet-200">{formatEur(lagerwertGefiltert)}</span>
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className={appTableScrollInlineClassName}>
            <table className="w-full max-w-full table-fixed border-collapse text-left text-[12px] leading-tight sm:text-[13px]">
              <colgroup>
                <col className="min-w-0 [width:28%]" />
                <col className="min-w-0 [width:12%]" />
                <col className="min-w-0 [width:12%]" />
                <col className="min-w-0 [width:18%]" />
                <col className="min-w-0 [width:30%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
                  <th className="min-w-0 px-1.5 py-2.5 pl-2 text-left sm:px-2 sm:pl-3">
                    <button
                      type="button"
                      onClick={() => lagerSortKlick('name')}
                      className="inline-flex max-w-full items-center gap-0.5 rounded-md px-0.5 py-0.5 text-left transition hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)]"
                      title="Nach Name sortieren"
                    >
                      <span className="truncate">Artikel</span>
                      <span className="shrink-0 font-mono text-[10px] text-emerald-400/90" aria-hidden>
                        {lagerSortPfeil('name')}
                      </span>
                    </button>
                  </th>
                  <th className="min-w-0 px-1 py-2.5 text-right sm:px-1.5">
                    <button
                      type="button"
                      onClick={() => lagerSortKlick('bestand')}
                      className="inline-flex w-full min-w-0 items-center justify-end gap-0.5 rounded-md px-0.5 py-0.5 transition hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)]"
                      title="Nach Bestand sortieren"
                    >
                      <span className="truncate">Best.</span>
                      <span className="shrink-0 font-mono text-[10px] text-emerald-400/90" aria-hidden>
                        {lagerSortPfeil('bestand')}
                      </span>
                    </button>
                  </th>
                  <th className="min-w-0 px-1 py-2.5 text-right sm:px-1.5">
                    <button
                      type="button"
                      onClick={() => lagerSortKlick('wert')}
                      className="inline-flex w-full min-w-0 items-center justify-end gap-0.5 rounded-md px-0.5 py-0.5 transition hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)]"
                      title="Bestandswert (Menge × Ø, sonst letzter Kauf)"
                    >
                      <span className="truncate">Wert</span>
                      <span className="shrink-0 font-mono text-[10px] text-violet-400/90" aria-hidden>
                        {lagerSortPfeil('wert')}
                      </span>
                    </button>
                  </th>
                  <th className="min-w-0 px-1 py-2.5 text-right sm:px-1.5">
                    <div className="flex flex-col items-end gap-0.5 leading-none">
                      <button
                        type="button"
                        onClick={() => lagerSortKlick('durchschnitt')}
                        className="inline-flex items-center gap-0.5 rounded-md px-0.5 py-0.5 transition hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)]"
                        title="Nach Ø-Preis sortieren"
                      >
                        <span className="text-amber-200/90">Ø</span>
                        <span className="font-mono text-[10px] text-emerald-400/90" aria-hidden>
                          {lagerSortPfeil('durchschnitt')}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => lagerSortKlick('letzter')}
                        className="inline-flex items-center gap-0.5 rounded-md px-0.5 py-0.5 transition hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)]"
                        title="Nach letztem Kaufpreis sortieren"
                      >
                        <span className="text-sky-200/90">Ztz.</span>
                        <span className="font-mono text-[10px] text-emerald-400/90" aria-hidden>
                          {lagerSortPfeil('letzter')}
                        </span>
                      </button>
                    </div>
                  </th>
                  <th className="min-w-0 whitespace-normal px-1 py-2.5 pr-2 text-right sm:px-1.5 sm:pr-3">
                    <span className="text-[var(--app-text-muted)]">Aktion</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {produkteGefiltert.map((p) => {
                  const menge = lagerMenge(p)
                  const wert = bestandswertEur(p)
                  const basis = basisEinheitAnzeige(p)
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-[var(--app-border)] transition-colors last:border-0 hover:bg-[var(--app-surface-hover)]"
                    >
                      <td className="min-w-0 px-1.5 py-2 pl-2 align-middle sm:px-2 sm:pl-3">
                        <div className="truncate font-semibold text-[var(--app-text)]">{p.name}</div>
                        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1">
                          <span className="truncate text-[10px] text-[var(--app-text-muted)]">
                            {normalisiereLagerKategorie(p.kategorie ?? null)}
                          </span>
                          {(() => {
                            const st = mhdStatus(p.mhd ?? null)
                            if (st === 'keine') return null
                            const cls =
                              st === 'abgelaufen'
                                ? 'border-rose-700/50 bg-rose-900/30 text-rose-200'
                                : st === 'bald'
                                  ? 'border-amber-700/50 bg-amber-900/30 text-amber-200'
                                  : 'border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]'
                            return (
                              <span className={`inline-flex shrink-0 items-center rounded border px-1 text-[9px] font-bold ${cls}`}>
                                MHD {mhdKurzLabel(p.mhd ?? null)}
                              </span>
                            )
                          })()}
                          {istUnterMindestbestand(menge, p.mindestbestand ?? null) ? (
                            <span className="inline-flex shrink-0 items-center rounded border border-sky-700/50 bg-sky-900/30 px-1 text-[9px] font-bold text-sky-200">
                              nachkaufen
                            </span>
                          ) : null}
                          {p.immer_da ? (
                            <span className="inline-flex shrink-0 items-center rounded border border-teal-700/50 bg-teal-900/30 px-1 text-[9px] font-bold text-teal-200">
                              ★
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="min-w-0 px-1 py-2 text-right align-middle sm:px-1.5">
                        <button
                          type="button"
                          onClick={() => setModal({ typ: 'verbrauch', p })}
                          title="Menge ausbuchen (genau)"
                          className={`inline-flex max-w-full items-center justify-end rounded-md border px-1 py-0.5 text-[10px] font-semibold tabular-nums transition hover:brightness-125 sm:px-1.5 sm:text-[11px] ${
                            menge > 0
                              ? 'border-emerald-800/40 bg-emerald-500/[0.12] text-emerald-200'
                              : 'border-rose-800/45 bg-rose-500/[0.1] text-rose-200'
                          }`}
                        >
                          <span className="min-w-0 truncate">{menge}</span>
                          <span className="ml-0.5 shrink-0 opacity-90">{basisEinheitFuerPreisanzeige(basis)}</span>
                        </button>
                      </td>
                      <td className="min-w-0 truncate px-1 py-2 text-right align-middle tabular-nums font-medium text-violet-100 sm:px-1.5">
                        {wert != null ? formatEur(wert) : '—'}
                      </td>
                      <td className="min-w-0 px-1 py-2 text-right align-middle sm:px-1.5">
                        <div className="ml-auto max-w-full space-y-0.5 text-[10px] tabular-nums leading-tight sm:text-[11px]">
                          <div className="truncate text-amber-100/90" title={formatEurJeBasiseinheit(p.durchschnittspreis ?? null, basis)}>
                            {formatEurJeBasiseinheit(p.durchschnittspreis ?? null, basis)}
                          </div>
                          <div className="truncate text-sky-100/85" title={formatEurJeBasiseinheit(p.letzterEinkaufspreis ?? null, basis)}>
                            {formatEurJeBasiseinheit(p.letzterEinkaufspreis ?? null, basis)}
                            {(() => {
                              const pct = preisAenderungProzent(p.letzterEinkaufspreis ?? null, p.vorletzterEinkaufspreis ?? null)
                              const lbl = preisAenderungLabel(pct)
                              if (!lbl) return null
                              const up = (pct ?? 0) > 0
                              return (
                                <span
                                  className={`ml-0.5 inline-block rounded px-0.5 text-[9px] font-bold ${up ? 'text-rose-300' : 'text-emerald-300'}`}
                                >
                                  {lbl}
                                </span>
                              )
                            })()}
                          </div>
                        </div>
                      </td>
                      <td className="min-w-0 px-1 py-2 pr-2 text-right align-middle sm:px-1.5 sm:pr-3">
                        <div className="inline-flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            onClick={() => void schnellBuchen(p, 'minus')}
                            disabled={menge <= 0}
                            className="rounded-md border border-amber-800/40 bg-amber-500/15 px-1.5 py-1 text-[11px] font-black text-amber-100 transition hover:bg-amber-500/25 disabled:opacity-30"
                            title="1 ausbuchen"
                            aria-label="Eins ausbuchen"
                          >
                            −1
                          </button>
                          <button
                            type="button"
                            onClick={() => void schnellBuchen(p, 'plus')}
                            className="rounded-md border border-emerald-800/40 bg-emerald-500/15 px-1.5 py-1 text-[11px] font-black text-emerald-100 transition hover:bg-emerald-500/25"
                            title="1 einbuchen"
                            aria-label="Eins einbuchen"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const nun = toggleMerker(p.id)
                              toast.success(nun ? `„${p.name}" auf die Einkaufsliste gesetzt.` : `„${p.name}" von der Liste entfernt.`)
                            }}
                            className={`rounded-md border px-1.5 py-1 text-[11px] font-bold transition ${
                              istGemerkt(p.id)
                                ? 'border-sky-600/60 bg-sky-500/20 text-sky-100'
                                : 'border-[var(--app-border-strong)] text-[var(--app-text)] hover:bg-[var(--app-surface-hover)]'
                            }`}
                            title="Auf die Einkaufsliste setzen"
                            aria-label="Auf die Einkaufsliste setzen"
                          >
                            🛒
                          </button>
                          <button
                            type="button"
                            onClick={() => setModal({ typ: 'bearbeiten', p })}
                            className="rounded-md border border-[var(--app-border-strong)] hover:bg-[var(--app-surface-hover)]"
                            title="Bearbeiten"
                            aria-label="Bearbeiten"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            onClick={() => void produktLoeschen(p)}
                            className="rounded-md border border-rose-800/45 px-1.5 py-1 text-[11px] font-bold text-rose-300 transition hover:bg-rose-500/15"
                            title="Löschen"
                            aria-label="Löschen"
                          >
                            ×
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {produkteGefiltert.length > 0 ? (
                <tfoot>
                  <tr className="border-t-2 border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] text-[12px] font-semibold text-[var(--app-text)] sm:text-[13px]">
                    <td className="min-w-0 px-1.5 py-2.5 pl-2 sm:px-2 sm:pl-3">
                      <span className="text-[var(--app-text-muted)]">
                        Σ{artikelSuche.trim() || lagerKategorieFilter ? ' Ansicht' : ''}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-normal text-[var(--app-text-muted)]">{produkteGefiltert.length} Z.</span>
                    </td>
                    <td className="min-w-0 px-1 py-2.5 sm:px-1.5" />
                    <td className="min-w-0 truncate px-1 py-2.5 text-right align-middle tabular-nums text-sm text-violet-200 sm:px-1.5 sm:text-base">
                      {formatEur(lagerwertGefiltert)}
                    </td>
                    <td className="min-w-0 px-1 py-2.5 sm:px-1.5" />
                    <td className="min-w-0 px-1 py-2.5 pr-2 sm:px-1.5 sm:pr-3" />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
          {produkte.length === 0 && (
            <div className="border-t border-[var(--app-border)] px-4 py-12 text-center text-sm italic text-[var(--app-text-muted)] sm:px-6">
              Hier ist noch alles ruhig…
            </div>
          )}
          {produkte.length > 0 && produkteGefiltert.length === 0 && (
            <div className="border-t border-[var(--app-border)] px-4 py-10 text-center text-sm text-[var(--app-text-muted)] sm:px-6">
              {artikelSuche.trim() ? (
                <>
                  Keine Artikel passen zu „<span className="font-medium text-[var(--app-text-muted)]">{artikelSuche.trim()}</span>“
                  {lagerKategorieFilter ? (
                    <>
                      {' '}
                      in <span className="font-medium text-[var(--app-text-muted)]">{lagerKategorieFilter}</span>
                    </>
                  ) : null}
                  .
                </>
              ) : lagerKategorieFilter ? (
                <>
                  In der Warengruppe <span className="font-medium text-[var(--app-text-muted)]">{lagerKategorieFilter}</span> sind
                  keine Artikel.
                </>
              ) : (
                <>Keine Artikel in der aktuellen Auswahl.</>
              )}
            </div>
          )}
            </div>
          </div>
        </>
      )}

      {lagerHauptTab === 'kueche' && (
        <div className="space-y-4">
          <LagerRezeptCoach
            artikel={produkte.map((p) => ({
              id: p.id,
              name: p.name,
              menge: lagerMenge(p),
              einheit: basisEinheitFuerPreisanzeige(basisEinheitAnzeige(p)),
            }))}
            onLagerAktualisiert={() => void ladeDaten()}
            onKatalogGeaendert={() => setRezeptKatalogRefreshKey((k) => k + 1)}
          />
          <LagerRezeptKatalog
            refreshKey={rezeptKatalogRefreshKey}
            artikel={produkte.map((p) => ({
              id: p.id,
              name: p.name,
              menge: lagerMenge(p),
              einheit: basisEinheitFuerPreisanzeige(basisEinheitAnzeige(p)),
            }))}
          />
          <LagerGekochteMahlzeiten
            refreshKey={lagerRefreshKey}
            onNachBuchung={() => void ladeDaten()}
            produktOptionen={produkte.map((p) => ({
              id: p.id,
              name: p.name,
              menge: lagerMenge(p),
              einheit: basisEinheitFuerPreisanzeige(basisEinheitAnzeige(p)),
              preisJeBasis: preisJeBasisFuerBestandswert(p),
            }))}
          />
          <LagerBestandVerlauf
            refreshKey={lagerRefreshKey}
            onNachAenderung={() => void ladeDaten()}
            produktInfos={produkte.map((p) => ({
              id: p.id,
              name: p.name,
              einheit: basisEinheitFuerPreisanzeige(basisEinheitAnzeige(p)),
            }))}
          />
        </div>
      )}

      {lagerHauptTab === 'auswertungen' && (
        <LagerAuswertungen
          refreshKey={lagerRefreshKey}
          produkte={produkte.map((p) => ({
            id: p.id,
            name: p.name,
            kategorie: p.kategorie ?? null,
            einheit: basisEinheitAnzeige(p),
          }))}
        />
      )}

      <LagerProduktModals
        modus={modal?.typ ?? null}
        produkt={modalZeile ?? null}
        onClose={() => setModal(null)}
        onErfolg={() => void ladeDaten()}
      />

      {scannerOffen && (
        <LagerBarcodeScanner
          produkte={scannerProdukte}
          onClose={() => setScannerOffen(false)}
          onAenderung={() => void ladeDaten()}
        />
      )}
    </PageChrome>
  )
}
