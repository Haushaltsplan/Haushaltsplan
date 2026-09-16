import {
  BOERSEN_MONAT_KURZ,
  BOERSEN_MONAT_LABELS,
  type BoersenSaisonMonat,
  type BoersenWahlFenster,
  type BoersenWahlJahrStats,
  type BoersenWahlPhase,
  type BoersenWahlZyklus,
} from '@/lib/portfolio-analyse/boersen-saison-types'

export type KursPunkt = { datum: string; kurs: number }

export type MonatRendite = {
  ym: string
  jahr: number
  monat: number
  retPct: number
}

const PHASE_META: Record<
  BoersenWahlPhase,
  { jahrImZyklus: 1 | 2 | 3 | 4; label: string; kurz: string; hinweis: string }
> = {
  nachwahl: {
    jahrImZyklus: 1,
    label: 'Nachwahljahr',
    kurz: 'Jahr 1',
    hinweis: 'Amtseinführung, oft ohne klaren Kalender-Bonus.',
  },
  midterm: {
    jahrImZyklus: 2,
    label: 'Midterm-Jahr',
    kurz: 'Jahr 2',
    hinweis: 'Historisch oft das schwächste Jahr; Druck häufig bis in den Herbst.',
  },
  vorwahl: {
    jahrImZyklus: 3,
    label: 'Vorwahljahr',
    kurz: 'Jahr 3',
    hinweis: 'Historisch häufig das stärkste der vier Jahre im Zyklus.',
  },
  wahljahr: {
    jahrImZyklus: 4,
    label: 'Wahljahr',
    kurz: 'Jahr 4',
    hinweis: 'Wahljahre enden oft positiv, besonders nach dem Wahltag.',
  },
}

const PHASE_ORDER: BoersenWahlPhase[] = ['nachwahl', 'midterm', 'vorwahl', 'wahljahr']

export function usWahlPhase(jahr: number): BoersenWahlPhase {
  const r = ((jahr % 4) + 4) % 4
  if (r === 0) return 'wahljahr'
  if (r === 1) return 'nachwahl'
  if (r === 2) return 'midterm'
  return 'vorwahl'
}

