/**
 *   npx tsx lib/portfolio-analyse/historische-jahres-keys.test.ts
 */
import {
  cagr3AusSerie,
  cagr5AusSerie,
} from '@/lib/portfolio-analyse/fundamentaldaten-format'
import {
  historischeJahresKeys,
  historischeWerteAusZeile,
  istQuartalsPerioden,
} from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

// Visa-artig: FY 30.09. + Kalender 31.12. Duplikate
const visaPerioden: FundamentalPeriode[] = [
  { iso: '2020-09-30', label: '2020' },
  { iso: '2021-09-30', label: '2021' },
  { iso: '2021-12-31', label: '2021c' },
  { iso: '2022-09-30', label: '2022' },
  { iso: '2022-12-31', label: '2022c' },
  { iso: '2023-09-30', label: '2023' },
  { iso: '2023-12-31', label: '2023c' },
  { iso: '2024-09-30', label: '2024' },
  { iso: '2024-12-31', label: '2024c' },
  { iso: '2025-09-30', label: '2025' },
  { iso: '2025-12-31', label: '2025c' },
]

assert(!istQuartalsPerioden(visaPerioden), 'Visa-Serie ist kein Quartal')

const keys = historischeJahresKeys(visaPerioden)
assert(keys.length === 6, `6 Jahre erwartet, got ${keys.length}: ${keys.join(',')}`)
assert(keys.every((k) => k.endsWith('09-30')), `FY-Ende bevorzugt: ${keys.join(',')}`)

const umsatz: FundamentalMetrikZeile = {
  id: 'umsatz',
  label: 'Umsatz',
  gruppe: 'finanzdaten',
  einheit: 'waehrung_usd_mio',
  werte: {
    '2020-09-30': 21846,
    '2021-09-30': 24105,
    '2021-12-31': 24105,
    '2022-09-30': 29310,
    '2022-12-31': 29310,
    '2023-09-30': 32653,
    '2023-12-31': 32653,
    '2024-09-30': 35926,
    '2024-12-31': 35926,
    '2025-09-30': 40000,
    '2025-12-31': 40000,
  },
}

const hist = historischeWerteAusZeile(umsatz, visaPerioden)
assert(hist.length === 6, `hist len ${hist.length}`)
const c3 = cagr3AusSerie(hist)
const c5 = cagr5AusSerie(hist)
assert(c3 != null && c3 > 9 && c3 < 13, `Umsatz-CAGR 3J ~11 %, got ${c3}`)
assert(c5 != null && c5 > 10 && c5 < 15, `Umsatz-CAGR 5J ~13 %, got ${c5}`)

// EPS: 2021 nur Kalenderjahr, FY ab 2022 — trotzdem 2021 mitnehmen
const eps: FundamentalMetrikZeile = {
  id: 'eps',
  label: 'EPS',
  gruppe: 'finanzdaten',
  einheit: 'waehrung_usd_aktie',
  werte: {
    '2021-12-31': 5.626599,
    '2022-09-30': 7,
    '2022-12-31': 7.00234,
    '2023-09-30': 8.28,
    '2023-12-31': 8.284412,
    '2024-09-30': 9.73,
    '2024-12-31': 9.730409,
    '2025-09-30': 10.2,
    '2025-12-31': 10.202441,
  },
}
const epsHist = historischeWerteAusZeile(eps, visaPerioden)
assert(epsHist.length === 5, `EPS-Jahre ${epsHist.length}: ${epsHist.join(',')}`)
assert(Math.abs(epsHist[0]! - 5.626599) < 1e-6, 'EPS 2021 aus Kalenderjahr')
const eps3 = cagr3AusSerie(epsHist)
assert(eps3 != null && eps3 > 12 && eps3 < 22, `EPS-CAGR 3J got ${eps3}`)

// Ohne Dedup wäre slice(-4) ≈ 3,6 %
const roh = visaPerioden
  .map((p) => umsatz.werte[p.iso])
  .filter((v): v is number => v != null)
assert(cagr3AusSerie(roh)! < 5, 'Kontrolle: Duplikat-Serie bleibt niedrig')

// Echte Quartale bleiben erhalten
const qPerioden: FundamentalPeriode[] = []
for (let y = 2022; y <= 2025; y++) {
  for (const m of ['03-31', '06-30', '09-30', '12-31']) {
    qPerioden.push({ iso: `${y}-${m}`, label: `${y}-${m}` })
  }
}
assert(istQuartalsPerioden(qPerioden), 'echte Quartale')
assert(historischeJahresKeys(qPerioden).length === qPerioden.length, 'Quartale nicht kollabieren')

console.log('historische-jahres-keys.test.ts: ok', { c3, c5 })
