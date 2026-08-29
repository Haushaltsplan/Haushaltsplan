import {
  istFundamentalQuartalSchaetzungIso,
  type FundamentalEinheit,
  type FundamentalFrequenz,
  type FundamentalMetrikZeile,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

export function formatFundamentalPeriodeLabel(iso: string, frequenz?: FundamentalFrequenz): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  if (frequenz === 'quartal') {
    const month = Number(m[2])
    const q = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4
    return `Q${q} ${m[1].slice(2)}`
  }
  return `${m[3]}.${m[2]}.${m[1].slice(2)}`
}

export function formatFundamentalWert(
  wert: number | null | undefined,
  einheit: FundamentalEinheit,
  opts?: { nm?: boolean },
): string {
  if (opts?.nm) return 'NM'
  if (wert == null || !Number.isFinite(wert)) return '–'
  switch (einheit) {
    case 'prozent':
      return `${wert.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} %`
    case 'multiple':
      return `${wert.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`
    case 'ratio':
      return wert.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    case 'waehrung_usd_mio': {
      const usd = wert * 1_000_000
      // DE: Bio. = 10¹² (Trillion), Mrd. = 10⁹ (Billion) — nicht vertauschen.
      if (Math.abs(usd) >= 1e12) {
        return `${(usd / 1e12).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Bio. $`
      }
      if (Math.abs(usd) >= 1e9) {
        return `${(usd / 1e9).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mrd. $`
      }
      if (Math.abs(usd) >= 1e6) {
        return `${(usd / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mio. $`
      }
      return `${usd.toLocaleString('de-DE', { maximumFractionDigits: 0 })} $`
    }
    case 'waehrung_usd_aktie':
      return `${wert.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`
    case 'aktien_mio':
      return `${wert.toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mio.`
    case 'waehrung_usd':
      if (Math.abs(wert) >= 1e12) {
        return `${(wert / 1e12).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Bio. $`
      }
      if (Math.abs(wert) >= 1e9) {
        return `${(wert / 1e9).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mrd. $`
      }
      if (Math.abs(wert) >= 1e6) {
        return `${(wert / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mio. $`
      }
      return `${wert.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`
    default:
      return wert.toLocaleString('de-DE', { maximumFractionDigits: 2 })
  }
}

export function cagrProzent(werte: number[], jahre: number): number | null {
  if (werte.length < 2 || jahre <= 0) return null
  const start = werte[0]
  const end = werte[werte.length - 1]
  if (start == null || end == null || start <= 0 || end <= 0) return null
  const cagr = (Math.pow(end / start, 1 / jahre) - 1) * 100
  return Number.isFinite(cagr) ? cagr : null
}

/**
 * Aufeinanderfolgende Jahre mit Sprung > `maxFaktor` sind typisch Einheiten-/Perioden-Mix
 * (Mio. vs. USD, Quartal vs. GJ). Behält die jüngste zusammenhängende Reihe.
 */
export function werteOhneNiveauSprung(werte: number[], maxFaktor = 2.8): number[] {
  const roh = werte.filter((v) => Number.isFinite(v) && v > 0)
  if (roh.length < 2) return roh
  const out: number[] = []
  for (let i = roh.length - 1; i >= 0; i--) {
    const cur = roh[i]!
    if (out.length === 0) {
      out.unshift(cur)
      continue
    }
    const ratio = out[0]! / cur
    if (ratio > maxFaktor || ratio < 1 / maxFaktor) break
    out.unshift(cur)
  }
  return out
}

export function cagr3AusSerie(werte: number[]): number | null {
  const clean = werteOhneNiveauSprung(werte)
  if (clean.length < 2) return null
  return cagrProzent(clean.slice(-4), Math.min(3, clean.length - 1))
}

/** Consensus vs. letztes Ist: Sprung >75 % YoY ist fast immer Einheiten- oder Perioden-Mix. */
export const SCHAETZUNG_VS_IST_MAX_FAKTOR = 1.75

export function istSchaetzungZumVorjahrPlausibel(
  aktuell: number,
  vorjahr: number,
  maxFaktor = SCHAETZUNG_VS_IST_MAX_FAKTOR,
): boolean {
  if (!(aktuell > 0) || !(vorjahr > 0)) return false
  const r = aktuell / vorjahr
  return r <= maxFaktor && r >= 1 / maxFaktor
}

