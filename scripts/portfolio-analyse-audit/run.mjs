#!/usr/bin/env node
/**
 * Portfolio-Analyse Qualitäts-Audit — statische Regeln + Vertrags-Tests.
 *
 * npm run audit:portfolio
 * npm run audit:portfolio -- --fix-hints   (zeigt Fix-Anleitung)
 * npm run audit:portfolio -- --json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { RULES, checkTimeoutAlignment, PA_ROOT } from './rules.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '../..')
const PA_DIR = path.join(ROOT, PA_ROOT)

const args = process.argv.slice(2)
const jsonOut = args.includes('--json')
const quiet = args.includes('--quiet')
const fixHints = args.includes('--fix-hints')
const skipContract = args.includes('--skip-contract')

/** @param {string} dir */
function walkTs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walkTs(full, acc)
    else if (/\.(ts|tsx)$/.test(ent.name) && !ent.name.endsWith('.d.ts')) acc.push(full)
  }
  return acc
}

/** @param {string} abs */
function rel(abs) {
  return path.relative(ROOT, abs).replace(/\\/g, '/')
}

/** @typedef {{ ruleId: string, severity: string, category: string, file: string, line: number, message: string, hint: string, excerpt?: string }} Finding */

/** @type {Finding[]} */
const findings = []

const files = walkTs(PA_DIR)
const fileContents = Object.fromEntries(
  files.map((f) => [rel(f), fs.readFileSync(f, 'utf8')]),
)

for (const rule of RULES) {
  for (const [filePath, content] of Object.entries(fileContents)) {
    const hits = rule.test(filePath, content)
    for (const h of hits) {
      findings.push({
        ruleId: rule.id,
        severity: rule.severity,
        category: rule.category,
        file: filePath,
        line: h.line,
        message: rule.description,
        hint: rule.hint ?? '',
        excerpt: h.excerpt,
      })
    }
  }
}

findings.push(...checkTimeoutAlignment(fileContents))

// Vertrags-Tests (tsx)
if (!skipContract) {
  try {
    const out = execSync('npx tsx scripts/portfolio-analyse-audit/contract.ts', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (!quiet && out.trim()) console.log(out.trim())
  } catch (e) {
    const stdout = e.stdout?.toString?.() ?? ''
    const stderr = e.stderr?.toString?.() ?? ''
    const text = (stdout + stderr).trim()
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      const sev = line.startsWith('ERROR') ? 'error' : line.startsWith('WARN') ? 'warn' : 'error'
      findings.push({
        ruleId: 'contract-test',
        severity: sev,
        category: 'vertrag',
        file: 'scripts/portfolio-analyse-audit/contract.ts',
        line: 0,
        message: line.replace(/^(ERROR|WARN):\s*/, ''),
        hint: 'analyseTickerFuerPosition / Whitelist-Kenntnisse prüfen.',
      })
    }
  }
}

const errors = findings.filter((f) => f.severity === 'error')
const warns = findings.filter((f) => f.severity === 'warn')
const infos = findings.filter((f) => f.severity === 'info')

function printReport() {
  if (findings.length === 0) {
    console.log('✓ Portfolio-Analyse-Audit: keine Befunde\n')
    return
  }

  console.log(`Portfolio-Analyse-Audit: ${errors.length} Fehler, ${warns.length} Warnungen, ${infos.length} Hinweise\n`)

  const order = { error: 0, warn: 1, info: 2 }
  const sorted = [...findings].sort((a, b) => order[a.severity] - order[b.severity])

  for (const f of sorted) {
    const icon = f.severity === 'error' ? '✗' : f.severity === 'warn' ? '⚠' : '·'
    const loc = f.line > 0 ? `${f.file}:${f.line}` : f.file
    console.log(`${icon} [${f.ruleId}] ${loc}`)
    console.log(`  ${f.message}`)
    if (f.excerpt) console.log(`  Code: ${f.excerpt}`)
    if (fixHints && f.hint) console.log(`  Fix: ${f.hint}`)
    console.log('')
  }

  console.log('→ Agent: Skill „portfolio-analyse-audit“ lesen und Befunde klassenübergreifend beheben.')
  console.log('→ Manuell: npm run audit:portfolio -- --fix-hints\n')
}

if (jsonOut) {
  console.log(JSON.stringify({ ok: errors.length === 0, errors, warns, infos, findings }, null, 2))
} else if (!quiet) {
  printReport()
}

process.exit(errors.length > 0 ? 1 : warns.length > 0 && args.includes('--strict') ? 1 : 0)
