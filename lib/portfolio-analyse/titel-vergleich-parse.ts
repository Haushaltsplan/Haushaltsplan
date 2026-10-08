/**
 * Parst DE-formatierte Kennzahl-Strings inkl. Vorzeichen.
 * Wichtig: `pctMitVorzeichen` nutzt Unicode-Minus (−), `pctSigned` Klammern — beides negativ.
 */
export function parseDeZahl(raw: string | null | undefined): number | null {
  if (!raw) return null
  let t = raw.trim()
  if (!t || t === '–' || t === '-' || t === '—' || t === 'NM') return null

  // Trailing-Hinweise weg (Pp., ✓, ⚠, Risiko-Text)
  t = t.replace(/\s*(Pp\.|pp\.|✓|⚠).*$/i, '')
  // Beneish: „−2,10 (niedrig)“ → nur Zahlenteil
  t = t.replace(/\s+\([^)]*(niedrig|erhoeht|erhöht|hoch)[^)]*\)$/i, '')

  const inKlammern = /^\(.*\)$/.test(t.replace(/\s/g, ''))
  t = t
    .replace(/[()]/g, '')
    .replace(/%/g, '')
    .replace(/[x×$€]/gi, '')
    .replace(/\s/g, '')
    // Unicode-Minus / en-dash → ASCII
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .replace(/\./g, '')
    .replace(',', '.')

  const m = t.match(/^([+-]?)(.*)$/)
  if (!m) return null
  const signChar = m[1] ?? ''
  const body = (m[2] ?? '').replace(/[^\d.]/g, '')
  if (!body) return null
  let n = Number(`${signChar}${body}`)
  if (!Number.isFinite(n)) return null
  if (inKlammern && n > 0) n = -n
  return n
}