function istNiveauSchaetzZeile(z: FundamentalMetrikZeile): boolean {
  return z.einheit === 'waehrung_usd_aktie' || z.einheit === 'waehrung_usd_mio' || z.einheit === 'waehrung_usd'
}

const NIVEAU_ZU_ABHAENGIGEN_ZEILEN: Record<string, string[]> = {
  eps: ['eps_wachstum_schaetzung', 'kgv'],
  umsatz: ['umsatz_wachstum_schaetzung', 'ps'],
  fcf: ['pfcf'],
  ebitda: ['ev_ebitda'],
  ebit: ['ev_ebit'],
}

function abhaengigeZeilenFuerNiveau(niveauId: string): string[] {
  const basis = niveauId.replace(/_schaetzung$/, '')
  return NIVEAU_ZU_ABHAENGIGEN_ZEILEN[basis] ?? [`${basis}_wachstum_schaetzung`]
}

function keysZumNullenFuerZeile(
  zeileId: string,
  nulledKeysById: Map<string, Set<string>>,
): Set<string> {
  const out = new Set<string>()
  for (const [niveauId, keys] of nulledKeysById) {
    if (!abhaengigeZeilenFuerNiveau(niveauId).includes(zeileId)) continue
    for (const k of keys) out.add(k)
  }
  return out
}

/**
 * Nullt Schätzwerte, die nicht zum letzten Ist passen (Quartal vs. GJ, Split, Mix).
 * Gilt für alle Titel — Chart, Tabelle und Cache-Lesen.
 */
export function bereinigeSchaetzungsniveausInZeilen(
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
): FundamentalMetrikZeile[] {
  const histKeys = perioden.filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung).map((p) => p.iso)
  const jahresSchaetzKeys = perioden
    .filter((p) => p.istSchaetzung && !istFundamentalQuartalSchaetzungIso(p.iso))
    .map((p) => p.iso)
  const quartalSchaetzKeys = perioden.filter((p) => istFundamentalQuartalSchaetzungIso(p.iso)).map((p) => p.iso)
  const hatJahresSchaetz = jahresSchaetzKeys.length > 0
  const nulledKeysById = new Map<string, Set<string>>()

  const cleaned = zeilen.map((z) => {
    if (!istNiveauSchaetzZeile(z)) return z
    const werte = { ...z.werte }
    let changed = false
    const nulled = new Set<string>()
    if (hatJahresSchaetz) {
      for (const k of quartalSchaetzKeys) {
        if (werte[k] != null) {
          werte[k] = null
          changed = true
          nulled.add(k)
        }
      }
    }
    let lastHist: number | null = null
    for (let i = histKeys.length - 1; i >= 0; i--) {
      const v = werte[histKeys[i]!]
      if (v != null && Number.isFinite(v) && v > 0) {
        lastHist = v
        break
      }
    }
    let prev = lastHist
    for (const k of jahresSchaetzKeys) {
      const v = werte[k]
      if (v == null || !Number.isFinite(v) || v <= 0) continue
      if (prev != null && !istSchaetzungZumVorjahrPlausibel(v, prev)) {
        werte[k] = null
        changed = true
        nulled.add(k)
        continue
      }
      prev = v
    }
    if (nulled.size > 0) nulledKeysById.set(z.id, nulled)
    return changed ? { ...z, werte } : z
  })

  return cleaned.map((z) => {
    const keys = keysZumNullenFuerZeile(z.id, nulledKeysById)
    if (keys.size === 0) return z
    const werte = { ...z.werte }
    let changed = false
    for (const k of keys) {
      if (werte[k] != null) {
        werte[k] = null
        changed = true
      }
    }
    return changed ? { ...z, werte } : z
  })
}

/** Schätz-Spalten ohne jeden Restwert (nach Niveau-Bereinigung) nicht mehr auf die Achse. */
export function periodenOhneLeereSchaetzungen(
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
): FundamentalPeriode[] {
  return perioden.filter((p) => {
    if (!p.istSchaetzung) return true
    return zeilen.some((z) => {
      const v = z.werte[p.iso]
      return v != null && Number.isFinite(v)
    })
  })
}

export function formatYahooUmsatzUsd(wert: number | null | undefined): string {
  if (wert == null || !Number.isFinite(wert)) return '–'
  return formatFundamentalWert(wert, 'waehrung_usd')
}

