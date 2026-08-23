#!/usr/bin/env node
/**
 * Prüft ob Cursor-Hooks für mein-haushalt konfiguriert sind.
 * Aufruf: npm run check:hooks
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const USER_CURSOR = path.join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.cursor')

function ok(msg) {
  console.log(`  ✓ ${msg}`)
}
function warn(msg) {
  console.log(`  ⚠ ${msg}`)
}
function fail(msg) {
  console.log(`  ✗ ${msg}`)
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

console.log('Cursor Hooks — Diagnose für mein-haushalt\n')

const projectHooks = path.join(ROOT, '.cursor/hooks.json')
const projectScript = path.join(ROOT, '.cursor/hooks/portfolio-audit-stop.mjs')
const userHooks = path.join(USER_CURSOR, 'hooks.json')
const userScript = path.join(USER_CURSOR, 'hooks/portfolio-audit-stop.mjs')

let errors = 0

if (fs.existsSync(projectHooks)) {
  const j = readJson(projectHooks)
  if (j?.version === 1 && j?.hooks?.stop?.length) ok('Projekt: .cursor/hooks.json (version 1, stop-Hook)')
  else {
    fail('Projekt: .cursor/hooks.json ungültig (version 1 + hooks.stop nötig)')
    errors++
  }
} else {
  fail('Projekt: .cursor/hooks.json fehlt')
  errors++
}

if (fs.existsSync(projectScript)) ok('Projekt: Hook-Skript vorhanden')
else {
  fail('Projekt: .cursor/hooks/portfolio-audit-stop.mjs fehlt')
  errors++
}

if (fs.existsSync(userHooks)) {
  const j = readJson(userHooks)
  if (j?.version === 1) ok('User: ~/.cursor/hooks.json vorhanden')
  else warn('User: ~/.cursor/hooks.json ohne version 1')
} else {
  warn('User: ~/.cursor/hooks.json fehlt (optional, Backup)')
}

if (fs.existsSync(userScript)) ok('User: ~/.cursor/hooks/portfolio-audit-stop.mjs')
else warn('User: Weiterleitungs-Hook fehlt')

console.log('\nWichtig — Hooks in der UI finden:')
console.log('  1. Cursor im IDE-Modus öffnen (nicht nur Agents/Glass-Fenster)')
console.log('     → Ctrl+Shift+N oder Menü: Open IDE')
console.log('  2. Ordner direkt öffnen: c:\\Users\\dassd\\mein-haushalt')
console.log('  3. Workspace vertrauen wenn gefragt')
console.log('  4. Cursor Settings (Ctrl+,) → Suche: „Hooks“')
console.log('     oder Zahnrad → Customize → Tab „Hooks“')
console.log('  5. Output: Ctrl+Shift+P → „Hooks“ Output-Kanal')

console.log('\nEs gibt keinen separaten „Hooks einschalten“-Schalter.')
console.log('Hooks laufen automatisch wenn hooks.json gültig ist + Workspace trusted.\n')

process.exit(errors > 0 ? 1 : 0)
