/**
 * Editorial SVG-Vorschaubild für Aktienanalysen (kein externes Image-Gen nötig).
 */

import type { AktienanalyseCover, AktienanalyseCoverTon } from '@/lib/portfolio-analyse/aktienanalyse-prompt'

const TON_FARBE: Record<
  AktienanalyseCoverTon,
  { accent: string; accentSoft: string; glow: string; label: string }
> = {
  positiv: {
    accent: '#34d399',
    accentSoft: '#059669',
    glow: 'rgba(52,211,153,0.35)',
    label: 'Konstruktiv',
  },
  neutral: {
    accent: '#5eead4',
    accentSoft: '#0d9488',
    glow: 'rgba(45,212,191,0.32)',
    label: 'Neutral',
  },
  vorsichtig: {
    accent: '#fbbf24',
    accentSoft: '#d97706',
    glow: 'rgba(251,191,36,0.28)',
    label: 'Vorsichtig',
  },
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (next.length > maxChars && cur) {
      lines.push(cur)
      cur = w
      if (lines.length >= maxLines) break
    } else {
      cur = next
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur)
  return lines.slice(0, maxLines)
}

function hashHue(ticker: string): number {
  let h = 0
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) >>> 0
  return 160 + (h % 40) // teal–cyan Band
}

export function baueAktienanalyseThumbnailSvg(opts: {
  ticker: string
  titel: string
  cover: AktienanalyseCover
  createdAt?: string
}): string {
  const ticker = (opts.ticker || '—').toUpperCase().slice(0, 12)
  const ton = TON_FARBE[opts.cover.ton] ?? TON_FARBE.neutral
  const hue = hashHue(ticker)
  const stichwort = (opts.cover.stichwort || 'Research').toUpperCase().slice(0, 22)
  const untertitelLines = wrapLines(opts.cover.untertitel || opts.titel, 42, 2)
  const titelLines = wrapLines(opts.titel, 36, 2)
  const datum = opts.createdAt
    ? new Date(opts.createdAt).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : ''

  const unterY = 268
  const unterTspans = untertitelLines
    .map(
      (line, i) =>
        `<tspan x="48" dy="${i === 0 ? 0 : 22}">${esc(line)}</tspan>`,
    )
    .join('')

  const titelTspans = titelLines
    .map(
      (line, i) =>
        `<tspan x="48" dy="${i === 0 ? 0 : 34}">${esc(line)}</tspan>`,
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" role="img" aria-label="${esc(ticker)} Analyse">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="hsl(${hue}, 28%, 9%)"/>
      <stop offset="55%" stop-color="#0b1220"/>
      <stop offset="100%" stop-color="hsl(${hue + 20}, 22%, 7%)"/>
    </linearGradient>
    <linearGradient id="shine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${ton.accent}" stop-opacity="0"/>
      <stop offset="45%" stop-color="${ton.accent}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${ton.accentSoft}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="orb" cx="78%" cy="22%" r="45%">
      <stop offset="0%" stop-color="${ton.glow}"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M32 0H0V32" fill="none" stroke="rgba(148,163,184,0.07)" stroke-width="1"/>
    </pattern>
  </defs>

  <rect width="640" height="360" rx="0" fill="url(#bg)"/>
  <rect width="640" height="360" fill="url(#orb)"/>
  <rect width="640" height="360" fill="url(#grid)"/>

  <!-- linke Accent-Leiste -->
  <rect x="0" y="0" width="6" height="360" fill="${ton.accent}"/>

  <!-- dekorative Chart-Silhouette -->
  <path d="M390 290 L430 250 L470 265 L520 200 L560 220 L600 170"
        fill="none" stroke="${ton.accent}" stroke-opacity="0.35" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M390 290 L430 250 L470 265 L520 200 L560 220 L600 170 L600 310 L390 310 Z"
        fill="${ton.accent}" fill-opacity="0.08"/>

  <!-- Meta -->
  <text x="48" y="48" fill="rgba(148,163,184,0.85)" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" letter-spacing="2.2" font-weight="600">EQUITY RESEARCH</text>
  <text x="592" y="48" text-anchor="end" fill="rgba(148,163,184,0.7)" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12">${esc(datum)}</text>

  <!-- Badge -->
  <rect x="48" y="68" rx="6" ry="6" width="${Math.max(72, stichwort.length * 9 + 24)}" height="26" fill="${ton.accent}" fill-opacity="0.16" stroke="${ton.accent}" stroke-opacity="0.45"/>
  <text x="60" y="86" fill="${ton.accent}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" font-weight="700" letter-spacing="1.4">${esc(stichwort)}</text>

  <!-- Ticker -->
  <text x="48" y="148" fill="#f8fafc" font-family="ui-sans-serif, system-ui, sans-serif" font-size="56" font-weight="800" letter-spacing="-1.5">${esc(ticker)}</text>

  <!-- Titel -->
  <text y="188" fill="rgba(226,232,240,0.95)" font-family="Georgia, 'Times New Roman', serif" font-size="22" font-weight="600">${titelTspans}</text>

  <!-- Shine-Linie -->
  <rect x="48" y="248" width="220" height="2" rx="1" fill="url(#shine)"/>

  <!-- Untertitel -->
  <text y="${unterY}" fill="rgba(148,163,184,0.95)" font-family="ui-sans-serif, system-ui, sans-serif" font-size="14" font-weight="500">${unterTspans}</text>

  <!-- Ton -->
  <circle cx="56" cy="328" r="5" fill="${ton.accent}"/>
  <text x="70" y="332" fill="rgba(203,213,225,0.9)" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" font-weight="600">${esc(ton.label)}</text>
  <text x="592" y="332" text-anchor="end" fill="rgba(100,116,139,0.9)" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" letter-spacing="1">MEIN HAUSHALT</text>
</svg>`
}

export function thumbnailSvgAlsDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22')
  return `data:image/svg+xml;charset=utf-8,${encoded}`
}
