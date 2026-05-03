'use client'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { appModalBackdropClassName, appModalPanelClassName } from '@/lib/app-modal-overlay'
import { supabase } from '@/lib/supabase'
import { buildFinanceCoachSnapshot, useFinanceCoachSnapshot } from '@/components/finance-coach'
import { KategorieMark } from '@/lib/kategorie-icon'
import { berechneAusgabenMonatsFeedback } from '@/lib/finanzen-ausgaben-feedback'
import toast from 'react-hot-toast'
import { PageChrome, PageHero, PageSection, PageSectionPanel } from '@/components/page-shell'

/** Monatlich am 1. des Monats (Ausgaben) — Import legt nur fehlende Bezeichnungen an. */
const VORGABE_DAUERAUFTRAeGE_MONATSANFANG: Array<{
  typ: 'ausgabe'
  kategorie: string
  betrag: number
  tag_des_monats: number
}> = [
  { typ: 'ausgabe', kategorie: 'Aktien', betrag: 1200, tag_des_monats: 1 },
  { typ: 'ausgabe', kategorie: 'Schwäbisch Hall Bausparer', betrag: 200, tag_des_monats: 1 },
  { typ: 'ausgabe', kategorie: 'Maximilian Eichlseder', betrag: 7, tag_des_monats: 1 },
  { typ: 'ausgabe', kategorie: 'Allianz Lebensversicherung', betrag: 57.56, tag_des_monats: 1 },
  { typ: 'ausgabe', kategorie: 'UniProfiRente Select Fond', betrag: 50, tag_des_monats: 1 },
  { typ: 'ausgabe', kategorie: 'O2 Handyvertrag', betrag: 8.49, tag_des_monats: 1 },
  { typ: 'ausgabe', kategorie: 'UniGlobal Fond', betrag: 125, tag_des_monats: 1 },
  { typ: 'ausgabe', kategorie: 'Gemini', betrag: 7.99, tag_des_monats: 1 },
  { typ: 'ausgabe', kategorie: 'Strava', betrag: 6.25, tag_des_monats: 1 },
  { typ: 'ausgabe', kategorie: 'Whoop', betrag: 22, tag_des_monats: 1 },
  { typ: 'ausgabe', kategorie: 'Netflix', betrag: 4.99, tag_des_monats: 1 },
  { typ: 'ausgabe', kategorie: 'Discovery+', betrag: 3.99, tag_des_monats: 1 },
]

function heuteAlsTTMMJJJJ() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

