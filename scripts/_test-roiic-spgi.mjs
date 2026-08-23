/**
 * Unit-Checks für ROIIC-Logik (SPGI Post-IHS-Markit-Szenario).
 * Aufruf: node scripts/_test-roiic-spgi.mjs
 */
import {
  berechneRoiicAusSnaps,
  roiicBookPct,
  roiicOrganicPct,
} from '../lib/portfolio-analyse/incremental-roic.ts'

// Vereinfachtes SPGI-Szenario (Mio. USD), IHS Markit 2022
const spgiSnaps = [
  { jahr: 2021, nopatMio: 3535, icMio: 9307, goodwillMio: 5200, intangiblesMio: 800, capexMio: 250, daMio: 200 },
  { jahr: 2022, nopatMio: 3400, icMio: 30951, goodwillMio: 40200, intangiblesMio: 12000, capexMio: 280, daMio: 400 },
  { jahr: 2023, nopatMio: 3567, icMio: 50800, goodwillMio: 35000, intangiblesMio: 11000, capexMio: 290, daMio: 1200 },
  { jahr: 2024, nopatMio: 4300, icMio: 49877, goodwillMio: 34500, intangiblesMio: 10500, capexMio: 300, daMio: 1250 },
  { jahr: 2025, nopatMio: 5043, icMio: 49704, goodwillMio: 34000, intangiblesMio: 10000, capexMio: 310, daMio: 1300 },
]

const paket = berechneRoiicAusSnaps(spgiSnaps, 'stockanalysis')

// Book über M&A-Fenster (2021→2025) muss wertlos sein
const bookMa = roiicBookPct(spgiSnaps[4], spgiSnaps[0])
const orgPost = roiicOrganicPct(spgiSnaps[4], spgiSnaps[2], spgiSnaps.slice(2))

console.log('SPGI ROIIC Paket:', {
  pct: paket.incrementalRoicPct,
  methode: paket.methode,
  fenster: paket.fensterJahre,
  quelle: paket.quelle,
})
console.log('Book über M&A (soll null):', bookMa)
console.log('Organic 2023→2025 (soll >>10%):', orgPost)

const ok =
  paket.incrementalRoicPct != null &&
  paket.incrementalRoicPct > 15 &&
  paket.methode === 'organic_capex' &&
  bookMa == null

console.log(ok ? '✓ SPGI ROIIC-Test bestanden' : '✗ SPGI ROIIC-Test FEHLGESCHLAGEN')
process.exit(ok ? 0 : 1)
