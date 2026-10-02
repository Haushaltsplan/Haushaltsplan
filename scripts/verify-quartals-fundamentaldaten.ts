/**
 * Quartalszahlen-Sanity: SEC Company Facts + ISO-Match.
 *
 *   npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/verify-quartals-fundamentaldaten.ts
 */
import { readFileSync } from 'fs'
import { wertAusMapFuerIso } from '../lib/portfolio-analyse/fundamentaldaten-wert-fuer-iso'
import { ergaenzeMargenZeilen } from '../lib/portfolio-analyse/fundamentaldaten-margen-zeilen'
import { ergaenzeQuartalsRenditenTTM } from '../lib/portfolio-analyse/fundamentaldaten-roic-berechnung'
import { ladeSecFundamentaldaten } from '../lib/portfolio-analyse/sec-fundamentaldaten-server'
import type { MacrotrendsIdent } from '../lib/portfolio-analyse/macrotrends-scraper-server'

function loadEnv() {
  try {
    const raw = readFileSync('.env.local', 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1]!.trim()] = m[2]!.trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* */
  }
}
loadEnv()

function ident(ticker: string, firmenname: string): MacrotrendsIdent {
  return {
    ticker,
    slug: ticker.toLowerCase(),
    firmenname,
  }
}

function pruefeIsoMatch(): number {
  let fail = 0
  const werte = {
    '2024-03-31': 100,
    '2024-06-30': 200,
    '2024-09-30': 300,
    '2024-12-31': 400,
  }
  // Exakt
  if (wertAusMapFuerIso(werte, '2024-03-31') !== 100) {
    console.log('FAIL exact match')
    fail++
  }
  // Eng (±2d) ok
  if (wertAusMapFuerIso(werte, '2024-03-29', { maxDiffTage: 10 }) !== 100) {
    console.log('FAIL ±10d match')
    fail++
  }
  // Q1 darf NICHT Q4 aus gleichem Jahr ziehen (früherer Bug)
  if (wertAusMapFuerIso(werte, '2024-01-15', { maxDiffTage: 10 }) != null) {
    console.log('FAIL same-year leak into orphan date')
    fail++
  }
  // ±45d darf nicht benachbartes Quartal greifen (Mar31↔Apr30 = 30d)
  const leak = wertAusMapFuerIso(
    { '2024-04-30': 999, '2024-03-31': 100 },
    '2024-03-31',
    { maxDiffTage: 10 },
  )
  if (leak !== 100) {
    console.log('FAIL preferred exact over neighbor', leak)
    fail++
  }
  const benachbart = wertAusMapFuerIso({ '2024-04-30': 999 }, '2024-03-31', { maxDiffTage: 10 })
  if (benachbart != null) {
    console.log('FAIL Q2 date matched into Q1 within 10d', benachbart)
    fail++
  }
  // Altes Default 45d würde Apr30 für Mar31 finden — wir testen dass 45d das noch kann,
  // Quartals-Merge nutzt aber 10d
  const weit = wertAusMapFuerIso({ '2024-04-30': 999 }, '2024-03-31', { maxDiffTage: 45 })
  if (weit !== 999) {
    console.log('FAIL 45d still matches ~30d drift (annual path)', weit)
    fail++
  }
  return fail
}

function serieAusZeile(
  zeile: { werte: Record<string, number | null> } | undefined,
  perioden: string[],
): Array<{ iso: string; v: number }> {
  if (!zeile) return []
  const out: Array<{ iso: string; v: number }> = []
  for (const iso of perioden) {
    const v = zeile.werte[iso]
    if (v != null && Number.isFinite(v)) out.push({ iso, v })
  }
  return out
}

