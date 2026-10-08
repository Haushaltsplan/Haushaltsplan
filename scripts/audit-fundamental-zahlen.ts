/**
 * Stichproben-Audit: CAGR, Doppelperioden, Key Metrics-Konsistenz.
 *
 *   npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/audit-fundamental-zahlen.ts
 */
import { readFileSync } from 'fs'
import { ladeFundamentaldaten } from '../lib/portfolio-analyse/fundamentaldaten-server'
import { runWithPrimaeremOwner } from '../lib/request-owner'
import {
  cagr3AusSerie,
  cagr5AusSerie,
} from '../lib/portfolio-analyse/fundamentaldaten-format'
import {
  historischeJahresKeys,
  historischeWerteAusZeile,
  istQuartalsPerioden,
} from '../lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import { parseDeZahl } from '../lib/portfolio-analyse/titel-vergleich-parse'

try {
  const raw = readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const k = m[1]!.trim()
    if (!k || process.env[k]) continue
    process.env[k] = m[2]!.trim().replace(/^["']|["']$/g, '')
  }
} catch {
  /* */
}

const TITEL = [
  { isin: 'US92826C8394', symbolYahoo: 'V', name: 'Visa' },
  { isin: 'US57636Q1040', symbolYahoo: 'MA', name: 'Mastercard' },
  { isin: 'US5949181045', symbolYahoo: 'MSFT', name: 'Microsoft' },
  { isin: 'US02079K1079', symbolYahoo: 'GOOGL', name: 'Alphabet' },
  { isin: 'US9078181081', symbolYahoo: 'UNP', name: 'Union Pacific' },
  { isin: 'US6795801009', symbolYahoo: 'ODFL', name: 'Old Dominion' },
  { isin: 'NL0010273215', symbolYahoo: 'ASML', name: 'ASML' },
  { isin: 'FR0000052292', symbolYahoo: 'RMS.PA', name: 'Hermes' },
  { isin: 'CH0418792922', symbolYahoo: 'SIKA.SW', name: 'Sika' },
  { isin: 'US8835561023', symbolYahoo: 'TMO', name: 'Thermo Fisher' },
]

type Befund = { titel: string; art: string; detail: string }

function km(paket: Awaited<ReturnType<typeof ladeFundamentaldaten>>, id: string) {
  return paket.keyMetrics.find((m) => m.id === id)
}

function kmZahl(paket: Awaited<ReturnType<typeof ladeFundamentaldaten>>, id: string): number | null {
  const m = km(paket, id)
  if (!m) return null
  if (m.zahl != null && Number.isFinite(m.zahl)) return m.zahl
  return parseDeZahl(m.wert)
}

async function main() {
  const befunde: Befund[] = []
  for (const t of TITEL) {
    const paket = await runWithPrimaeremOwner(() =>
      ladeFundamentaldaten({
        isin: t.isin,
        symbolYahoo: t.symbolYahoo,
        name: t.name,
        cacheModus: 'immer',
      }),
    )
    const label = `${t.name} (${t.symbolYahoo})`
    if (!paket.ok) {
      befunde.push({ titel: label, art: 'paket', detail: paket.fehler ?? 'ok=false' })
      continue
    }

    const histKeys = paket.perioden.filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung)
    const years = new Map<number, string[]>()
    for (const p of histKeys) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.iso)) continue
      const y = Number(p.iso.slice(0, 4))
      const arr = years.get(y) ?? []
      arr.push(p.iso)
      years.set(y, arr)
    }
    const doppelJahre = [...years.entries()].filter(([, isos]) => isos.length > 1)
    const dedupKeys = historischeJahresKeys(paket.perioden)
    if (doppelJahre.length > 0 && !istQuartalsPerioden(paket.perioden)) {
      // Doppel ok, solange Dedup greift — prüfe CAGR-Konsistenz
      const umsatz = paket.zeilen.find((z) => z.id === 'umsatz')
      const hist = historischeWerteAusZeile(umsatz, paket.perioden)
      const c3 = cagr3AusSerie(hist)
      const km3 = kmZahl(paket, 'rev_cagr_3y')
      if (c3 != null && km3 != null && Math.abs(c3 - km3) > 0.15) {
        befunde.push({
          titel: label,
          art: 'cagr_mismatch',
          detail: `Umsatz-CAGR3 hist=${c3.toFixed(2)} km=${km3.toFixed(2)} doppelJahre=${doppelJahre.length} dedup=${dedupKeys.length}`,
        })
      }
      // Verdacht: Dedup hat nicht gegriffen → CAGR verdächtig niedrig bei Doppel
      if (c3 != null && c3 < 2 && doppelJahre.length >= 3 && hist.length >= 4) {
        const roh = histKeys
          .map((p) => umsatz?.werte[p.iso])
          .filter((v): v is number => v != null && v > 0)
        const rohCagr = cagr3AusSerie(roh)
        if (rohCagr != null && Math.abs(rohCagr - c3) < 0.2) {
          befunde.push({
            titel: label,
            art: 'dedup_fail',
            detail: `CAGR3=${c3.toFixed(2)} trotz ${doppelJahre.length} Doppeljahren (roh≈gleich)`,
          })
        }
      }
    }

    // Value Spread = ROIC − WACC wenn beide da
    const roic = kmZahl(paket, 'ltm_roic')
    const wacc = kmZahl(paket, 'wacc')
    const spread = kmZahl(paket, 'ltm_value_spread')
    if (roic != null && wacc != null) {
      const erwartet = Math.round((roic - wacc) * 100) / 100
      if (spread == null) {
        befunde.push({ titel: label, art: 'spread_leer', detail: `ROIC=${roic} WACC=${wacc}` })
      } else if (Math.abs(spread - erwartet) > 0.3) {
        befunde.push({
          titel: label,
          art: 'spread_falsch',
          detail: `spread=${spread} erwartet=${erwartet}`,
        })
      }
    }

    // Verwässerung: negativ bei sinkender Aktienzahl
    const verw = kmZahl(paket, 'aktien_verwaesserung')
    const aktien = paket.zeilen.find((z) => z.id === 'aktien')
    const aHist = historischeWerteAusZeile(aktien, paket.perioden)
    if (aHist.length >= 3 && verw != null) {
      const sinkt = aHist[aHist.length - 1]! < aHist[0]! * 0.98
      if (sinkt && verw > 0.05) {
        befunde.push({
          titel: label,
          art: 'verw_vorzeichen',
          detail: `Aktien sinken ${aHist[0]!.toFixed(0)}→${aHist[aHist.length - 1]!.toFixed(0)} aber Verw=${verw}`,
        })
      }
    }

    // Rule of 40 ≈ CAGR3 + max Marge
    const r40 = kmZahl(paket, 'rule_of_40')
    const cagr3 = kmZahl(paket, 'rev_cagr_3y')
    const ebit = kmZahl(paket, 'ltm_ebit')
    if (r40 != null && cagr3 != null && ebit != null) {
      // FCF-Marge oft höher — nur Soft-Check: Ro40 sollte ≥ CAGR3 + etwas
      if (r40 < cagr3 - 1) {
        befunde.push({
          titel: label,
          art: 'r40_unter_cagr',
          detail: `Ro40=${r40} < CAGR3=${cagr3}`,
        })
      }
    }

    // Peg / negative PEG nonsense
    const peg = kmZahl(paket, 'peg_ratio')
    if (peg != null && (peg < 0 || peg > 50)) {
      befunde.push({ titel: label, art: 'peg_extrem', detail: `PEG=${peg}` })
    }

    // FY-KGV darf nicht um Größenordnungen unter Trailing liegen (EU-Schätz-Scraping)
    const ntmPe = kmZahl(paket, 'ntm_pe')
    const ltmPe = kmZahl(paket, 'ltm_pe')
    if (ntmPe != null && ltmPe != null && ltmPe > 8 && ntmPe < ltmPe * 0.35) {
      befunde.push({
        titel: label,
        art: 'fwd_pe_unplausibel',
        detail: `ntm=${ntmPe.toFixed(2)} ltm=${ltmPe.toFixed(2)}`,
      })
    }

    const ntmEvRev = kmZahl(paket, 'ntm_ev_rev')
    const ltmEvRev = kmZahl(paket, 'ltm_ev_rev')
    if (ntmEvRev != null && (ntmEvRev > 150 || (ltmEvRev != null && ltmEvRev > 0.5 && ntmEvRev > ltmEvRev * 5))) {
      befunde.push({
        titel: label,
        art: 'fwd_ev_rev_unplausibel',
        detail: `ntm=${ntmEvRev.toFixed(2)} ltm=${ltmEvRev?.toFixed(2) ?? '–'}`,
      })
    }

    // iROIC=0 + iSpread negativ = schrumpfend falsch als Zahl
    const iroic = kmZahl(paket, 'incremental_roic')
    const ivs = kmZahl(paket, 'incremental_value_spread')
    const iroicText = km(paket, 'incremental_roic')?.wert ?? ''
    if (/NOPAT rückläufig/i.test(iroicText) && (iroic === 0 || (ivs != null && iroic == null))) {
      if (iroic === 0 || (ivs != null && Math.abs(ivs) > 0.01 && iroic == null && !/–/.test(iroicText))) {
        befunde.push({
          titel: label,
          art: 'iroic_schrumpf_zahl',
          detail: `iroic=${iroic} ivs=${ivs} text=${iroicText}`,
        })
      }
    }
    if (/NOPAT rückläufig/i.test(iroicText) && ivs != null) {
      befunde.push({
        titel: label,
        art: 'iroic_schrumpf_spread',
        detail: `ivs=${ivs} trotz NOPAT rückläufig`,
      })
    }

    console.log(
      label.padEnd(22),
      'ok',
      `cagr3=${kmZahl(paket, 'rev_cagr_3y')?.toFixed(1) ?? '–'}`,
      `eps3=${kmZahl(paket, 'eps_cagr_3y')?.toFixed(1) ?? '–'}`,
      `verw=${kmZahl(paket, 'aktien_verwaesserung')?.toFixed(2) ?? '–'}`,
      `spread=${kmZahl(paket, 'ltm_value_spread')?.toFixed(1) ?? '–'}`,
      `r40=${kmZahl(paket, 'rule_of_40')?.toFixed(1) ?? '–'}`,
      `doppelJ=${doppelJahre.length}`,
    )
  }

  console.log('\n--- BEFUNDE ---')
  if (befunde.length === 0) console.log('keine')
  for (const b of befunde) console.log(`[${b.art}] ${b.titel}: ${b.detail}`)
  process.exit(befunde.some((b) => b.art !== 'peg_extrem') ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
