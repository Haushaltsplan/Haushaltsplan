/**
 * Einmalige Migration: hardcodierte slate-* → CSS-Variablen (--app-*).
 * Längere Muster zuerst. Strava design-tokens ausgenommen.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')

const SKIP = new Set([
  path.join(ROOT, 'components/strava/design-tokens.ts'),
])

const REPLACEMENTS = [
  ['via-zinc-950/95', 'via-[var(--app-surface-muted)]'],
  ['via-zinc-950/90', 'via-[var(--app-surface-muted)]'],
  ['to-zinc-900/30', 'to-[var(--app-surface)]'],
  ['from-zinc-950', 'from-[var(--app-surface-muted)]'],
  ['divide-zinc-800/90', 'divide-[var(--app-border)]'],
  ['divide-zinc-800/70', 'divide-[var(--app-border)]'],
  ['divide-zinc-800/50', 'divide-[var(--app-border)]'],
  ['border-zinc-950/80', 'border-[var(--app-border)]'],
  ['border-zinc-950/60', 'border-[var(--app-border)]'],
  ['ring-slate-600/60', 'ring-[var(--app-border-strong)]/60'],
  ['ring-slate-600/80', 'ring-[var(--app-border-strong)]/80'],
  ['ring-slate-700/80', 'ring-[var(--app-border-strong)]/80'],
  ['decoration-slate-600', 'decoration-[var(--app-border-strong)]'],
  ['decoration-zinc-600', 'decoration-[var(--app-border-strong)]'],
  ['hover:bg-slate-700', 'hover:bg-[var(--app-surface-hover)]'],
  ['hover:bg-zinc-700/80', 'hover:bg-[var(--app-surface-hover)]'],
  ['bg-zinc-700/80', 'bg-[var(--app-surface-hover)]'],
  ['bg-zinc-700', 'bg-[var(--app-surface-muted)]'],
  ['bg-zinc-600', 'bg-[var(--app-surface-muted)]'],
  ['bg-zinc-500', 'bg-[var(--app-surface-muted)]'],
  ['text-zinc-50', 'text-[var(--app-text)]'],
  ['text-zinc-700', 'text-[var(--app-text-muted)]'],
  ['fill-slate-600', 'fill-[var(--app-text-muted)]'],
  ['fill-slate-500', 'fill-[var(--app-text-muted)]'],
  ['fill-zinc-600', 'fill-[var(--app-text-muted)]'],
  ['fill-zinc-500', 'fill-[var(--app-text-muted)]'],
  ['bg-zinc-300', 'bg-[var(--app-text-muted)]'],
  ['border-zinc-500', 'border-[var(--app-border-strong)]'],
  ['border-dashed border-zinc-500', 'border-dashed border-[var(--app-border-strong)]'],
  ['focus:ring-zinc-600', 'focus:ring-[var(--app-border-strong)]'],
  ['from-zinc-950/80', 'from-[var(--app-surface-muted)]'],
  ['to-zinc-950/80', 'to-[var(--app-surface)]'],
  ['from-zinc-900/95', 'from-[var(--app-surface-muted)]'],
  ['from-zinc-900/90', 'from-[var(--app-surface-muted)]'],
  ['from-zinc-900/80', 'from-[var(--app-surface-muted)]'],
  ['from-zinc-900/70', 'from-[var(--app-surface-muted)]'],
  ['from-zinc-900/60', 'from-[var(--app-surface-muted)]'],
  ['from-zinc-900/50', 'from-[var(--app-surface-muted)]'],
  ['to-zinc-900/95', 'to-[var(--app-surface)]'],
  ['to-zinc-900/90', 'to-[var(--app-surface)]'],
  ['to-zinc-900/80', 'to-[var(--app-surface)]'],
  ['to-zinc-900/70', 'to-[var(--app-surface)]'],
  ['to-zinc-900/60', 'to-[var(--app-surface)]'],
  ['to-zinc-900/50', 'to-[var(--app-surface)]'],
  ['bg-zinc-950/80', 'bg-[var(--app-surface-muted)]'],
  ['bg-zinc-950/60', 'bg-[var(--app-surface-muted)]'],
  ['bg-zinc-950/50', 'bg-[var(--app-surface-muted)]'],
  ['bg-zinc-950/40', 'bg-[var(--app-surface-muted)]'],
  ['bg-zinc-900/95', 'bg-[var(--app-surface-muted)]'],
  ['bg-zinc-900/90', 'bg-[var(--app-surface-muted)]'],
  ['bg-zinc-900/80', 'bg-[var(--app-surface-muted)]'],
  ['bg-zinc-900/70', 'bg-[var(--app-surface-muted)]'],
  ['bg-zinc-900/60', 'bg-[var(--app-surface-muted)]'],
  ['bg-zinc-900/50', 'bg-[var(--app-surface-muted)]'],
  ['bg-zinc-900/40', 'bg-[var(--app-surface-muted)]'],
  ['bg-zinc-800/80', 'bg-[var(--app-surface-hover)]'],
  ['bg-zinc-800/60', 'bg-[var(--app-surface-hover)]'],
  ['bg-zinc-800/50', 'bg-[var(--app-surface-hover)]'],
  ['hover:bg-zinc-800/80', 'hover:bg-[var(--app-surface-hover)]'],
  ['hover:bg-zinc-800/60', 'hover:bg-[var(--app-surface-hover)]'],
  ['hover:bg-zinc-800/50', 'hover:bg-[var(--app-surface-hover)]'],
  ['hover:bg-zinc-800/40', 'hover:bg-[var(--app-surface-hover)]'],
  ['hover:bg-zinc-800', 'hover:bg-[var(--app-surface-hover)]'],
  ['border-zinc-800/90', 'border-[var(--app-border)]'],
  ['border-zinc-800/80', 'border-[var(--app-border)]'],
  ['border-zinc-800/60', 'border-[var(--app-border)]'],
  ['border-zinc-700/90', 'border-[var(--app-border-strong)]'],
  ['border-zinc-700/80', 'border-[var(--app-border-strong)]'],
  ['border-zinc-700/70', 'border-[var(--app-border-strong)]'],
  ['border-zinc-700/60', 'border-[var(--app-border-strong)]'],
  ['border-zinc-700/50', 'border-[var(--app-border-strong)]'],
  ['border-zinc-600/80', 'border-[var(--app-border-strong)]'],
  ['border-zinc-600/60', 'border-[var(--app-border-strong)]'],
  ['text-zinc-600', 'text-[var(--app-text-muted)]'],
  ['text-zinc-500', 'text-[var(--app-text-muted)]'],
  ['text-zinc-400', 'text-[var(--app-text-muted)]'],
  ['text-zinc-300', 'text-[var(--app-text)]'],
  ['text-zinc-200', 'text-[var(--app-text)]'],
  ['text-zinc-100', 'text-[var(--app-text)]'],
  ['divide-zinc-800/80', 'divide-[var(--app-border)]'],
  ['divide-zinc-800/60', 'divide-[var(--app-border)]'],
  ['border-zinc-800', 'border-[var(--app-border)]'],
  ['border-zinc-700', 'border-[var(--app-border-strong)]'],
  ['border-zinc-600', 'border-[var(--app-border-strong)]'],
  ['bg-zinc-950', 'bg-[var(--app-surface-muted)]'],
  ['bg-zinc-900', 'bg-[var(--app-surface-muted)]'],
  ['bg-zinc-800', 'bg-[var(--app-surface-muted)]'],
  ['from-slate-900 to-slate-950', 'from-[var(--app-surface-muted)] to-[var(--app-surface)]'],
  ['placeholder:text-slate-600', 'placeholder:text-[var(--app-text-muted)]'],
  ['divide-slate-800/80', 'divide-[var(--app-border)]'],
  ['divide-slate-800/60', 'divide-[var(--app-border)]'],
  ['ring-offset-slate-900', 'ring-offset-[var(--app-surface)]'],
  ['border-slate-800/90', 'border-[var(--app-border)]'],
  ['border-slate-800/80', 'border-[var(--app-border)]'],
  ['border-slate-800/60', 'border-[var(--app-border)]'],
  ['border-slate-700/90', 'border-[var(--app-border-strong)]'],
  ['border-slate-700/80', 'border-[var(--app-border-strong)]'],
  ['border-slate-700/70', 'border-[var(--app-border-strong)]'],
  ['border-slate-700/60', 'border-[var(--app-border-strong)]'],
  ['border-slate-600/90', 'border-[var(--app-border-strong)]'],
  ['border-slate-600/80', 'border-[var(--app-border-strong)]'],
  ['border-slate-600/60', 'border-[var(--app-border-strong)]'],
  ['bg-slate-950/90', 'bg-[var(--app-surface-muted)]'],
  ['bg-slate-950/80', 'bg-[var(--app-surface-muted)]'],
  ['bg-slate-950/70', 'bg-[var(--app-surface-muted)]'],
  ['bg-slate-950/60', 'bg-[var(--app-surface-muted)]'],
  ['bg-slate-950/50', 'bg-[var(--app-surface-muted)]'],
  ['bg-slate-950/45', 'bg-[var(--app-surface-muted)]'],
  ['bg-slate-950/40', 'bg-[var(--app-surface-muted)]'],
  ['bg-slate-950/35', 'bg-[var(--app-surface-muted)]'],
  ['bg-slate-900/95', 'bg-[var(--app-surface-muted)]'],
  ['bg-slate-900/90', 'bg-[var(--app-surface-muted)]'],
  ['bg-slate-900/80', 'bg-[var(--app-surface-muted)]'],
  ['bg-slate-900/70', 'bg-[var(--app-surface-muted)]'],
  ['bg-slate-900/60', 'bg-[var(--app-surface-muted)]'],
  ['hover:bg-slate-800/80', 'hover:bg-[var(--app-surface-hover)]'],
  ['hover:bg-slate-800/40', 'hover:bg-[var(--app-surface-hover)]'],
  ['hover:bg-slate-800/25', 'hover:bg-[var(--app-surface-hover)]'],
  ['bg-slate-800/80', 'bg-[var(--app-surface-hover)]'],
  ['bg-slate-800/60', 'bg-[var(--app-surface-hover)]'],
  ['bg-slate-800/50', 'bg-[var(--app-surface-hover)]'],
  ['bg-slate-800/40', 'bg-[var(--app-surface-hover)]'],
  ['bg-slate-800/25', 'bg-[var(--app-surface-hover)]'],
  ['hover:text-slate-200', 'hover:text-[var(--app-text)]'],
  ['hover:text-slate-300', 'hover:text-[var(--app-text)]'],
  ['hover:border-slate-600', 'hover:border-[var(--app-border-strong)]'],
  ['hover:border-slate-500', 'hover:border-[var(--app-border-strong)]'],
  ['hover:bg-slate-800', 'hover:bg-[var(--app-surface-hover)]'],
  ['text-slate-600', 'text-[var(--app-text-muted)]'],
  ['text-slate-500', 'text-[var(--app-text-muted)]'],
  ['text-slate-400', 'text-[var(--app-text-muted)]'],
  ['text-slate-300', 'text-[var(--app-text)]'],
  ['text-slate-200', 'text-[var(--app-text)]'],
  ['text-slate-100', 'text-[var(--app-text)]'],
  ['border-slate-800', 'border-[var(--app-border)]'],
  ['border-slate-700', 'border-[var(--app-border-strong)]'],
  ['border-slate-600', 'border-[var(--app-border-strong)]'],
  ['bg-slate-950', 'bg-[var(--app-surface-muted)]'],
  ['bg-slate-900', 'bg-[var(--app-surface-muted)]'],
  ['bg-slate-800', 'bg-[var(--app-surface-muted)]'],
]

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (SKIP.has(p)) continue
    const st = fs.statSync(p)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.git') continue
      walk(p, out)
    } else if (/\.(tsx|ts)$/.test(name)) {
      out.push(p)
    }
  }
  return out
}

function migrateFile(filePath) {
  let src = fs.readFileSync(filePath, 'utf8')
  if (!src.includes('slate-') && !src.includes('zinc-')) return false
  const before = src
  for (const [from, to] of REPLACEMENTS) {
    src = src.split(from).join(to)
  }
  if (src === before) return false
  fs.writeFileSync(filePath, src, 'utf8')
  return true
}

const dirs = [
  path.join(ROOT, 'app'),
  path.join(ROOT, 'components'),
  path.join(ROOT, 'lib'),
]

let changed = 0
for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue
  for (const f of walk(dir)) {
    if (migrateFile(f)) {
      changed++
      console.log('updated:', path.relative(ROOT, f))
    }
  }
}
console.log(`\nDone: ${changed} files updated.`)
