/**
 * Schnellcheck: Deposit+Buy darf IZF nicht halbieren.
 * node scripts/verify-parqet-irr.mjs
 */
import { createRequire } from 'module'
import { pathToFileURL } from 'url'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(__dirname, '..'))

// TS via tsx falls installiert, sonst nur Logik-Kommentar
async function main() {
  try {
    const tsx = await import('tsx').catch(() => null)
    if (!tsx) {
      console.log('Hinweis: npm i -D tsx && npx tsx scripts/verify-parqet-irr.mjs für vollen Test')
      return
    }
    const mod = await import(
      pathToFileURL(path.join(__dirname, '../lib/portfolio-analyse/parqet-xirr.ts')).href
    )
    const { berechneIrrAnnualizedPercent } = await import(
      pathToFileURL(path.join(__dirname, '../lib/portfolio-analyse/parqet-core/math-utils.ts')).href
    )

    const buchungen = [
      { datum: '2024-01-01', typ: 'einzahlung', betragEur: 10000, stueck: null, kursEur: null },
      { datum: '2024-01-02', typ: 'kauf', betragEur: 10000, stueck: 10, kursEur: 1000 },
      { datum: '2025-06-01', typ: 'dividende', betragEur: 200, stueck: null, kursEur: null },
    ]
    const terminal = 12000
    const flows = mod.parqetIrrCashflowsAusBuchungen(buchungen)
    const irr = berechneIrrAnnualizedPercent(flows, terminal, new Date('2025-06-01'))
    const diag = mod.parqetIrrDiagnose(buchungen, terminal)

    console.log('Modus:', diag.modus)
    console.log('Flows:', flows.map((f) => ({ d: f.date.toISOString().slice(0, 10), a: f.amount })))
    console.log('IZF %:', irr)
    console.log('Diagnose:', diag)

    const nurKauf = [{ datum: '2024-01-02', typ: 'kauf', betragEur: 10000, stueck: 10, kursEur: 1000 }]
    const flows2 = mod.parqetIrrCashflowsAusBuchungen(nurKauf)
    const irr2 = berechneIrrAnnualizedPercent(flows2, terminal, new Date('2025-06-01'))
    console.log('\nNur Kauf — Modus:', mod.parqetIrrModus(nurKauf), 'IZF %:', irr2)
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
}

main()