/** YYYY-MM aus ISO-Datum (Kalendermonat des Tags / der gespeicherten Periode). */
function isoMonatsschluesselAusDatumString(iso?: string | null): string | null {
  if (!iso) return null
  const head = String(iso).slice(0, 10)
  const m = head.match(/^(\d{4})-(\d{2})-\d{2}$/)
  if (m) return `${m[1]}-${m[2]}`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function aktuellesIsoMonat(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function parseIsoMonat(yyyymm: string): { jahr: number; monat: number } {
  const [y, mo] = yyyymm.split('-').map((x) => Number.parseInt(x, 10))
  return { jahr: y, monat: mo }
}

/** Nächster/vorheriger Kalendermonat (YYYY-MM). */
function isoMonatPlusDelta(yyyymm: string, monateDelta: number): string {
  const { jahr, monat } = parseIsoMonat(yyyymm)
  const d = new Date(jahr, monat - 1 + monateDelta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function istLetzterKalendertagImMonat(jetzt: Date): boolean {
  const y = jetzt.getFullYear()
  const mo = jetzt.getMonth()
  const last = new Date(y, mo + 1, 0).getDate()
  return jetzt.getDate() === last
}

function vergleichIsoMonat(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/** Inklusive von/bis; leer wenn von > bis. */
function aufzaehlungIsoMonateVonBis(einschliesslichVon: string, einschliesslichBis: string): string[] {
  if (vergleichIsoMonat(einschliesslichVon, einschliesslichBis) > 0) return []
  const out: string[] = []
  let cur = einschliesslichVon
  while (vergleichIsoMonat(cur, einschliesslichBis) <= 0) {
    out.push(cur)
    cur = isoMonatPlusDelta(cur, 1)
  }
  return out
}

/** Letzter Monat, für den eine automatische Topf-Übernahme erlaubt ist (laufender Monat nur am letzten Kalendertag). */
function letzteMonatFuerAutomatikRestTopf(jetzt: Date): string {
  const cur = aktuellesIsoMonat()
  if (istLetzterKalendertagImMonat(jetzt)) return cur
  return isoMonatPlusDelta(cur, -1)
}

/** Inklusive Monatsliste von min bis max (YYYY-MM). */
function monatsSpannenListe(minYYYYMM: string, maxYYYYMM: string): string[] {
  const [y1, m1] = minYYYYMM.split('-').map(Number)
  const [y2, m2] = maxYYYYMM.split('-').map(Number)
  let y = y1
  let m = m1
  const out: string[] = []
  while (y < y2 || (y === y2 && m <= m2)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out.length ? out : [aktuellesIsoMonat()]
}

function formatMonatsLabelDe(yyyymm: string) {
  const { jahr, monat } = parseIsoMonat(yyyymm)
  try {
    return new Date(jahr, monat - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  } catch {
    return yyyymm
  }
}

function isoErsterAktuellerMonatStatic(): string {
  const jetzt = new Date()
  return `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-01`
}

function isoErsterDesMonatsVonDatumStatic(referenceIso?: string | null): string {
  if (!referenceIso) return isoErsterAktuellerMonatStatic()
  const head = String(referenceIso).slice(0, 10)
  const m = head.match(/^(\d{4})-(\d{2})-\d{2}$/)
  if (m) return `${m[1]}-${m[2]}-01`
  const d = new Date(referenceIso)
  if (Number.isNaN(d.getTime())) return isoErsterAktuellerMonatStatic()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

/** Ausgaben aus PDF- oder Bild-Rechnung. */
function istRechnungsbelegImport(beschreibung?: string) {
  const b = beschreibung
  return typeof b === 'string' && (b.includes('Rechnung • PDF:') || b.includes('Rechnung • Bild:'))
}

/** Gleiche Logik wie in der Komponente `datumFuerListenanzeige` — für useMemo ohne Hook-Warnungen. */
function datumFuerListenanzeigeMonat(item: { __geplant?: boolean; beschreibung?: string; datum?: string }) {
  if (item.__geplant) return item.datum ?? isoErsterDesMonatsVonDatumStatic(undefined)
  if (istRechnungsbelegImport(item.beschreibung)) return item.datum ?? isoErsterDesMonatsVonDatumStatic(undefined)
  return item.datum ?? isoErsterDesMonatsVonDatumStatic(undefined)
}

function monatSchluesselFuerZeile(item: { __geplant?: boolean; beschreibung?: string; datum?: string }) {
  return isoMonatsschluesselAusDatumString(datumFuerListenanzeigeMonat(item))
}

function summeRestTopfSaldoFuerMonat(
  monat: string,
  einnahmen: Array<{ betrag?: number; datum?: string; beschreibung?: string }>,
  ausgaben: Array<{ betrag?: number; datum?: string; beschreibung?: string }>,
): number {
  const ein = einnahmen
    .filter((r) => monatSchluesselFuerZeile(r) === monat)
    .reduce((a, r) => a + (Number.isFinite(Number(r.betrag)) ? Number(r.betrag) : 0), 0)
  const aus = ausgaben
    .filter((r) => monatSchluesselFuerZeile(r) === monat)
    .reduce((a, r) => a + (Number.isFinite(Number(r.betrag)) ? Number(r.betrag) : 0), 0)
  return Math.round((ein - aus) * 100) / 100
}

function fruehesterFinanzMonatAusEinAus(
  einnahmen: Array<{ datum?: string; beschreibung?: string }>,
  ausgaben: Array<{ datum?: string; beschreibung?: string }>,
): string | null {
  let min: string | null = null
  const upd = (row: { datum?: string; beschreibung?: string }) => {
    const k = monatSchluesselFuerZeile(row)
    if (!k) return
    if (min == null || vergleichIsoMonat(k, min) < 0) min = k
  }
  for (const r of einnahmen) upd(r)
  for (const r of ausgaben) upd(r)
  return min
}

export default function FinanzenPage() {
  const [einnahmen, setEinnahmen] = useState<any[]>([])
  const [ausgaben, setAusgaben] = useState<any[]>([])
  const [dauerauftraege, setDauerauftraege] = useState<any[]>([])
  const [typ, setTyp] = useState<'einnahme' | 'ausgabe'>('einnahme')
  const [firma, setFirma] = useState('')
  const [grund, setGrund] = useState('')
  const [betrag, setBetrag] = useState('')
  const [notiz, setNotiz] = useState('')
  const [buchungDatum, setBuchungDatum] = useState(heuteAlsTTMMJJJJ)
  /** Liste & Kennzahlen: gewählter Kalendermonat (YYYY-MM). Später weitere unabhängige Monats-Slider möglich. */
  const [ansichtMonat, setAnsichtMonat] = useState(aktuellesIsoMonat)
  const [isPdfLoading, setIsPdfLoading] = useState(false)
  const [daTyp, setDaTyp] = useState<'einnahme' | 'ausgabe'>('ausgabe')
  const [daKategorie, setDaKategorie] = useState('')
  const [daBetrag, setDaBetrag] = useState('')
  const [daTag, setDaTag] = useState('1')
  const [daEditId, setDaEditId] = useState<string | number | null>(null)

  const [buchungEdit, setBuchungEdit] = useState<{
    id: string | number
    isIn: boolean
    kategorie: string
    betrag: string
    beschreibung: string
    datumStr: string
  } | null>(null)

  const [pendingInvoice, setPendingInvoice] = useState<{
    amount: string
    vendor: string
    fileName: string
    date: string
    dateCandidates: Array<{ iso: string; display: string; hint: string }>
  } | null>(null)

  /** `alle` = alle Zeilen des Monats; sonst nur Einnahmen- bzw. Ausgaben-Zeilen (inkl. geplante Daueraufträge passend zum Typ). */
  const [finanzListenFilter, setFinanzListenFilter] = useState<'alle' | 'einnahme' | 'ausgabe'>('alle')
  const [finanzListeSuche, setFinanzListeSuche] = useState('')
  const [finanzSort, setFinanzSort] = useState<{
    modus: 'preset' | 'datum' | 'position' | 'betrag'
    dir: 'asc' | 'desc'
  }>({ modus: 'preset', dir: 'desc' })

  type TopfMonatRow = { monat: string; saldo_monat: number; gebucht_am: string; automatisch?: boolean | null }
  const [topfMeta, setTopfMeta] = useState({ stand_offset: 0 })
  const [topfMonate, setTopfMonate] = useState<TopfMonatRow[]>([])
  /** null = noch nicht geladen; false = Tabellen fehlen / Fehler */
  const [topfSchemaOk, setTopfSchemaOk] = useState<boolean | null>(null)
  const [topfBuchungLaden, setTopfBuchungLaden] = useState(false)
  const [topfAnpassenOffen, setTopfAnpassenOffen] = useState(false)
  const [topfAnpassenBetrag, setTopfAnpassenBetrag] = useState('')
  const autoRestTopfLaeuft = useRef(false)

  const setCoachContext = useFinanceCoachSnapshot()

  function istDauerauftragBuchung(item: { beschreibung?: string }) {
    const b = item.beschreibung
    return typeof b === 'string' && b.includes('Dauerauftrag (Auto)')
  }

  /** Manuell per PDF- oder Bild-Import. */
  function istPdfRechnungsImport(item: { beschreibung?: string }) {
    return istRechnungsbelegImport(item.beschreibung)
  }

  /** Erster Kalendertag des aktuellen Monats (YYYY-MM-01), für geplante Dauerauftrag-Zeilen. */
  function isoErsterAktuellerMonat(): string {
    return isoErsterAktuellerMonatStatic()
  }

  /** Erster des Monats derselben Kalenderperiode (nur für geplante Darstellungen). */
  function isoErsterDesMonatsVonDatum(referenceIso?: string | null): string {
    return isoErsterDesMonatsVonDatumStatic(referenceIso)
  }

  function datumFuerListenanzeige(item: { __geplant?: boolean; beschreibung?: string; datum?: string }) {
    return datumFuerListenanzeigeMonat(item)
  }

  function hatDauerauftragImMonatGebucht(order: { typ?: string; kategorie: string }) {
    const { jahr, monat } = parseIsoMonat(ansichtMonat)
    const monatIndex0 = monat - 1
    const istEinnahme = String(order.typ || '').toLowerCase().trim() === 'einnahme'
    const liste = istEinnahme ? einnahmen : ausgaben
    return liste.some((row) => {
      if (!istDauerauftragBuchung(row)) return false
      if (String(row.kategorie) !== String(order.kategorie)) return false
      const d = new Date(row.datum)
      return d.getFullYear() === jahr && d.getMonth() === monatIndex0
    })
  }

  function buildFinanzListe() {
    const { jahr, monat } = parseIsoMonat(ansichtMonat)
    const ersterMonatstag = new Date(jahr, monat - 1, 1, 12, 0, 0, 0)

    const geplant = dauerauftraege
      .filter((d) => !hatDauerauftragImMonatGebucht(d))
      .map((d) => ({
        id: `__geplant__${d.id}`,
        isIn: String(d.typ || '').toLowerCase().trim() === 'einnahme',
        kategorie: d.kategorie,
        betrag: Number(d.betrag),
        datum: ersterMonatstag.toISOString(),
        beschreibung: 'Monatsplan (Ausführung steht noch aus)',
        __geplant: true,
      }))

    const gebuchtAll = [...einnahmen.map((e) => ({ ...e, isIn: true })), ...ausgaben.map((a) => ({ ...a, isIn: false }))]
    const gebucht = gebuchtAll.filter((row) => monatSchluesselFuerZeile(row) === ansichtMonat)

    const sortTier = (item: any) => {
      if (item.__geplant) return 0
      if (istDauerauftragBuchung(item)) return 1
      return 2
    }

    return [...geplant, ...gebucht].sort((a: any, b: any) => {
      const ta = sortTier(a)
      const tb = sortTier(b)
      if (ta !== tb) return ta - tb
      if (ta === 0) return String(a.kategorie || '').localeCompare(String(b.kategorie || ''), 'de')
      const t =
        new Date(datumFuerListenanzeige(b)).getTime() - new Date(datumFuerListenanzeige(a)).getTime()
      if (t !== 0) return t
      return String(a.kategorie || '').localeCompare(String(b.kategorie || ''), 'de')
    })
  }

  const einnahmenAnsicht = useMemo(
    () => einnahmen.filter((r) => monatSchluesselFuerZeile(r) === ansichtMonat),
    [einnahmen, ansichtMonat],
  )
  const ausgabenAnsicht = useMemo(
    () => ausgaben.filter((r) => monatSchluesselFuerZeile(r) === ansichtMonat),
    [ausgaben, ansichtMonat],
  )

  const monatsListeNavigation = useMemo(() => {
    const keys = new Set<string>()
    keys.add(aktuellesIsoMonat())
    keys.add(ansichtMonat)
    const addRow = (r: { datum?: string; beschreibung?: string }) => {
      const k = monatSchluesselFuerZeile(r)
      if (k) keys.add(k)
    }
    for (const r of einnahmen) addRow(r)
    for (const r of ausgaben) addRow(r)
    const sorted = [...keys].sort()
    return monatsSpannenListe(sorted[0]!, sorted[sorted.length - 1]!)
  }, [einnahmen, ausgaben, ansichtMonat])

  useEffect(() => {
    setCoachContext(buildFinanceCoachSnapshot(einnahmenAnsicht, ausgabenAnsicht, dauerauftraege))
    return () => setCoachContext(null)
  }, [einnahmenAnsicht, ausgabenAnsicht, dauerauftraege, setCoachContext])

  function formatDateDDMMYYYY(value?: string) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  function toIsoDateFromDDMMYYYY(value: string) {
    const parts = value.trim().split('/')
    if (parts.length !== 3) return null
    const day = Number.parseInt(parts[0], 10)
    const month = Number.parseInt(parts[1], 10)
    const year = Number.parseInt(parts[2], 10)
    if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100) return null
    return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
  }

  async function ladeDaten() {
    const { data: ein, error: einErr } = await supabase.from('einnahmen').select('*').order('datum', { ascending: false })
    const { data: aus, error: ausErr } = await supabase.from('ausgaben').select('*').order('datum', { ascending: false })
    if (einErr || ausErr) {
      console.warn('[Finanzen] ladeDaten', einErr ?? ausErr)
      toast.error('Finanzdaten konnten nicht geladen werden (RLS/DB prüfen).')
    }
    setEinnahmen(ein || [])
    setAusgaben(aus || [])
  }

  async function ladeDauerauftraege() {
    const { data, error } = await supabase.from('dauerauftraege').select('*').order('tag_des_monats', { ascending: true })
    if (error) {
      console.warn('[Finanzen] ladeDauerauftraege', error)
      toast.error('Daueraufträge konnten nicht geladen werden (RLS/DB prüfen).')
    }
    setDauerauftraege(data || [])
  }

  async function ladeRestTopf() {
    const { data: meta, error: e1 } = await supabase.from('finanz_rest_topf_meta').select('stand_offset').eq('id', 1).maybeSingle()
    let rowsRes = await supabase
      .from('finanz_rest_topf_monatsbuchung')
      .select('monat, saldo_monat, gebucht_am, automatisch')
      .order('monat', { ascending: true })
    let e2 = rowsRes.error
    let rows = rowsRes.data as TopfMonatRow[] | null
    if (e2) {
      const m = String(e2.message || '').toLowerCase()
      if (m.includes('automatisch') || (m.includes('column') && m.includes('does not exist'))) {
        const fallback = await supabase
          .from('finanz_rest_topf_monatsbuchung')
          .select('monat, saldo_monat, gebucht_am')
          .order('monat', { ascending: true })
        e2 = fallback.error
        rows = fallback.data as TopfMonatRow[] | null
      }
    }
    const fehlt =
      (e1 && (String(e1.message || '').includes('does not exist') || String(e1.code || '') === '42P01')) ||
      (e2 && (String(e2.message || '').includes('does not exist') || String(e2.code || '') === '42P01'))
    if (e1 || e2) {
      if (fehlt) setTopfSchemaOk(false)
      else {
        const err = e1 ?? e2
        const teile = [err?.code, err?.message, err?.details, err?.hint].filter(
          (x): x is string => typeof x === 'string' && x.trim().length > 0,
        )
        if (teile.length) console.warn('[Rest-Topf]', teile.join(' — '))
        setTopfSchemaOk(false)
      }
      return
    }
    setTopfSchemaOk(true)
    setTopfMeta({ stand_offset: Number(meta?.stand_offset) || 0 })
    setTopfMonate(rows || [])
  }

  async function buchRestTopfFuerAnsichtsmonat() {
    if (topfSchemaOk !== true) {
      toast.error('Erarbeiteter Puffer ist nicht eingerichtet (SQL in Supabase ausführen).')
      return
    }
    const gebucht = topfMonate.some((r) => r.monat === ansichtMonat)
    if (gebucht) {
      toast.error('Für diesen Monat wurde der Saldo bereits in den erarbeiteten Puffer gebucht.')
      return
    }
    const einMon = einnahmenAnsicht.reduce((a, b) => a + Number(b.betrag || 0), 0)
    const ausMon = ausgabenAnsicht.reduce((a, b) => a + Number(b.betrag || 0), 0)
    const delta = Math.round((einMon - ausMon) * 100) / 100
    if (ansichtMonat === aktuellesIsoMonat()) {
      if (
        !window.confirm(
          'Laufender Monat — Buchungen können sich noch ändern. Monatssaldo trotzdem in den erarbeiteten Puffer übernehmen?',
        )
      )
        return
    }
    if (
      !window.confirm(
        `Monatssaldo ${delta.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} in den erarbeiteten Puffer übernehmen?`,
      )
    )
      return
    setTopfBuchungLaden(true)
    try {
      let ins = await supabase.from('finanz_rest_topf_monatsbuchung').insert({
        monat: ansichtMonat,
        saldo_monat: delta,
        automatisch: false,
      })
      if (ins.error) {
        const em = String(ins.error.message || '').toLowerCase()
        if (em.includes('automatisch') || (em.includes('column') && em.includes('does not exist'))) {
          ins = await supabase.from('finanz_rest_topf_monatsbuchung').insert({ monat: ansichtMonat, saldo_monat: delta })
        }
      }
      const { error } = ins
      if (error) {
        if (String(error.code) === '23505') toast.error('Dieser Monat ist bereits verbucht.')
        else toast.error(error.message || 'Speichern fehlgeschlagen.')
        return
      }
      toast.success(delta >= 0 ? 'Überschuss im erarbeiteten Puffer verbucht.' : 'Defizit vom erarbeiteten Puffer abgezogen.')
      await ladeRestTopf()
    } finally {
      setTopfBuchungLaden(false)
    }
  }

  async function speichereRestTopfSaldoAnpassung() {
    if (topfSchemaOk !== true) return
    const neu = Number.parseFloat(topfAnpassenBetrag.replace(',', '.'))
    if (!Number.isFinite(neu)) {
      toast.error('Bitte einen gültigen Betrag eingeben.')
      return
    }
    const gerundet = Math.round(neu * 100) / 100
    setTopfBuchungLaden(true)
    try {
      const { error } = await supabase
        .from('finanz_rest_topf_monatsbuchung')
        .update({ saldo_monat: gerundet, gebucht_am: new Date().toISOString() })
        .eq('monat', ansichtMonat)
      if (error) {
        const em = String(error.message || '').toLowerCase()
        if (em.includes('policy') || em.includes('permission') || em.includes('42501')) {
          toast.error(
            'Anpassen nicht erlaubt — Zusatz-Migration ausführen: supabase/migrations/20260421110000_finanz_rest_topf_automatisch_update.sql',
          )
        } else toast.error(error.message || 'Speichern fehlgeschlagen.')
        return
      }
      toast.success('Verbuchter Monatssaldo im erarbeiteten Puffer wurde angepasst.')
      setTopfAnpassenOffen(false)
      await ladeRestTopf()
    } finally {
      setTopfBuchungLaden(false)
    }
  }

  async function verarbeiteDauerauftraege() {
    const { data: orders } = await supabase.from('dauerauftraege').select('*')
    if (!orders) return
    
    const heute = new Date()
    const monatJahr = `${heute.getFullYear()}-${heute.getMonth()}`
    const lastDayOfMonth = new Date(heute.getFullYear(), heute.getMonth() + 1, 0).getDate()

    for (const order of orders) {
      const letzte = order.letzte_ausfuehrung ? new Date(order.letzte_ausfuehrung) : null
      const letzteMonatJahr = letzte ? `${letzte.getFullYear()}-${letzte.getMonth()}` : ''

      const rawTag = Number.parseInt(String(order.tag_des_monats), 10)
      const wunschTag = Number.isFinite(rawTag) ? Math.min(Math.max(rawTag, 1), 31) : 1
      const faelligTag = Math.min(wunschTag, lastDayOfMonth)

      // Prüfen: Wurde diesen Monat schon gebucht?
      if (letzteMonatJahr !== monatJahr && heute.getDate() >= faelligTag) {
        
        // DOPPELTER CHECK: Wir schauen ganz genau hin
        const istWirklichEinnahme = order.typ.toLowerCase().trim() === 'einnahme'
        const zielTabelle = istWirklichEinnahme ? 'einnahmen' : 'ausgaben'
        
        const { error: insError } = await supabase.from(zielTabelle).insert([
          {
            kategorie: order.kategorie,
            betrag: order.betrag,
            beschreibung: 'Dauerauftrag (Auto)',
            datum: isoErsterAktuellerMonat(),
          },
        ])

        if (!insError) {
          await supabase.from('dauerauftraege').update({ letzte_ausfuehrung: heute.toISOString() }).eq('id', order.id)
          toast.success(`Automatisch gebucht: ${order.kategorie}`)
        } else {
          console.error("Fehler beim Auto-Booking:", insError)
        }
      }
    }
    ladeDaten()
    ladeDauerauftraege()
  }

  useEffect(() => {
    const run = async () => {
      await ladeDaten()
      await ladeDauerauftraege()
      await verarbeiteDauerauftraege()
      await ladeRestTopf()
    }
    run()
  }, [])

  /** Fehlende Monate bis inkl. letztem abgeschlossenen (bzw. laufendem Monat am letzten Kalendertag) automatisch in den Topf buchen. */
  useEffect(() => {
    if (topfSchemaOk !== true) return
    if (autoRestTopfLaeuft.current) return

    const jetzt = new Date()
    const end = letzteMonatFuerAutomatikRestTopf(jetzt)
    let start = fruehesterFinanzMonatAusEinAus(einnahmen, ausgaben)
    if (!start || vergleichIsoMonat(start, end) > 0) return

    const cap = isoMonatPlusDelta(end, -71)
    if (vergleichIsoMonat(start, cap) < 0) start = cap

    const gebucht = new Set(topfMonate.map((r) => r.monat))
    const zuBuchen = aufzaehlungIsoMonateVonBis(start, end).filter((m) => !gebucht.has(m))
    if (zuBuchen.length === 0) return

    autoRestTopfLaeuft.current = true
    void (async () => {
      let n = 0
      try {
        for (const m of zuBuchen) {
          const delta = summeRestTopfSaldoFuerMonat(m, einnahmen, ausgaben)
          let ins = await supabase.from('finanz_rest_topf_monatsbuchung').insert({
            monat: m,
            saldo_monat: delta,
            automatisch: true,
          })
          if (ins.error) {
            const em = String(ins.error.message || '').toLowerCase()
            if (em.includes('automatisch') || (em.includes('column') && em.includes('does not exist'))) {
              ins = await supabase.from('finanz_rest_topf_monatsbuchung').insert({ monat: m, saldo_monat: delta })
            }
          }
          const { error } = ins
          if (error) {
            if (String(error.code) === '23505') continue
            toast.error(error.message || 'Automatische Puffer-Übernahme fehlgeschlagen.')
            break
          }
          n++
        }
        if (n > 0) {
          toast.success(
            n === 1
              ? 'Erarbeiteter Puffer: Ein Monat wurde automatisch verbucht.'
              : `Erarbeiteter Puffer: ${n} Monate wurden automatisch verbucht.`,
          )
          await ladeRestTopf()
        }
      } finally {
        autoRestTopfLaeuft.current = false
      }
    })()
  }, [topfSchemaOk, topfMonate, einnahmen, ausgaben])

  useEffect(() => {
    setTopfAnpassenOffen(false)
  }, [ansichtMonat])

  useEffect(() => {
    if (!buchungEdit) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBuchungEdit(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [buchungEdit])

  function resetDauerauftragFormular() {
    setDaEditId(null)
    setDaKategorie('')
    setDaBetrag('')
    setDaTag('1')
    setDaTyp('ausgabe')
  }

  function starteBearbeitungDauerauftrag(row: {
    id: string | number
    typ?: string
    kategorie: string
    betrag: number | string
    tag_des_monats: number | string
  }) {
    setDaEditId(row.id)
    setDaTyp(String(row.typ || '').toLowerCase().trim() === 'einnahme' ? 'einnahme' : 'ausgabe')
    setDaKategorie(String(row.kategorie || ''))
    setDaBetrag(String(row.betrag ?? ''))
    setDaTag(String(row.tag_des_monats ?? '1'))
    document.getElementById('dauerauftrag-neu')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  async function speichereDauerauftrag() {
    if (!daKategorie.trim()) return toast.error('Bezeichnung eingeben (z. B. Bausparer).')
    const betrag = Number.parseFloat(daBetrag.replace(',', '.'))
    if (!Number.isFinite(betrag) || betrag <= 0) return toast.error('Gültigen Betrag eingeben.')
    const tag = Number.parseInt(daTag, 10)
    if (!Number.isFinite(tag) || tag < 1 || tag > 31) return toast.error('Tag im Monat: 1–31.')

    if (daEditId != null) {
      const { error } = await supabase
        .from('dauerauftraege')
        .update({
          typ: daTyp,
          kategorie: daKategorie.trim(),
          betrag,
          tag_des_monats: tag,
        })
        .eq('id', daEditId)
      if (error) {
        toast.error('Dauerauftrag konnte nicht aktualisiert werden.')
        return
      }
      toast.success('Dauerauftrag aktualisiert.')
      resetDauerauftragFormular()
      await ladeDauerauftraege()
      await verarbeiteDauerauftraege()
      return
    }

    const { error } = await supabase.from('dauerauftraege').insert([
      {
        typ: daTyp,
        kategorie: daKategorie.trim(),
        betrag,
        tag_des_monats: tag,
      },
    ])
    if (error) {
      toast.error('Dauerauftrag konnte nicht gespeichert werden.')
      return
    }
    toast.success('Dauerauftrag gespeichert.')
    resetDauerauftragFormular()
    await ladeDauerauftraege()
    await verarbeiteDauerauftraege()
  }

  async function importiereVorgabeDauerauftraege() {
    const { data: rows } = await supabase.from('dauerauftraege').select('kategorie')
    const existing = new Set(
      (rows || []).map((r) => String(r.kategorie || '').trim().toLowerCase()),
    )
    const toInsert = VORGABE_DAUERAUFTRAeGE_MONATSANFANG.filter(
      (r) => !existing.has(r.kategorie.trim().toLowerCase()),
    )
    if (!toInsert.length) {
      toast('Alle diese Daueraufträge sind bereits hinterlegt.')
      return
    }
    const { error } = await supabase.from('dauerauftraege').insert(toInsert)
    if (error) {
      toast.error('Import fehlgeschlagen.')
      return
    }
    toast.success(`${toInsert.length} Dauerauftrag/Daueraufträge angelegt.`)
    await ladeDauerauftraege()
    await verarbeiteDauerauftraege()
  }

  async function loescheDauerauftrag(row: any) {
    const t = `${row.kategorie} (${Number(row.betrag).toFixed(2)} €)`
    if (!window.confirm(`Dauerauftrag wirklich löschen?\n\n${t}`)) return
    const { error } = await supabase.from('dauerauftraege').delete().eq('id', row.id)
    if (error) {
      toast.error('Löschen fehlgeschlagen.')
      return
    }
    toast.success('Dauerauftrag gelöscht.')
    ladeDauerauftraege()
  }

  async function speichern() {
    if (!firma.trim()) return toast.error('Firma eingeben (z. B. Arbeitgeber oder Lieferant).')
    if (!grund.trim()) return toast.error('Grund eingeben.')
    if (!betrag) return toast.error('Betrag eingeben!')
    const isoDate = toIsoDateFromDDMMYYYY(buchungDatum)
    if (!isoDate) return toast.error('Datum im Format TT/MM/JJJJ eingeben.')
    const teile = [`Grund: ${grund.trim()}`]
    if (notiz.trim()) teile.push(notiz.trim())
    const beschreibung = teile.join(' • ')
    const datum = isoDate
    const zielTabelle = typ === 'einnahme' ? 'einnahmen' : 'ausgaben'
    const { error } = await supabase.from(zielTabelle).insert([
      {
        kategorie: firma.trim(),
        betrag: parseFloat(betrag),
        beschreibung,
        datum,
      },
    ])
    if (!error) {
      toast.success('Buchung erfolgreich!')
      setFirma('')
      setGrund('')
      setBetrag('')
      setNotiz('')
      setBuchungDatum(heuteAlsTTMMJJJJ())
      ladeDaten()
    }
  }

  function istRechnungPdfOderBild(file: File) {
    const n = file.name.toLowerCase()
    if (file.type === 'application/pdf' || n.endsWith('.pdf')) return true
    if (file.type === 'image/png' || n.endsWith('.png')) return true
    if (file.type === 'image/jpeg' || n.endsWith('.jpg') || n.endsWith('.jpeg')) return true
    return false
  }

  async function handlePdfUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    event.target.value = ''

    if (!istRechnungPdfOderBild(file)) {
      toast.error('Bitte eine PDF-, PNG- oder JPEG-Datei hochladen.')
      return
    }

    setIsPdfLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/parse-invoice', {
        method: 'POST',
        body: formData,
      })

      const payload = await response.json()
      if (!response.ok || typeof payload.amount !== 'number') {
        toast.error(payload?.error || 'Beleg konnte nicht gelesen werden.')
        return
      }
      const amount = payload.amount as number
      const vendor = typeof payload.vendor === 'string' ? payload.vendor.trim() : ''
      const candidates = Array.isArray(payload.invoiceDateCandidates)
        ? (payload.invoiceDateCandidates as Array<{ iso?: string; display?: string; hint?: string }>).filter(
            (c) => c?.iso && c?.display,
          )
        : []
      const detectedDate =
        (typeof payload.invoiceDate?.display === 'string' && payload.invoiceDate.display) ||
        candidates[0]?.display ||
        ''
      setPendingInvoice({
        amount: amount.toFixed(2),
        vendor: vendor || 'Rechnung',
        fileName: file.name,
        date: detectedDate,
        dateCandidates: candidates as Array<{ iso: string; display: string; hint: string }>,
      })
    } catch (error) {
      console.error('Rechnungs-Upload fehlgeschlagen', error)
      toast.error('Beleg konnte nicht gelesen werden. Bitte andere Datei testen.')
    } finally {
      setIsPdfLoading(false)
    }
  }

  async function speicherePendingInvoice() {
    if (!pendingInvoice) return

    const parsedAmount = Number.parseFloat(pendingInvoice.amount.replace(',', '.'))
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Bitte einen gültigen Betrag eingeben.')
      return
    }
    const isoDate = toIsoDateFromDDMMYYYY(pendingInvoice.date)
    if (!isoDate) {
      toast.error('Bitte Datum im Format Tag/Monat/Jahr eingeben.')
      return
    }

    const firma = pendingInvoice.vendor.trim() || 'Rechnung'
    const fn = pendingInvoice.fileName.toLowerCase()
    const belegTag =
      fn.endsWith('.png') || fn.endsWith('.jpg') || fn.endsWith('.jpeg') ? 'Bild' : 'PDF'
    const { error } = await supabase.from('ausgaben').insert([
      {
        kategorie: firma,
        betrag: parsedAmount,
        beschreibung: `Rechnung • ${belegTag}: ${pendingInvoice.fileName}`,
        datum: isoDate,
      },
    ])

    if (error) {
      toast.error('Fehler beim Speichern der Ausgabe.')
      return
    }

    toast.success(`Rechnung gespeichert: ${firma} • -${parsedAmount.toFixed(2)} €`)
    setTyp('ausgabe')
    setPendingInvoice(null)
    setFirma('')
    setGrund('')
    setBuchungDatum(heuteAlsTTMMJJJJ())
    ladeDaten()
  }

  function starteBearbeitungBuchung(item: any) {
    if (item.__geplant) {
      const raw = String(item.id || '')
      const m = raw.match(/^__geplant__(.+)$/)
      if (!m) return
      const planId = m[1]
      const row = dauerauftraege.find((d) => String(d.id) === planId)
      if (!row) {
        toast.error('Dauerauftrag nicht gefunden.')
        return
      }
      starteBearbeitungDauerauftrag(row)
      return
    }
    setBuchungEdit({
      id: item.id,
      isIn: item.isIn,
      kategorie: String(item.kategorie ?? ''),
      betrag: Number(item.betrag).toFixed(2),
      beschreibung: String(item.beschreibung ?? ''),
      datumStr: formatDateDDMMYYYY(datumFuerListenanzeige(item)),
    })
  }

  async function speichereBuchungAenderung() {
    if (!buchungEdit) return
    const kategorie = buchungEdit.kategorie.trim()
    if (!kategorie) return toast.error('Bezeichnung eingeben.')
    const parsedBetrag = Number.parseFloat(buchungEdit.betrag.replace(',', '.'))
    if (!Number.isFinite(parsedBetrag) || parsedBetrag <= 0) return toast.error('Gültigen Betrag eingeben.')
    const isoDate = toIsoDateFromDDMMYYYY(buchungEdit.datumStr)
    if (!isoDate) return toast.error('Datum im Format Tag/Monat/Jahr (TT/MM/JJJJ).')

    const datum = isoDate

    const zielTabelle = buchungEdit.isIn ? 'einnahmen' : 'ausgaben'
    const { error } = await supabase
      .from(zielTabelle)
      .update({
        kategorie,
        betrag: parsedBetrag,
        beschreibung: buchungEdit.beschreibung.trim(),
        datum,
      })
      .eq('id', buchungEdit.id)

    if (error) {
      toast.error('Buchung konnte nicht gespeichert werden.')
      return
    }
    toast.success('Buchung aktualisiert.')
    setBuchungEdit(null)
    ladeDaten()
  }

  async function loescheBuchung(item: any) {
    if (item.__geplant) {
      const raw = String(item.id || '')
      const m = raw.match(/^__geplant__(.+)$/)
      if (!m) return
      const planId = m[1]
      const row = dauerauftraege.find((d) => String(d.id) === planId)
      const label = row
        ? `${row.kategorie} (${Number(row.betrag).toFixed(2)} €)`
        : `${item.kategorie} (${Number(item.betrag).toFixed(2)} €)`
      if (
        !window.confirm(
          `Dauerauftrag wirklich löschen?\n\n${label}\n\nDer Stammeintrag in „Daueraufträge“ wird entfernt (nicht nur die geplante Zeile in der Übersicht).`,
        )
      )
        return
      const { error } = await supabase.from('dauerauftraege').delete().eq('id', planId)
      if (error) {
        toast.error('Löschen fehlgeschlagen.')
        return
      }
      toast.success('Dauerauftrag gelöscht.')
      await ladeDauerauftraege()
      ladeDaten()
      return
    }
    const buchungstext = `${item.kategorie} (${item.betrag.toFixed(2)} €)`
    const bestaetigt = window.confirm(`Buchung wirklich löschen?\n\n${buchungstext}`)
    if (!bestaetigt) return

    const zielTabelle = item.isIn ? 'einnahmen' : 'ausgaben'
    const { error } = await supabase.from(zielTabelle).delete().eq('id', item.id)

    if (error) {
      toast.error('Löschen fehlgeschlagen.')
      return
    }

    toast.success('Buchung gelöscht.')
    ladeDaten()
  }

  function verschiebeAnsichtMonat(delta: number) {
    setAnsichtMonat((prev) => {
      const { jahr, monat } = parseIsoMonat(prev)
      const d = new Date(jahr, monat - 1 + delta, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
  }

  const gesEin = einnahmenAnsicht.reduce((a, b) => a + Number(b.betrag || 0), 0)
  const gesAus = ausgabenAnsicht.reduce((a, b) => a + Number(b.betrag || 0), 0)
  const saldo = gesEin - gesAus

  const ausgabenSummeJeMonat = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of ausgaben) {
      const k = monatSchluesselFuerZeile(r)
      if (!k) continue
      const b = Number(r.betrag)
      m[k] = (m[k] || 0) + (Number.isFinite(b) ? b : 0)
    }
    return m
  }, [ausgaben])

  const ausgabenMonatsFeedback = useMemo(
    () =>
      berechneAusgabenMonatsFeedback({
        ansichtMonat,
        summeAusgaben: gesAus,
        anzahlBuchungen: ausgabenAnsicht.length,
        summenJeMonat: ausgabenSummeJeMonat,
      }),
    [ansichtMonat, gesAus, ausgabenAnsicht.length, ausgabenSummeJeMonat],
  )

  const topfStand = useMemo(() => {
    const sum = topfMonate.reduce((a, r) => a + Number(r.saldo_monat || 0), 0)
    return Math.round(((Number(topfMeta.stand_offset) || 0) + sum) * 100) / 100
  }, [topfMeta, topfMonate])

  const topfMonatEintrag = useMemo(
    () => topfMonate.find((r) => r.monat === ansichtMonat) ?? null,
    [topfMonate, ansichtMonat],
  )

  const finanzListe = useMemo(() => buildFinanzListe(), [einnahmen, ausgaben, dauerauftraege, ansichtMonat])

  const finanzListeAngezeigt = useMemo(() => {
    let rows = [...finanzListe]
    if (finanzListenFilter === 'einnahme') rows = rows.filter((r: any) => Boolean(r.isIn))
    else if (finanzListenFilter === 'ausgabe') rows = rows.filter((r: any) => !r.isIn)

    const q = finanzListeSuche.trim().toLowerCase()
    if (q) {
      rows = rows.filter((r: any) => {
        const kat = String(r.kategorie ?? '').toLowerCase()
        const bes = String(r.beschreibung ?? '').toLowerCase()
        const dIso = datumFuerListenanzeigeMonat(r)
        const dAnz = formatDateDDMMYYYY(dIso).toLowerCase()
        const dHead = String(dIso || '').slice(0, 10).toLowerCase()
        return kat.includes(q) || bes.includes(q) || dAnz.includes(q) || dHead.includes(q)
      })
    }

    if (finanzSort.modus !== 'preset') {
      const mul = finanzSort.dir === 'asc' ? 1 : -1
      rows.sort((a: any, b: any) => {
        let c = 0
        if (finanzSort.modus === 'datum') {
          c = new Date(datumFuerListenanzeigeMonat(a)).getTime() - new Date(datumFuerListenanzeigeMonat(b)).getTime()
        } else if (finanzSort.modus === 'betrag') {
          c = Number(a.betrag) - Number(b.betrag)
        } else {
          const sa = `${String(a.kategorie ?? '')} ${String(a.beschreibung ?? '')}`
          const sb = `${String(b.kategorie ?? '')} ${String(b.beschreibung ?? '')}`
          c = sa.localeCompare(sb, 'de', { sensitivity: 'base' })
        }
        if (c !== 0) return c * mul
        return String(a.kategorie ?? '').localeCompare(String(b.kategorie ?? ''), 'de')
      })
    }

    return rows
  }, [finanzListe, finanzListenFilter, finanzListeSuche, finanzSort])

  function finanzSortKlick(modus: 'datum' | 'position' | 'betrag') {
    setFinanzSort((s) => {
      if (s.modus !== modus) {
        const defaultDir: 'asc' | 'desc' =
          modus === 'datum' ? 'desc' : modus === 'betrag' ? 'desc' : 'asc'
        return { modus, dir: defaultDir }
      }
      return { modus, dir: s.dir === 'asc' ? 'desc' : 'asc' }
    })
  }

  function finanzSortPfeil(modus: 'datum' | 'position' | 'betrag') {
    if (finanzSort.modus !== modus) return ''
    return finanzSort.dir === 'asc' ? '↑' : '↓'
  }

  const sliderIdx = monatsListeNavigation.indexOf(ansichtMonat)
  const sliderValue = sliderIdx >= 0 ? sliderIdx : Math.max(0, monatsListeNavigation.length - 1)

  return (
    <PageChrome className="max-w-full" density="compact">
      <PageHero
        eyebrow="Finanzen"
        title="Einnahmen & Ausgaben"
        description="Monatsbilanz, Buchungen, Belege und Daueraufträge im Überblick."
        density="compact"
      />

      <PageSection titleId="finanzen-monatsuebersicht" title="Monatsübersicht" density="compact">
        <PageSectionPanel density="compact">
          <div className="flex flex-col justify-between gap-3 text-center sm:flex-row sm:items-stretch sm:gap-4 lg:text-left">
        <div className="flex flex-1 flex-col justify-center lg:min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Saldo im Ansichtsmonat</p>
          <p className="mt-1 text-sm font-semibold text-slate-300 sm:text-[15px]">{formatMonatsLabelDe(ansichtMonat)}</p>
          <p
            className={`mt-1 break-words text-2xl font-bold leading-tight tracking-tight tabular-nums sm:mt-1.5 sm:text-3xl md:text-4xl ${saldo >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
          >
            {saldo.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2.5 lg:w-auto lg:max-w-md lg:shrink-0">
          <div className="flex min-w-0 shrink-0 items-stretch justify-center gap-0 overflow-hidden rounded-xl border border-zinc-700/50 bg-zinc-950/60 p-1 shadow-inner sm:rounded-2xl">
            <div className="flex min-w-0 flex-1 flex-col justify-center rounded-lg bg-zinc-900/75 px-3 py-2.5 text-left sm:rounded-xl sm:px-4 sm:py-3">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/95 sm:text-[11px]">Einnahmen</span>
              <span className="mt-0.5 text-[10px] text-slate-500 sm:text-[11px]">im Monat</span>
              <span className="mt-1 break-words text-base font-semibold leading-tight tabular-nums text-slate-100 sm:text-xl">
                +{gesEin.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
            </div>
            <div className="w-px shrink-0 self-stretch bg-zinc-700/80" />
            <div className="flex min-w-0 flex-1 flex-col justify-center rounded-lg bg-zinc-900/75 px-3 py-2.5 text-left sm:rounded-xl sm:px-4 sm:py-3">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-400/95 sm:text-[11px]">Ausgaben</span>
              <span className="mt-0.5 text-[10px] text-slate-500 sm:text-[11px]">im Monat</span>
              <span className="mt-1 break-words text-base font-semibold leading-tight tabular-nums text-slate-100 sm:text-xl">
                −{gesAus.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
            </div>
          </div>

          {ausgabenMonatsFeedback.art !== 'keins' && (
            <div
              className={
                ausgabenMonatsFeedback.art === 'lob'
                  ? 'rounded-2xl border border-emerald-700/45 bg-emerald-950/25 px-4 py-3 text-left shadow-inner'
                  : 'rounded-2xl border border-amber-700/50 bg-amber-950/25 px-4 py-3 text-left shadow-inner'
              }
              role="status"
            >
              <p
                className={
                  ausgabenMonatsFeedback.art === 'lob'
                    ? 'text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-300/95'
                    : 'text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300/95'
                }
              >
                {ausgabenMonatsFeedback.titel}
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-slate-300">{ausgabenMonatsFeedback.text}</p>
            </div>
          )}

          <div className="rounded-xl border border-violet-800/50 bg-violet-950/25 p-3 text-left shadow-inner sm:rounded-2xl sm:p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-300/90">Erarbeiteter Puffer</p>
            {topfSchemaOk === null ? (
              <p className="mt-1.5 text-sm text-slate-500">Wird geladen …</p>
            ) : topfSchemaOk === false ? (
              <p className="mt-1.5 text-[13px] leading-relaxed text-amber-200/90">
                Tabellen fehlen oder sind nicht erreichbar. In Supabase die Migrationen ausführen:{' '}
                <code className="mt-1 block rounded bg-slate-950/80 px-1.5 py-1 text-[11px] text-slate-300">
                  supabase/migrations/20260421000000_finanz_rest_topf.sql
                </code>
                <code className="mt-1 block rounded bg-slate-950/80 px-1.5 py-1 text-[11px] text-slate-300">
                  supabase/migrations/20260421110000_finanz_rest_topf_automatisch_update.sql
                </code>
                <span className="mt-2 block text-[11px] text-amber-200/75">
                  Die zweite Datei ergänzt Anpassungen (UPDATE) und die Spalte „automatisch“.
                </span>
              </p>
            ) : (
              <>
                <p
                  className={`mt-1.5 break-words text-xl font-bold tabular-nums tracking-tight sm:text-2xl ${topfStand >= 0 ? 'text-violet-200' : 'text-rose-300'}`}
                >
                  {topfStand.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </p>
                {topfMonatEintrag ? (
                  <div className="mt-1.5 space-y-1.5">
                    <div>
                      <p className="text-[12px] text-slate-500">
                        {formatMonatsLabelDe(ansichtMonat)}: verbucht{' '}
                        <span className="font-semibold text-slate-300">
                          {Number(topfMonatEintrag.saldo_monat).toLocaleString('de-DE', {
                            style: 'currency',
                            currency: 'EUR',
                          })}
                        </span>{' '}
                        · zuletzt {formatDateDDMMYYYY(topfMonatEintrag.gebucht_am)}
                      </p>
                    </div>
                    {!topfAnpassenOffen ? (
                      <button
                        type="button"
                        disabled={topfBuchungLaden}
                        onClick={() => {
                          setTopfAnpassenBetrag(
                            String(Number(topfMonatEintrag.saldo_monat).toFixed(2)).replace('.', ','),
                          )
                          setTopfAnpassenOffen(true)
                        }}
                        className="w-full rounded-xl border border-violet-500/45 bg-violet-950/35 py-2.5 text-xs font-bold text-violet-100 transition hover:bg-violet-900/45 disabled:opacity-40"
                      >
                        Verbuchten Saldo anpassen
                      </button>
                    ) : (
                      <div className="space-y-2 rounded-xl border border-slate-600/80 bg-slate-950/70 p-3">
                        <label htmlFor="erarbeiteter-puffer-anpassen" className="block text-[11px] font-semibold text-slate-400">
                          Neuer Monatssaldo im Puffer (EUR)
                        </label>
                        <input
                          id="erarbeiteter-puffer-anpassen"
                          type="text"
                          inputMode="decimal"
                          value={topfAnpassenBetrag}
                          onChange={(e) => setTopfAnpassenBetrag(e.target.value)}
                          className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-violet-500/35"
                        />
                        <div className="flex gap-2 pt-0.5">
                          <button
                            type="button"
                            disabled={topfBuchungLaden}
                            onClick={() => void speichereRestTopfSaldoAnpassung()}
                            className="flex-1 rounded-lg bg-violet-600 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-40"
                          >
                            {topfBuchungLaden ? '…' : 'Speichern'}
                          </button>
                          <button
                            type="button"
                            disabled={topfBuchungLaden}
                            onClick={() => setTopfAnpassenOffen(false)}
                            className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                          >
                            Abbrechen
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={topfBuchungLaden}
                    onClick={() => void buchRestTopfFuerAnsichtsmonat()}
                    className="mt-2 w-full rounded-xl bg-violet-600 py-2 text-sm font-bold text-white shadow-md shadow-violet-950/30 transition hover:bg-violet-500 disabled:opacity-40"
                  >
                    {topfBuchungLaden ? '…' : 'Monatssaldo in Puffer übernehmen'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
          </div>
        </PageSectionPanel>
        <PageSectionPanel density="compact">
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-400/90">Ansichtsmonat</p>
            <p className="mt-0.5 text-base font-semibold tracking-tight text-slate-100 sm:text-lg">{formatMonatsLabelDe(ansichtMonat)}</p>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:max-w-full md:shrink-0">
            <div className="flex w-full min-w-0 flex-wrap items-stretch justify-stretch gap-1 rounded-xl border border-slate-700/70 bg-slate-950/70 p-1 shadow-inner sm:inline-flex sm:w-auto sm:flex-nowrap sm:items-center sm:justify-center sm:gap-1.5">
            <button
              type="button"
              onClick={() => verschiebeAnsichtMonat(-1)}
              className="shrink-0 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 sm:px-3.5"
              aria-label="Vorheriger Monat"
            >
              ◀
            </button>
            <input
              type="month"
              value={ansichtMonat}
              onChange={(e) => {
                const v = e.target.value
                if (v) setAnsichtMonat(v)
              }}
              className="min-h-[2.75rem] min-w-0 flex-1 rounded-lg border-0 bg-transparent px-1 py-2 text-sm font-semibold text-slate-100 outline-none ring-0 sm:min-w-[9.5rem] sm:flex-none sm:px-2"
            />
            <button
              type="button"
              onClick={() => verschiebeAnsichtMonat(1)}
              className="shrink-0 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 sm:px-3.5"
              aria-label="Nächster Monat"
            >
              ▶
            </button>
            <button
              type="button"
              onClick={() => setAnsichtMonat(aktuellesIsoMonat())}
              className="w-full rounded-lg bg-emerald-600/90 px-3 py-2.5 text-xs font-bold text-white shadow-sm shadow-emerald-950/30 transition hover:bg-emerald-500 sm:w-auto sm:px-4"
            >
              Heute
            </button>
          </div>
          </div>
        </div>
        <div className="mt-2 rounded-xl border border-slate-800/90 bg-slate-950/40 px-3 py-2.5 sm:px-4 sm:py-3">
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Schnellwahl über alle Monate mit Buchungen
          </label>
          <input
            type="range"
            min={0}
            max={Math.max(0, monatsListeNavigation.length - 1)}
            value={sliderValue}
            onChange={(e) => {
              const i = Number(e.target.value)
              const yyyymm = monatsListeNavigation[i]
              if (yyyymm) setAnsichtMonat(yyyymm)
            }}
            className="h-2.5 w-full cursor-pointer accent-sky-500"
          />
          <div className="mt-2 flex justify-between text-[11px] font-medium text-slate-500">
            <span>{formatMonatsLabelDe(monatsListeNavigation[0] || ansichtMonat)}</span>
            <span>{formatMonatsLabelDe(monatsListeNavigation[monatsListeNavigation.length - 1] || ansichtMonat)}</span>
          </div>
        </div>
      </div>
        </PageSectionPanel>
      </PageSection>

      <PageSection titleId="finanzen-buchungen-heading" title="Buchungen" density="compact">
        <PageSectionPanel density="compact">
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,17.5rem)_1fr] xl:grid-cols-[minmax(0,19rem)_1fr] lg:gap-5">
        <div className="h-fit min-w-0 overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900 to-slate-950 p-4 shadow-xl shadow-black/35 sm:p-5">
          <h2 className="mb-4 text-base font-semibold tracking-tight text-slate-100">Neue Buchung</h2>
          <div className="mb-4 flex rounded-xl border border-slate-700/70 bg-slate-950/70 p-1 shadow-inner">
            <button
              type="button"
              onClick={() => setTyp('einnahme')}
              className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all sm:text-sm ${typ === 'einnahme' ? 'bg-emerald-600/90 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Einnahme
            </button>
            <button
              type="button"
              onClick={() => setTyp('ausgabe')}
              className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all sm:text-sm ${typ === 'ausgabe' ? 'bg-rose-600/90 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Ausgabe
            </button>
          </div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Firma</label>
          <input
            type="text"
            placeholder={typ === 'einnahme' ? 'z. B. Arbeitgeber' : 'z. B. Supermarkt, Anbieter'}
            className="mb-3 w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-3 py-2.5 text-sm text-slate-100 shadow-inner outline-none ring-emerald-500/0 transition focus:border-emerald-600/50 focus:ring-2 focus:ring-emerald-500/25 sm:px-4 sm:text-[15px]"
            value={firma}
            onChange={(e) => setFirma(e.target.value)}
          />
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Grund</label>
          <input
            type="text"
            placeholder="z. B. Gehalt März, Lebensmittel, Tanken"
            className="mb-3 w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-3 py-2.5 text-sm text-slate-100 shadow-inner outline-none focus:border-emerald-600/50 focus:ring-2 focus:ring-emerald-500/25 sm:px-4 sm:text-[15px]"
            value={grund}
            onChange={(e) => setGrund(e.target.value)}
          />
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Datum (TT/MM/JJJJ)</label>
          <input
            type="text"
            placeholder="TT/MM/JJJJ"
            className="mb-3 w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-600/50 focus:ring-2 focus:ring-emerald-500/25 sm:px-4 sm:text-[15px]"
            value={buchungDatum}
            onChange={(e) => setBuchungDatum(e.target.value)}
          />
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Betrag</label>
          <input
            type="number"
            placeholder="0,00"
            className="mb-3 w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-3 py-3 text-xl font-semibold tabular-nums text-slate-100 outline-none focus:border-emerald-600/50 focus:ring-2 focus:ring-emerald-500/25 sm:px-4 sm:text-2xl"
            value={betrag}
            onChange={(e) => setBetrag(e.target.value)}
          />
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Notiz (optional)</label>
          <input
            type="text"
            placeholder="Zusatz-Notiz …"
            className="mb-4 w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-600/50 focus:ring-2 focus:ring-emerald-500/25 sm:px-4 sm:text-[15px]"
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
          />
          <button
            type="button"
            onClick={speichern}
            className={`w-full rounded-xl py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 active:scale-[0.99] sm:py-3.5 sm:text-base ${typ === 'einnahme' ? 'bg-emerald-600 shadow-emerald-950/40' : 'bg-rose-600 shadow-rose-950/40'}`}
          >
            {typ === 'einnahme' ? 'Geld empfangen' : 'Ausgabe buchen'}
          </button>

          <div className="mt-5">
            <label
              htmlFor="pdf-upload"
              className={`flex w-full cursor-pointer items-center justify-center rounded-xl border-2 border-dashed py-3 text-xs font-semibold transition-colors sm:py-3.5 sm:text-sm ${isPdfLoading ? 'cursor-not-allowed border-slate-700 text-slate-600' : 'border-rose-700/55 text-rose-200/95 hover:bg-rose-950/25'}`}
            >
              {isPdfLoading ? 'Beleg wird gelesen…' : 'Rechnung als PDF oder Bild hochladen'}
            </label>
            <input
              id="pdf-upload"
              type="file"
              accept="application/pdf,.pdf,image/png,.png,image/jpeg,.jpg,.jpeg"
              className="hidden"
              onChange={handlePdfUpload}
              disabled={isPdfLoading}
            />
          </div>

          {pendingInvoice && (
            <div className="mt-5 space-y-3 rounded-xl border border-slate-800/90 bg-slate-950/50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Beleg-Erkennung prüfen</p>
              <input
                type="text"
                value={pendingInvoice.vendor}
                onChange={(e) => setPendingInvoice((prev) => (prev ? { ...prev, vendor: e.target.value } : prev))}
                className="w-full rounded-xl border border-slate-700/90 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-rose-500/30"
                placeholder="Unternehmensname"
              />
              <input
                type="text"
                value={pendingInvoice.amount}
                onChange={(e) => setPendingInvoice((prev) => (prev ? { ...prev, amount: e.target.value } : prev))}
                className="w-full rounded-xl border border-slate-700/90 bg-slate-950 px-3 py-2.5 text-sm tabular-nums text-slate-100 outline-none focus:ring-2 focus:ring-rose-500/30"
                placeholder="Betrag"
              />
              {pendingInvoice.dateCandidates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-slate-500">Rechnungsdatum (Hover = Hinweis)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pendingInvoice.dateCandidates.map((c) => (
                      <button
                        key={`${c.iso}-${c.hint}`}
                        type="button"
                        title={c.hint}
                        onClick={() => setPendingInvoice((prev) => (prev ? { ...prev, date: c.display } : prev))}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                          pendingInvoice.date === c.display
                            ? 'border-rose-500 bg-rose-500/20 text-rose-100'
                            : 'border-slate-600/80 bg-slate-900/80 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {c.display}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <input
                type="text"
                value={pendingInvoice.date}
                onChange={(e) => setPendingInvoice((prev) => (prev ? { ...prev, date: e.target.value } : prev))}
                className="w-full rounded-xl border border-slate-700/90 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-rose-500/30"
                placeholder="Tag/Monat/Jahr"
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={speicherePendingInvoice}
                  className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-bold text-white shadow-md shadow-rose-950/30 transition hover:bg-rose-500"
                >
                  Als Ausgabe speichern
                </button>
                <button
                  type="button"
                  onClick={() => setPendingInvoice(null)}
                  className="rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Verwerfen
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0 max-lg:overflow-x-hidden overflow-y-visible lg:overflow-x-auto rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900 to-slate-950 shadow-xl shadow-black/35">
          <div className="border-b border-slate-800/80 bg-slate-900/90 p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="finanz-liste-suche"
                    className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-[11px]"
                  >
                    Buchungen durchsuchen
                  </label>
                  <input
                    id="finanz-liste-suche"
                    type="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    placeholder="Bezeichnung, Notiz oder Datum …"
                    value={finanzListeSuche}
                    onChange={(e) => setFinanzListeSuche(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-600/50 focus:ring-2 focus:ring-sky-500/25 sm:mt-2 sm:px-4 sm:py-3 sm:text-[15px]"
                  />
                </div>
                {finanzSort.modus !== 'preset' && (
                  <button
                    type="button"
                    onClick={() => setFinanzSort({ modus: 'preset', dir: 'desc' })}
                    className="shrink-0 rounded-xl border border-slate-600/90 bg-slate-950/80 px-3 py-2 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-800 sm:px-4 sm:py-2.5 sm:text-xs"
                  >
                    Standardsortierung
                  </button>
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500 sm:text-[10px]">
                  Liste
                </span>
                <div className="grid min-w-0 w-full max-w-full grid-cols-3 overflow-hidden rounded-lg border border-slate-700/80 bg-slate-950/80 p-0.5 shadow-inner lg:inline-flex lg:w-auto lg:max-w-none lg:flex-none lg:shrink-0 lg:justify-start">
                  <button
                    type="button"
                    onClick={() => setFinanzListenFilter('alle')}
                    className={`min-w-0 px-1.5 py-2 text-[9px] font-bold uppercase leading-tight tracking-wide transition lg:px-3 lg:text-[11px] ${
                      finanzListenFilter === 'alle' ? 'rounded-md bg-slate-600 text-white' : 'rounded-md text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                    }`}
                  >
                    Alle
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinanzListenFilter('einnahme')}
                    className={`min-w-0 px-1.5 py-2 text-[9px] font-bold uppercase leading-tight tracking-wide transition lg:px-3 lg:text-[11px] ${
                      finanzListenFilter === 'einnahme' ? 'rounded-md bg-emerald-600 text-white' : 'rounded-md text-emerald-400/90 hover:bg-emerald-950/50'
                    }`}
                  >
                    <span className="lg:hidden">Einnahm.</span>
                    <span className="hidden lg:inline">Einnahmen</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinanzListenFilter('ausgabe')}
                    className={`min-w-0 px-1.5 py-2 text-[9px] font-bold uppercase leading-tight tracking-wide transition lg:px-3 lg:text-[11px] ${
                      finanzListenFilter === 'ausgabe' ? 'rounded-md bg-rose-600 text-white' : 'rounded-md text-rose-400/90 hover:bg-rose-950/50'
                    }`}
                  >
                    <span className="lg:hidden">Ausgab.</span>
                    <span className="hidden lg:inline">Ausgaben</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="min-w-0 px-1 pb-1 sm:px-2 sm:pb-2">
            {/*
              < lg: Karten (kein 4-Spalten-Grid; greift zuverlässig auf dem Handy, auch bei „Desktop-Website“/Zoom).
              Ab lg: gemeinsames Grid, damit 1fr und Betrags-Spalte bündig sind.
            */}
            {finanzListeAngezeigt.length > 0 ? (
              <>
                <ul className="lg:hidden" aria-label="Buchungen im Ansichtsmonat (kompakt)">
                  <li className="list-none border-b border-slate-800/60 px-0.5 pb-2.5">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Sortierung</p>
                    <div className="mt-1.5 grid w-full min-w-0 grid-cols-3 gap-1.5">
                      {(
                        [
                          ['datum', 'Datum'] as const,
                          ['position', 'Titel'] as const,
                          ['betrag', 'Betrag'] as const,
                        ] as const
                      ).map(([modus, label]) => (
                        <button
                          key={modus}
                          type="button"
                          onClick={() => finanzSortKlick(modus)}
                          className={`min-w-0 rounded-lg border px-1 py-1.5 text-center text-[9px] font-semibold leading-tight transition ${
                            finanzSort.modus === modus
                              ? 'border-sky-500/60 bg-sky-500/10 text-sky-200'
                              : 'border-slate-700/80 bg-slate-950/80 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                          }`}
                        >
                          {label}
                          <span className="ml-0.5 font-mono text-sky-400/90" aria-hidden>
                            {finanzSortPfeil(modus) || '\u00a0'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </li>
                  {finanzListeAngezeigt.map((item: any, i: number) => (
                    <li
                      key={item.id ?? i}
                      className={`list-none border-b border-slate-800/50 py-3 last:pb-1 ${item.__geplant ? 'bg-amber-950/12' : ''}`}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <p className="shrink-0 text-[12px] font-medium tabular-nums text-slate-300">
                          {formatDateDDMMYYYY(datumFuerListenanzeige(item))}
                        </p>
                        <p
                          className={`min-w-0 break-words text-right text-[14px] font-bold leading-tight tabular-nums ${
                            item.isIn ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {item.isIn ? '+' : '−'}
                          {Number(item.betrag).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {'\u00a0'}€
                        </p>
                      </div>
                      <div className="mt-2 flex min-w-0 items-start gap-2">
                        <KategorieMark
                          kategorie={String(item.kategorie ?? '')}
                          isEinnahme={Boolean(item.isIn)}
                          geplant={Boolean(item.__geplant)}
                          groesse="sm"
                          className="mt-0.5 shrink-0"
                        />
                        <div className="min-w-0 hyphens-none">
                          <p className="break-words text-[14px] font-semibold leading-snug text-slate-100">
                            {item.kategorie}
                          </p>
                          {item.beschreibung ? (
                            <p className="mt-0.5 line-clamp-2 break-words text-[11px] leading-relaxed text-slate-500">
                              {item.beschreibung}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 grid min-w-0 grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => starteBearbeitungBuchung(item)}
                          className="rounded-lg border border-slate-600/80 bg-slate-950/90 py-2.5 text-center text-xs font-semibold text-sky-200 transition hover:border-sky-500/50 hover:bg-sky-500/10"
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => loescheBuchung(item)}
                          className="rounded-lg border border-slate-600/80 bg-slate-950/90 py-2.5 text-center text-xs font-semibold text-rose-200 transition hover:border-rose-500/50 hover:bg-rose-500/10"
                        >
                          Löschen
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                <div
                  className="hidden w-full min-w-0 lg:grid grid-cols-[minmax(0,5.75rem)_minmax(0,1fr)_8.25rem_auto] items-start gap-x-3 bg-slate-900/95 px-3 py-0 text-[11px] font-semibold uppercase leading-tight tracking-wide text-slate-500 md:grid-cols-[minmax(0,6.25rem)_minmax(0,1fr)_9rem_auto] md:gap-x-4 md:px-5"
                  role="table"
                  aria-label="Buchungen im Ansichtsmonat"
                >
                  <div className="min-w-0 border-b border-slate-800/90 py-3" role="columnheader">
                    <button
                      type="button"
                      onClick={() => finanzSortKlick('datum')}
                      className="inline-flex max-w-full items-center gap-1 rounded-lg px-1 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 transition hover:bg-slate-800/80 hover:text-slate-200"
                    >
                      Datum
                      <span className="shrink-0 font-mono text-[10px] text-sky-400/90" aria-hidden>
                        {finanzSortPfeil('datum')}
                      </span>
                    </button>
                  </div>
                  <div className="min-w-0 border-b border-slate-800/90 py-3" role="columnheader">
                    <button
                      type="button"
                      onClick={() => finanzSortKlick('position')}
                      className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-lg px-1 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 transition hover:bg-slate-800/80 hover:text-slate-200"
                    >
                      Position
                      <span className="shrink-0 font-mono text-[10px] text-sky-400/90" aria-hidden>
                        {finanzSortPfeil('position')}
                      </span>
                    </button>
                  </div>
                  <div className="min-w-0 border-b border-slate-800/90 py-3 text-right tabular-nums" role="columnheader">
                    <button
                      type="button"
                      onClick={() => finanzSortKlick('betrag')}
                      className="inline-flex w-full min-w-0 items-center justify-end gap-1 rounded-lg px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 transition hover:bg-slate-800/80 hover:text-slate-200"
                    >
                      Betrag
                      <span className="shrink-0 font-mono text-[10px] text-sky-400/90" aria-hidden>
                        {finanzSortPfeil('betrag')}
                      </span>
                    </button>
                  </div>
                  <div className="shrink-0 border-b border-slate-800/90 py-3 pr-3 text-right text-[11px]" role="columnheader">
                    Aktion
                  </div>

                  {finanzListeAngezeigt.map((item: any, i: number) => (
                    <Fragment key={item.id ?? i}>
                      <div
                        className={`min-w-0 py-4 tabular-nums text-[13px] text-slate-300 ${i === 0 ? 'border-t-0' : 'border-t border-slate-800/60'} ${item.__geplant ? 'bg-amber-950/15' : ''} hover:bg-slate-800/25`}
                      >
                        {formatDateDDMMYYYY(datumFuerListenanzeige(item))}
                      </div>
                      <div
                        className={`min-w-0 py-4 ${i === 0 ? 'border-t-0' : 'border-t border-slate-800/60'} ${item.__geplant ? 'bg-amber-950/15' : ''} hover:bg-slate-800/25`}
                      >
                        <div className="flex min-w-0 items-start gap-2.5">
                          <KategorieMark
                            kategorie={String(item.kategorie ?? '')}
                            isEinnahme={Boolean(item.isIn)}
                            geplant={Boolean(item.__geplant)}
                            groesse="sm"
                            className="mt-0.5 shrink-0"
                          />
                          <div className="min-w-0 hyphens-none">
                            <p className="break-words text-[15px] font-semibold leading-snug text-slate-100">
                              {item.kategorie}
                            </p>
                            {item.beschreibung ? (
                              <p className="mt-1 line-clamp-2 break-words text-[12px] leading-relaxed text-slate-500">
                                {item.beschreibung}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`min-w-0 whitespace-nowrap py-4 text-right text-[15px] font-semibold tabular-nums ${i === 0 ? 'border-t-0' : 'border-t border-slate-800/60'} ${item.__geplant ? 'bg-amber-950/15' : ''} hover:bg-slate-800/25 ${item.isIn ? 'text-emerald-400' : 'text-rose-400'}`}
                      >
                        {item.isIn ? '+' : '−'}
                        {Number(item.betrag).toLocaleString('de-DE', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        {'\u00a0'}€
                      </div>
                      <div
                        className={`flex shrink-0 items-center justify-end gap-1.5 py-4 pr-3 ${i === 0 ? 'border-t-0' : 'border-t border-slate-800/60'} ${item.__geplant ? 'bg-amber-950/15' : ''} hover:bg-slate-800/25`}
                      >
                        <button
                          type="button"
                          onClick={() => starteBearbeitungBuchung(item)}
                          className="rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/15"
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => loescheBuchung(item)}
                          className="rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-xs font-semibold text-rose-300/95 transition hover:bg-rose-500/15"
                        >
                          Löschen
                        </button>
                      </div>
                    </Fragment>
                  ))}
                </div>
              </>
            ) : null}
          </div>
          {finanzListe.length === 0 && (
            <div className="border-t border-slate-800/60 px-6 py-20 text-center text-sm italic text-slate-600">Hier ist noch alles ruhig…</div>
          )}
          {finanzListe.length > 0 && finanzListeAngezeigt.length === 0 && (
            <div className="border-t border-slate-800/60 px-6 py-14 text-center text-sm text-slate-500">
              Keine Buchungen passen zu Suche oder Filter in diesem Monat.
            </div>
          )}
        </div>
      </div>
        </PageSectionPanel>
      </PageSection>

      <PageSection titleId="finanzen-dauerauftraege-heading" title="Daueraufträge" density="compact">
        <PageSectionPanel density="compact">
      <div className="overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900 to-slate-950 p-4 shadow-xl shadow-black/35 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={async () => {
              await verarbeiteDauerauftraege()
            }}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-950/30 transition hover:bg-emerald-500"
          >
            Abbuchungen jetzt ausführen
          </button>
          <button
            type="button"
            onClick={async () => {
              if (
                !window.confirm(
                  'Standard-Daueraufträge importieren?\n\nEs werden nur Einträge angelegt, deren Bezeichnung noch nicht existiert (keine Dubletten).',
                )
              )
                return
              await importiereVorgabeDauerauftraege()
            }}
            className="rounded-xl border border-slate-600/90 bg-slate-950/60 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            Standard importieren
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div id="dauerauftrag-neu" className="min-w-0 space-y-3 rounded-xl border border-slate-800/90 bg-slate-950/45 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {daEditId != null ? 'Dauerauftrag bearbeiten' : 'Neuer Dauerauftrag'}
            </p>
            <div className="flex rounded-xl border border-slate-700/70 bg-slate-900/80 p-1 shadow-inner">
              <button
                type="button"
                onClick={() => setDaTyp('ausgabe')}
                className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all ${daTyp === 'ausgabe' ? 'bg-rose-600/90 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Ausgabe
              </button>
              <button
                type="button"
                onClick={() => setDaTyp('einnahme')}
                className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all ${daTyp === 'einnahme' ? 'bg-emerald-600/90 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Einnahme
              </button>
            </div>
            <input
              type="text"
              placeholder="Bezeichnung (z. B. Haftpflicht, Netflix, Bausparer)"
              className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30"
              value={daKategorie}
              onChange={(e) => setDaKategorie(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Betrag"
                className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-3 py-2.5 text-sm tabular-nums text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30"
                value={daBetrag}
                onChange={(e) => setDaBetrag(e.target.value)}
              />
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Tag im Monat</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-3 py-2.5 text-sm tabular-nums text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30"
                  value={daTag}
                  onChange={(e) => setDaTag(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-1 sm:flex-row">
              {daEditId != null && (
                <button
                  type="button"
                  onClick={resetDauerauftragFormular}
                  className="flex-1 rounded-xl border border-slate-600/90 bg-slate-900 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 sm:w-auto"
                >
                  Abbrechen
                </button>
              )}
              <button
                type="button"
                onClick={speichereDauerauftrag}
                className="flex-[2] rounded-xl bg-sky-600 py-2.5 text-sm font-bold text-white shadow-md shadow-sky-950/25 transition hover:bg-sky-500"
              >
                {daEditId != null ? 'Änderungen speichern' : 'Dauerauftrag speichern'}
              </button>
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800/90 bg-slate-950/35">
            {dauerauftraege.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-600 italic">
                Noch keine Daueraufträge — z. B. Bausparer oder Versicherung anlegen.
              </div>
            ) : (
              <ul>
                {dauerauftraege.map((d) => {
                  const istEin = String(d.typ).toLowerCase().trim() === 'einnahme'
                  return (
                    <li
                      key={d.id}
                      className="flex flex-col gap-3 border-b border-slate-800/60 p-4 transition-colors last:border-0 hover:bg-slate-800/20 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5"
                    >
                      <div className="flex min-w-0 flex-1 gap-3">
                        <KategorieMark kategorie={String(d.kategorie)} isEinnahme={istEin} groesse="sm" className="shrink-0" />
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="break-words text-[15px] font-semibold leading-snug text-slate-100">{d.kategorie}</p>
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] text-slate-500">
                            <span className={istEin ? 'font-medium text-emerald-400/95' : 'font-medium text-rose-400/95'}>
                              {istEin ? 'Einnahme' : 'Ausgabe'}
                            </span>
                            <span className="tabular-nums text-[13px] font-medium text-slate-200">
                              {Number(d.betrag).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                            </span>
                            <span>Tag {d.tag_des_monats}</span>
                            <span title="Zuletzt ausgeführt">
                              Zuletzt: {d.letzte_ausfuehrung ? formatDateDDMMYYYY(d.letzte_ausfuehrung) : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="inline-flex w-full shrink-0 gap-1 rounded-xl border border-slate-700/70 bg-slate-950/70 p-1 shadow-inner sm:w-auto sm:justify-end">
                        <button
                          type="button"
                          onClick={() => starteBearbeitungDauerauftrag(d)}
                          className="min-h-10 flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/15 sm:min-h-0 sm:flex-none"
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => loescheDauerauftrag(d)}
                          className="min-h-10 flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-rose-300/95 transition hover:bg-rose-500/15 sm:min-h-0 sm:flex-none"
                        >
                          Löschen
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
        </PageSectionPanel>
      </PageSection>

      {buchungEdit && (
        <div
          className={appModalBackdropClassName}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBuchungEdit(null)
          }}
        >
          <div
            className={`${appModalPanelClassName} space-y-5 p-6`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="buchung-edit-title"
          >
            <div>
              <h3 id="buchung-edit-title" className="text-lg font-semibold tracking-tight text-slate-100">
                Buchung bearbeiten
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                {buchungEdit.isIn ? 'Einnahme' : 'Ausgabe'} — der Typ lässt sich hier nicht wechseln; dazu Eintrag löschen
                und neu anlegen.
              </p>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={buchungEdit.kategorie}
                onChange={(e) => setBuchungEdit((p) => (p ? { ...p, kategorie: e.target.value } : p))}
                className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30"
                placeholder="Bezeichnung / Kategorie"
              />
              <input
                type="text"
                inputMode="decimal"
                value={buchungEdit.betrag}
                onChange={(e) => setBuchungEdit((p) => (p ? { ...p, betrag: e.target.value } : p))}
                className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-3 py-2.5 text-sm tabular-nums text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30"
                placeholder="Betrag"
              />
              <input
                type="text"
                value={buchungEdit.beschreibung}
                onChange={(e) => setBuchungEdit((p) => (p ? { ...p, beschreibung: e.target.value } : p))}
                className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30"
                placeholder="Notiz / Beschreibung"
              />
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Datum (TT/MM/JJJJ)
                  {istPdfRechnungsImport({ beschreibung: buchungEdit.beschreibung }) ? (
                    <span className="normal-case font-normal text-rose-300/90"> — Rechnung: echtes Datum</span>
                  ) : (
                    <span className="normal-case font-normal text-slate-400"> — manuelle Buchung: echtes Datum</span>
                  )}
                </label>
                <input
                  type="text"
                  value={buchungEdit.datumStr}
                  onChange={(e) => setBuchungEdit((p) => (p ? { ...p, datumStr: e.target.value } : p))}
                  className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30"
                  placeholder="TT/MM/JJJJ"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setBuchungEdit(null)}
                className="flex-1 rounded-xl border border-slate-600/90 bg-slate-950 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={speichereBuchungAenderung}
                className="flex-1 rounded-xl bg-sky-600 py-3 text-sm font-bold text-white shadow-md shadow-sky-950/30 transition hover:bg-sky-500"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </PageChrome>
  )
}