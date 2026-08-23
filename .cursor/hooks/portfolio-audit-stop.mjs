#!/usr/bin/env node
/**
 * Cursor stop-Hook: Portfolio-Audit wenn portfolio-analyse geändert wurde.
 * Gibt followup_message zurück wenn Fehler gefunden — Agent soll nachfixen.
 */
import { execSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '../..')

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8')
  } catch {
    return '{}'
  }
}

function portfolioFilesChanged() {
  try {
    const unstaged = execSync('git diff --name-only', { cwd: ROOT, encoding: 'utf8' })
    const staged = execSync('git diff --cached --name-only', { cwd: ROOT, encoding: 'utf8' })
    const all = `${unstaged}\n${staged}`
    return /lib\/portfolio-analyse\/|components\/portfolio-analyse\//.test(all)
  } catch {
    return false
  }
}

function main() {
  readStdin() // Cursor übergibt Session-Kontext — derzeit nicht ausgewertet

  if (!portfolioFilesChanged()) {
    process.exit(0)
  }

  const res = spawnSync('node', ['scripts/portfolio-analyse-audit/run.mjs', '--quiet'], {
    cwd: ROOT,
    encoding: 'utf8',
  })

  if (res.status === 0) {
    process.exit(0)
  }

  const detail = (res.stdout || res.stderr || '').trim().slice(0, 800)
  const msg =
    'Portfolio-Analyse-Audit fehlgeschlagen nach deinen Änderungen. ' +
    'Führe `npm run audit:portfolio -- --fix-hints` aus, behebe alle ERROR-Befunde klassenübergreifend ' +
    '(Skill: portfolio-analyse-audit), und starte das Audit erneut bis Exit-Code 0.' +
    (detail ? `\n\nAudit-Auszug:\n${detail}` : '')

  console.log(JSON.stringify({ followup_message: msg }))
  process.exit(0)
}

main()