/** Vorjahresveränderung in Prozent; `null` wenn nicht berechenbar. */
export function yoyAenderungPct(
  aktuell: number | null | undefined,
  vorjahr: number | null | undefined,
): number | null {
  if (aktuell == null || vorjahr == null || !Number.isFinite(aktuell) || !Number.isFinite(vorjahr)) return null
  if (vorjahr === 0) return null
  const pct = ((aktuell - vorjahr) / Math.abs(vorjahr)) * 100
  return Number.isFinite(pct) ? pct : null
}

function kalenderQuartalAusIso(iso: string): { jahr: number; q: 1 | 2 | 3 | 4 } | null {
  const m = iso.match(/^(\d{4})-(\d{2})-\d{2}$/)
  if (!m) return null
  const month = Number(m[2])
  const q = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4
  return { jahr: Number(m[1]), q }
}

function medianTageabstand(isos: string[]): number | null {
  if (isos.length < 3) return null
  const gaps: number[] = []
  for (let i = 1; i < isos.length; i++) {
    const d =
      (Date.parse(`${isos[i]}T00:00:00Z`) - Date.parse(`${isos[i - 1]}T00:00:00Z`)) / 86_400_000
    if (Number.isFinite(d) && d > 20) gaps.push(d)
  }
  if (gaps.length === 0) return null
  const s = [...gaps].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)] ?? null
}

/**
 * ISO der Vorjahresperiode — nie Vorquartal.
 * Quartal/Halbjahr: gleiches Q/H im Vorjahr (über Label oder Kalenderquartal).
 * Geschäftsjahr: Datum − 1 Jahr (±20 Tage).
 */
export function yoyVorperiodeIso(
  iso: string,
  perioden: { iso: string; label?: string }[],
): string | null {
  const self = perioden.find((p) => p.iso === iso)
  const lab = self?.label?.trim().toUpperCase() ?? ''
  const qLab = /^(Q[1-4]|H[12])\s+(\d{2})$/.exec(lab)
  if (qLab) {
    const yy = Number(qLab[2]) - 1
    if (yy >= 0) {
      const zielLabel = `${qLab[1]} ${String(yy).padStart(2, '0')}`
      const hit = perioden.find((p) => p.iso !== iso && p.label?.trim().toUpperCase() === zielLabel)
      if (hit) return hit.iso
    }
  }

  const curQ = kalenderQuartalAusIso(iso)
  if (curQ) {
    const sameQ = perioden.filter((p) => {
      if (p.iso === iso) return false
      const o = kalenderQuartalAusIso(p.iso)
      return o != null && o.q === curQ.q && o.jahr === curQ.jahr - 1
    })
    if (sameQ.length === 1) return sameQ[0]!.iso
    if (sameQ.length > 1) {
      const zielMs = Date.parse(`${curQ.jahr - 1}${iso.slice(4)}T00:00:00Z`)
      let best = sameQ[0]!.iso
      let bestDiff = Infinity
      for (const p of sameQ) {
        const d = Math.abs(Date.parse(`${p.iso}T00:00:00Z`) - zielMs)
        if (d < bestDiff) {
          bestDiff = d
          best = p.iso
        }
      }
      return best
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const ziel = `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`
  if (perioden.some((p) => p.iso === ziel)) return ziel
  const zielMs = Date.parse(`${ziel}T00:00:00Z`)
  if (Number.isFinite(zielMs)) {
    let best: string | null = null
    let bestDiff = Infinity
    for (const p of perioden) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.iso) || p.iso === iso) continue
      const d = Math.abs(Date.parse(`${p.iso}T00:00:00Z`) - zielMs)
      if (d < bestDiff && d <= 20 * 24 * 60 * 60 * 1000) {
        bestDiff = d
        best = p.iso
      }
    }
    if (best) return best
  }

  const dates = perioden
    .map((p) => p.iso)
    .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))
    .sort()
  const idx = dates.indexOf(iso)
  if (idx < 0) return null
  const gap = medianTageabstand(dates)
  const schritte = gap != null && gap < 120 ? 4 : gap != null && gap < 220 ? 2 : 1
  return idx >= schritte ? dates[idx - schritte]! : null
}

export function formatYoyPct(pct: number): string {
  const abs = Math.abs(pct)
  const v =
    abs >= 100
      ? pct.toLocaleString('de-DE', { maximumFractionDigits: 0 })
      : pct.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${pct > 0 ? '+' : ''}${v} %`
}
