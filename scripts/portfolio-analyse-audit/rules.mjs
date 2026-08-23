/**
 * Statische Audit-Regeln für lib/portfolio-analyse.
 * Jede Regel: id, severity (error|warn|info), description, test(filePath, content) -> findings[]
 */

const PA_ROOT = 'lib/portfolio-analyse/'

/** @param {string} content @param {number} index */
function lineNumber(content, index) {
  return content.slice(0, index).split('\n').length
}

/** @param {string} content @param {RegExp} re */
function allMatches(content, re) {
  const out = []
  for (const m of content.matchAll(re)) {
    out.push({ line: lineNumber(content, m.index ?? 0), excerpt: m[0].slice(0, 120) })
  }
  return out
}

/** @type {import('./types.mjs').AuditRule[]} */
export const RULES = [
  {
    id: 'json-stringify-truncate',
    severity: 'error',
    category: 'frontend-crash',
    description:
      'kuerze(JSON.stringify(...)) erzeugt abgeschnittenes JSON — Frontend JSON.parse stürzt ab.',
    hint: 'datenSignale als kompaktes Objekt oder formatZusatzSignaleKurz; niemals mid-JSON kürzen.',
    test(filePath, content) {
      if (!filePath.includes('portfolio-berater') && !filePath.includes('berater-kontext')) return []
      return allMatches(content, /kuerze\s*\(\s*JSON\.stringify\s*\(/g)
    },
  },
  {
    id: 'timeout-berater-unter-macrotrends',
    severity: 'error',
    category: 'live-daten',
    description:
      'Berater LOAD_TIMEOUT_MS muss ≥ Macrotrends FETCH_TIMEOUT_MS sein, sonst Scan-Fallback für alle Titel.',
    hint: 'LOAD_TIMEOUT_MS in portfolio-berater-fundamentaldaten-server.ts auf ≥ FETCH_TIMEOUT + Puffer setzen.',
    test(filePath, content) {
      if (!filePath.endsWith('portfolio-berater-fundamentaldaten-server.ts')) return []
      const load = content.match(/LOAD_TIMEOUT_MS\s*=\s*(\d+)/)?.[1]
      if (!load) return [{ line: 1, excerpt: 'LOAD_TIMEOUT_MS fehlt' }]
      return []
    },
    /** Cross-file — wird in run.mjs separat geprüft */
    crossFile: true,
  },
  {
    id: 'ticker-blind-suffix-strip',
    severity: 'warn',
    category: 'ticker-chaos',
    description:
      'Blindes symbolYahoo.split(".")[0] für Analyse-Ticker — Watchlist .DE / Halma H11→HLMA.',
    hint: 'analyseTickerFuerPosition(isin, symbolYahoo) aus isin-kenntnisse.ts verwenden.',
    test(filePath, content) {
      if (!filePath.includes('nachkauf-radar/')) return []
      if (filePath.includes('insider-kaeufe-server.ts')) {
        if (content.includes('analyseTickerFuerPosition')) return []
        if (/\.split\s*\(\s*['"]\.['"]\s*\)\s*\[\s*0\s*\]/.test(content)) {
          return allMatches(content, /\.split\s*\(\s*['"]\.['"]\s*\)\s*\[\s*0\s*\]/g).slice(0, 3)
        }
      }
      // Depot-Gewicht-Lookup: Kurs-Symbol-Bare ist OK (kein Macrotrends-Ticker)
      if (filePath.includes('nachkauf-radar-db-server.ts')) return []
      const risky =
        /(?:ticker|sym)\s*=.*\.split\s*\(\s*['"]\.['"]\s*\)\s*\[\s*0\s*\]/.test(content) ||
        /symbolYahoo\?\.split\s*\(\s*['"]\.['"]\s*\)\s*\[\s*0\s*\]/.test(content)
      if (!risky) return []
      if (content.includes('analyseTickerFuerPosition')) return []
      return allMatches(
        content,
        /(?:ticker|sym|symbolYahoo)[^;\n]{0,80}\.split\s*\(\s*['"]\.['"]\s*\)\s*\[\s*0\s*\]/g,
      ).slice(0, 5)
    },
  },
  {
    id: 'kaufempfehlung-beobachtung',
    severity: 'warn',
    category: 'ki-logik',
    description:
      'Kaufempfehlung muss filterBeobachtungsKandidaten + Prompt-Sektion für ueberpruefen haben.',
    hint: 'Trim-Signale aktion=ueberpruefen dürfen nicht als „keine Verkaufssignale“ verschwinden.',
    test(filePath, content) {
      if (!filePath.endsWith('nachkauf-kaufempfehlung-server.ts')) return []
      const missing = []
      if (!content.includes('filterBeobachtungsKandidaten')) {
        missing.push({ line: 1, excerpt: 'filterBeobachtungsKandidaten fehlt' })
      }
      if (!content.includes('baueBeobachtungsKandidatenText')) {
        missing.push({ line: 1, excerpt: 'baueBeobachtungsKandidatenText fehlt' })
      }
      if (/Keine Verkaufs-Signale/.test(content) && !content.includes('beobachtung')) {
        missing.push({ line: 1, excerpt: 'Hardcoded „Keine Verkaufs-Signale“ ohne Beobachtungs-Check' })
      }
      return missing
    },
  },
  {
    id: 'insider-eu-nach-us',
    severity: 'warn',
    category: 'insider-desync',
    description: 'EU-Insider: US/ADR-Pfad darf leeres neutral vor AMF/DGAP nicht akzeptieren.',
    hint: 'ladeInsiderNettoMitEuFallback: EU zuerst; US nur bei kaeufe90d>0 || verkaeufe90d>0.',
    test(filePath, content) {
      if (!filePath.endsWith('fundamentaldaten-erweitert-server.ts')) return []
      const start = content.indexOf('async function ladeInsiderNettoMitEuFallback')
      if (start < 0) return [{ line: 1, excerpt: 'ladeInsiderNettoMitEuFallback nicht gefunden' }]
      const fnBody = content.slice(start, start + 2000)
      const euIdx = fnBody.indexOf('await ladeEuInsiderNettoAggregiert')
      const usIdx = fnBody.indexOf('await ladeInsiderNettoHandel')
      if (euIdx < 0 || usIdx < 0) return []
      if (euIdx > usIdx) {
        return [{ line: 1, excerpt: 'EU-Fallback nicht vor US-Pfad' }]
      }
      if (/nettoRichtung\s*!=\s*null/.test(fnBody) && !fnBody.includes('kaeufe90d > 0')) {
        return [{ line: 1, excerpt: 'US akzeptiert noch leeres neutral ohne Aktivität' }]
      }
      return []
    },
  },
  {
    id: 'hardcoded-isin-logik',
    severity: 'info',
    category: 'klasse-statt-beispiel',
    description: 'Hardcoded Einzel-ISIN in Logik (Beispiel-Lock statt Klasse).',
    hint: 'istEuIsin / brauchtEuGuVFallback / isinKenntnis — siehe .cursor/rules/beispiel-gilt-fuer-klasse.mdc.',
    test(filePath, content) {
      if (filePath.includes('isin-kenntnisse.ts') || filePath.includes('-config.ts')) return []
      if (filePath.includes('whitelist.ts') || filePath.includes('marketscreener-slug')) return []
      return allMatches(content, /(?:===|startsWith\()\s*['"]FR0000052292['"]/g)
    },
  },
  {
    id: 'daten-signale-kompakt-export',
    severity: 'info',
    category: 'frontend-crash',
    description: 'Berater-Kontext soll datenSignaleKompakt nutzen (kein String-JSON).',
    hint: 'scanZeileVoll → datenSignale: datenSignaleKompakt(...).',
    test(filePath, content) {
      if (!filePath.endsWith('portfolio-berater-kontext-server.ts')) return []
      if (content.includes('datenSignaleKompakt')) return []
      if (content.includes('datenSignale: e.datenSignale')) return []
      return [{ line: 1, excerpt: 'datenSignaleKompakt fehlt in scanZeileVoll' }]
    },
  },
]

/** Numerisches Literal mit optionalen Underscores (55_000 → 55000) */
function parseNumLiteral(raw) {
  return Number(String(raw).replace(/_/g, ''))
}

/**
 * Cross-file: Timeout-Berater vs. Macrotrends
 * @param {Record<string, string>} files
 */
export function checkTimeoutAlignment(files) {
  const berater = files['lib/portfolio-analyse/portfolio-berater-fundamentaldaten-server.ts']
  const macro = files['lib/portfolio-analyse/macrotrends-scraper-server.ts']
  if (!berater || !macro) return []

  const loadMs = parseNumLiteral(berater.match(/LOAD_TIMEOUT_MS\s*=\s*([\d_]+)/)?.[1] ?? 0)
  const fetchMs = parseNumLiteral(macro.match(/FETCH_TIMEOUT_MS\s*=\s*([\d_]+)/)?.[1] ?? 0)
  if (loadMs > 0 && fetchMs > 0 && loadMs < fetchMs + 5_000) {
    return [
      {
        ruleId: 'timeout-berater-unter-macrotrends',
        severity: 'error',
        file: 'lib/portfolio-analyse/portfolio-berater-fundamentaldaten-server.ts',
        line: berater.split('\n').findIndex((l) => l.includes('LOAD_TIMEOUT_MS')) + 1,
        message: `LOAD_TIMEOUT_MS=${loadMs} < FETCH_TIMEOUT_MS=${fetchMs}+5000 — Live-Fundamentaldaten timeouten`,
        hint: 'LOAD_TIMEOUT_MS auf mindestens FETCH_TIMEOUT_MS + 5000 erhöhen.',
      },
    ]
  }
  return []
}

export { PA_ROOT }
