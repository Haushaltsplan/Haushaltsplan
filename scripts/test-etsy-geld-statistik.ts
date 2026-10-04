/**
 * Unit-Tests: Marge (Brutto/MwSt/Kleinunternehmer) + Statistik-Deltas.
 * npx tsx scripts/test-etsy-geld-statistik.ts
 */
import { berechneMarge, type EtsyKostenZeile } from '../lib/etsy/etsy-shop-os-types'
import { funnelDelta7, zuwachsNormalisiert, type StatistikSnap } from '../lib/etsy/etsy-statistik-delta'

let failed = 0

function assert(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  OK  ${name}`)
  } else {
    failed++
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function nahe(a: number, b: number, eps = 0.05) {
  return Math.abs(a - b) <= eps
}

const kosten: EtsyKostenZeile = {
  holzEur: 20,
  oelEur: 2,
  schleifEur: 1.5,
  werkzeugEur: 3,
  stromEur: 1,
  verpackungEur: 3.5,
  sonstigesEur: 0,
  arbeitsstunden: 2,
  stundensatzEur: 25,
  versandAnteilEur: 0,
}
// Material+Arbeit = 31 + 50 = 81; +12% GK = 90.72

console.log('\n=== berechneMarge ===')

{
  const m = berechneMarge(119, kosten, {
    zielMargePct: 55,
    etsyGebuehrPct: 6.5,
    paymentGebuehrPct: 4,
    paymentGebuehrFix: 0.25,
    gemeinkostenAufschlagPct: 12,
    mwstSatzPct: 19,
    preisIstBrutto: true,
  })
  assert('Brutto 119: Netto-Erlös ≈ 100', nahe(m.nettoErloesEur ?? 0, 100, 0.1), String(m.nettoErloesEur))
  assert('Brutto 119: MwSt ≈ 19', nahe(m.mwstEur, 19, 0.1), String(m.mwstEur))
  assert('Gemeinkosten > 0', m.gemeinkostenEur > 0, String(m.gemeinkostenEur))
  assert('Fees auf Brutto > 0', m.gebuehrenEur > 10, String(m.gebuehrenEur))
  // 119 * 0.105 + 0.25 = 12.745
  assert('Fees ≈ 12.75', nahe(m.gebuehrenEur, 12.75, 0.05), String(m.gebuehrenEur))
  assert('Mindestpreis > variable', m.mindestpreisEur > m.variableEur)
  assert('Ampel gesetzt', m.ampel === 'zu_billig' || m.ampel === 'fair' || m.ampel === 'premium', m.ampel)
}

{
  const m = berechneMarge(119, kosten, {
    zielMargePct: 55,
    etsyGebuehrPct: 6.5,
    paymentGebuehrPct: 4,
    paymentGebuehrFix: 0.25,
    gemeinkostenAufschlagPct: 12,
    mwstSatzPct: 0,
    preisIstBrutto: true,
  })
  assert('Kleinunternehmer: MwSt 0', m.mwstEur === 0, String(m.mwstEur))
  assert('Kleinunternehmer: NettoErlös = Brutto', nahe(m.nettoErloesEur ?? 0, 119, 0.01), String(m.nettoErloesEur))
}

{
  const m = berechneMarge(null, kosten, {
    zielMargePct: 55,
    etsyGebuehrPct: 6.5,
    paymentGebuehrPct: 4,
    paymentGebuehrFix: 0.25,
    gemeinkostenAufschlagPct: 12,
    mwstSatzPct: 19,
    preisIstBrutto: true,
  })
  assert('Ohne Preis: Ampel ohne_kosten wenn variable>0…', m.ampel === 'ohne_kosten' || m.variableEur > 0)
  assert('Ohne Preis: Mindestpreis > 0', m.mindestpreisEur > 0)
}

console.log('\n=== zuwachsNormalisiert / funnelDelta7 ===')

{
  const reihe: StatistikSnap[] = [
    { tag: '2026-09-20', views: 100, favoriten: 10 },
    { tag: '2026-09-22', views: 110, favoriten: 11 }, // Lücke
    { tag: '2026-09-28', views: 140, favoriten: 14 }, // 6 Tage Span von 22→28, +30 views
    { tag: '2026-09-30', views: 150, favoriten: 15 },
  ]
  const d = zuwachsNormalisiert(reihe, '2026-09-23', '2026-09-30', 'views', 7)
  assert('Delta gefunden', d != null)
  if (d) {
    // start ≤ 2026-09-23 → 2026-09-22 (110), ende ≤ 30 → 150, span 8 Tage, roh 40 → norm 7d = 35
    assert('Roh = 40', d.roh === 40, String(d.roh))
    assert('TageSpan = 8', d.tageSpan === 8, String(d.tageSpan))
    assert('Normalisiert ≈ 35', nahe(d.normalisiert, 35, 0.2), String(d.normalisiert))
  }

  const f = funnelDelta7(reihe, '2026-09-30', '2026-09-23')
  assert('funnel views7 > 0', f.views7 > 0, String(f.views7))
  assert('funnel favs7 > 0', f.favs7 > 0, String(f.favs7))
}

{
  const leer: StatistikSnap[] = [{ tag: '2026-09-30', views: 10, favoriten: 1 }]
  const d = zuwachsNormalisiert(leer, '2026-09-23', '2026-09-30', 'views', 7)
  assert('Ein Snapshot → null', d == null)
}

console.log(failed === 0 ? '\nAlle Tests bestanden.\n' : `\n${failed} Test(s) fehlgeschlagen.\n`)
process.exit(failed === 0 ? 0 : 1)
