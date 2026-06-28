#!/usr/bin/env node
/**
 * Fügt app-data-table zu <table>-Elementen hinzu (falls noch nicht vorhanden).
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const DIRS = ['app', 'components', 'lib'].map((d) => path.join(ROOT, d))
const SKIP = /node_modules|\.next|strava-season-export/

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (SKIP.test(p)) continue
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(tsx|ts|jsx|js)$/.test(name)) out.push(p)
  }
  return out
}

let changed = 0
for (const file of DIRS.flatMap((d) => walk(d))) {
  let src = fs.readFileSync(file, 'utf8')
  if (!src.includes('<table')) continue
  const next = src.replace(/<table className="([^"]*)">/g, (full, cls) => {
    if (cls.includes('app-data-table')) return full
    return `<table className="app-data-table ${cls}">`
  })
  if (next !== src) {
    fs.writeFileSync(file, next)
    changed++
    console.log('updated:', path.relative(ROOT, file))
  }
}
console.log(`migrate-tables-premium: ${changed} file(s)`)