function median(werte: number[]): number {
  const s = [...werte].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  if (s.length === 0) return 0
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function compoundPct(werte: number[]): number | null {
  if (werte.length === 0) return null
  const produkt = werte.reduce((p, r) => p * (1 + r / 100), 1)
  if (!Number.isFinite(produkt) || produkt <= 0) return null
  return (produkt - 1) * 100
}

function fensterAus(werte: number[], label: string): BoersenWahlFenster {
  const n = werte.length
  const avg = n ? werte.reduce((s, x) => s + x, 0) / n : 0
  const pos = werte.filter((x) => x > 0).length
  return {
    label,
    durchschnittPct: n ? round2(avg) : 0,
    trefferquotePct: n ? round1((pos / n) * 100) : 0,
    anzahl: n,
  }
}

export function renditenAusPreisen(punkte: KursPunkt[]): MonatRendite[] {
  const sortiert = [...punkte].sort((a, b) => a.datum.localeCompare(b.datum))
  const out: MonatRendite[] = []
  for (let i = 1; i < sortiert.length; i++) {
    const prev = sortiert[i - 1]!
    const cur = sortiert[i]!
    if (prev.kurs <= 0) continue
    const retPct = (cur.kurs / prev.kurs - 1) * 100
    if (!Number.isFinite(retPct)) continue
    const jahr = Number(cur.datum.slice(0, 4))
    const monat = Number(cur.datum.slice(5, 7))
    if (!Number.isFinite(jahr) || monat < 1 || monat > 12) continue
    out.push({ ym: cur.datum.slice(0, 7), jahr, monat, retPct })
  }
  return out
}

/** Primärserie behalten; Lücken aus Fallbacks füllen (keine Mixed-Returns an der Naht). */
export function fuellePreisLoecher(primaer: KursPunkt[], ...fallbacks: KursPunkt[][]): KursPunkt[] {
  const map = new Map<string, KursPunkt>()
  for (const p of primaer) map.set(p.datum.slice(0, 7), p)
  for (const fb of fallbacks) {
    for (const p of fb) {
      const ym = p.datum.slice(0, 7)
      if (!map.has(ym)) map.set(ym, p)
    }
  }
  return [...map.values()].sort((a, b) => a.datum.localeCompare(b.datum))
}

export function saisonAusRenditen(rets: MonatRendite[]): {
  monate: BoersenSaisonMonat[]
  vonJahr: number | null
  bisJahr: number | null
} {
  const buckets: number[][] = Array.from({ length: 12 }, () => [])
  for (const r of rets) buckets[r.monat - 1]!.push(r.retPct)

  const monate: BoersenSaisonMonat[] = buckets.map((werte, i) => {
    const n = werte.length
    const avg = n ? werte.reduce((s, x) => s + x, 0) / n : 0
    const pos = werte.filter((x) => x > 0).length
    return {
      monat: i + 1,
      label: BOERSEN_MONAT_LABELS[i]!,
      kurz: BOERSEN_MONAT_KURZ[i]!,
      durchschnittPct: n ? round2(avg) : 0,
      medianPct: n ? round2(median(werte)) : 0,
      trefferquotePct: n ? round1((pos / n) * 100) : 0,
      anzahl: n,
      minPct: n ? round2(Math.min(...werte)) : 0,
      maxPct: n ? round2(Math.max(...werte)) : 0,
    }
  })

  const jahre = rets.map((r) => r.jahr)
  return {
    monate,
    vonJahr: jahre.length ? Math.min(...jahre) : null,
    bisJahr: jahre.length ? Math.max(...jahre) : null,
  }
}

export function wahlZyklusAusRenditen(rets: MonatRendite[]): BoersenWahlZyklus | null {
  if (rets.length < 24) return null

  const byJahr = new Map<number, Map<number, number>>()
  for (const r of rets) {
    let monate = byJahr.get(r.jahr)
    if (!monate) {
      monate = new Map()
      byJahr.set(r.jahr, monate)
    }
    monate.set(r.monat, r.retPct)
  }

  const jahreswerte: Record<BoersenWahlPhase, number[]> = {
    nachwahl: [],
    midterm: [],
    vorwahl: [],
    wahljahr: [],
  }
  const midtermVorher: number[] = []
  const midtermDanach: number[] = []
  const wahljahrVorher: number[] = []
  const wahljahrDanach: number[] = []

  for (const [jahr, monate] of byJahr) {
    const phase = usWahlPhase(jahr)
    const alle12 = Array.from({ length: 12 }, (_, i) => monate.get(i + 1)).every((v) => v != null)
    if (alle12) {
      const komp = compoundPct(Array.from({ length: 12 }, (_, i) => monate.get(i + 1)!))
      if (komp != null) jahreswerte[phase].push(komp)
    }

    const janOkt = Array.from({ length: 10 }, (_, i) => monate.get(i + 1))
    const novDez = [monate.get(11), monate.get(12)]
    const pre = janOkt.every((v) => v != null) ? compoundPct(janOkt as number[]) : null
    const post = novDez.every((v) => v != null) ? compoundPct(novDez as number[]) : null

    if (phase === 'midterm') {
      if (pre != null) midtermVorher.push(pre)
      if (post != null) midtermDanach.push(post)
    }
    if (phase === 'wahljahr') {
      if (pre != null) wahljahrVorher.push(pre)
      if (post != null) wahljahrDanach.push(post)
    }
  }

  const phasen: BoersenWahlJahrStats[] = PHASE_ORDER.map((phase) => {
    const werte = jahreswerte[phase]
    const n = werte.length
    const avg = n ? werte.reduce((s, x) => s + x, 0) / n : 0
    const pos = werte.filter((x) => x > 0).length
    const meta = PHASE_META[phase]
    return {
      phase,
      jahrImZyklus: meta.jahrImZyklus,
      label: meta.label,
      kurz: meta.kurz,
      hinweis: meta.hinweis,
      durchschnittJahrPct: n ? round2(avg) : 0,
      medianJahrPct: n ? round2(median(werte)) : 0,
      trefferquotePct: n ? round1((pos / n) * 100) : 0,
      anzahl: n,
    }
  })

  if (phasen.every((p) => p.anzahl === 0)) return null

  return {
    phasen,
    midtermVorher: fensterAus(midtermVorher, 'Midterm Jan–Okt'),
    midtermDanach: fensterAus(midtermDanach, 'Midterm Nov–Dez'),
    wahljahrVorher: fensterAus(wahljahrVorher, 'Wahljahr Jan–Okt'),
    wahljahrDanach: fensterAus(wahljahrDanach, 'Wahljahr Nov–Dez'),
  }
}