function pruefeQuartalsSanity(
  ticker: string,
  perioden: string[],
  umsatz: { werte: Record<string, number | null> } | undefined,
  eps: { werte: Record<string, number | null> } | undefined,
): number {
  let fail = 0
  const u = serieAusZeile(umsatz, perioden)
  if (u.length < 8) {
    console.log(`FAIL ${ticker} zu wenige Umsatz-Quartale`, u.length)
    fail++
    return fail
  }

  // Folgequartale: Abstand ~60–130 Tage
  for (let i = 1; i < Math.min(u.length, 12); i++) {
    const gap = (Date.parse(u[i]!.iso) - Date.parse(u[i - 1]!.iso)) / 86_400_000
    if (gap < 50 || gap > 140) {
      console.log(`FAIL ${ticker} Umsatz-Lücke ${u[i - 1]!.iso}→${u[i]!.iso} (${Math.round(gap)}d)`)
      fail++
    }
  }

  // Kein einzelnes Quartal ≈ YTD (Rolling-Fenster, funktioniert auch bei FY≠Kalender)
  for (let i = 0; i + 3 < u.length; i++) {
    const window = u.slice(i, i + 4).map((x) => x.v)
    const pos = window.filter((v) => v > 0)
    if (pos.length < 4) continue
    const sum = pos.reduce((a, b) => a + b, 0)
    const max = Math.max(...pos)
    const sorted = [...pos].sort((a, b) => a - b)
    const median = (sorted[1]! + sorted[2]!) / 2
    if (max > sum * 0.55) {
      console.log(`FAIL ${ticker} Umsatz-Fenster wirkt wie YTD`, {
        von: u[i]!.iso,
        bis: u[i + 3]!.iso,
        window,
      })
      fail++
      break
    }
    if (median > 0 && max / median > 3.5) {
      console.log(`FAIL ${ticker} Umsatz-Quartale extrem ungleich`, {
        von: u[i]!.iso,
        bis: u[i + 3]!.iso,
        window,
      })
      fail++
      break
    }
  }

  const e = serieAusZeile(eps, perioden)
  // EPS: keine YTD-Differenzierung — Werte sollten quartalsweise bleiben
  for (const { iso, v } of e.slice(-8)) {
    if (Math.abs(v) > 50) {
      console.log(`FAIL ${ticker} EPS ${iso}=${v} wirkt wie nicht-quartal / falsch skaliert`)
      fail++
    }
  }

  return fail
}

async function main() {
  let fail = pruefeIsoMatch()
  console.log(fail === 0 ? 'OK iso-match' : `FAIL iso-match (${fail})`)

  for (const t of [
    { t: 'MA', name: 'Mastercard' },
    { t: 'MSFT', name: 'Microsoft' },
    { t: 'AAPL', name: 'Apple' },
    { t: 'ROL', name: 'Rollins' },
  ]) {
    const t0 = Date.now()
    const roh = await ladeSecFundamentaldaten(ident(t.t, t.name), 'quartal')
    const ms = Date.now() - t0
    if (!roh) {
      console.log('FAIL', t.t, 'kein SEC-Quartal-Paket')
      fail++
      continue
    }
    ergaenzeMargenZeilen(roh.perioden, roh.zeilen)
    ergaenzeQuartalsRenditenTTM(roh.perioden, roh.zeilen)
    const perioden = roh.perioden.filter((p) => !p.istLtm).map((p) => p.iso)
    const umsatz = roh.zeilen.find((z) => z.id === 'umsatz')
    const eps = roh.zeilen.find((z) => z.id === 'eps')
    const nFail = pruefeQuartalsSanity(t.t, perioden, umsatz, eps)
    fail += nFail

    if (t.t === 'ROL') {
      const roi = roh.zeilen.find((z) => z.id === 'roi')
      const ebm = roh.zeilen.find((z) => z.id === 'ebit_marge')
      const roiFilled = perioden.filter((iso) => roi?.werte[iso] != null).length
      const ebm2016 = ebm?.werte['2016-03-31']
      const roi2025 = roi?.werte['2025-12-31']
      if (roiFilled < 50) {
        console.log('FAIL ROL zu wenig ROIC-Historie', roiFilled)
        fail++
      }
      if (ebm2016 == null) {
        console.log('FAIL ROL EBIT-Marge 2016 fehlt')
        fail++
      }
      if (roi2025 != null && roi2025 < 15) {
        console.log('FAIL ROL ROIC 2025 zu niedrig (Einzelquartal?)', roi2025)
        fail++
      }
    }

    const last4 = perioden.slice(-4)
    const u4 = last4.map((iso) => umsatz?.werte[iso] ?? null)
    const e4 = last4.map((iso) => eps?.werte[iso] ?? null)
    console.log(
      nFail === 0 ? 'OK' : 'FAIL',
      t.t,
      `${ms}ms`,
      `perioden=${perioden.length}`,
      `last4=${last4.join(',')}`,
      `umsatz=${u4.join('/')}`,
      `eps=${e4.join('/')}`,
    )
  }

  if (fail > 0) {
    console.error(`\n${fail} Fehler`)
    process.exit(1)
  }
  console.log('\nAlle Quartals-Checks OK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
