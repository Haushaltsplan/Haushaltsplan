/**
 * Mitarbeiter-Fragen als druckbares HTML (Browser → PDF).
 * Nur Gesamtstatistik + gebündelte Fragen — ohne Personen-Aufschlüsselung.
 */

import {
  summeMitarbeiterFragenSplit,
  type FuehrungMitarbeiterTag,
  type FuehrungState,
} from '@/lib/fuehrung/store'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDe(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function addDaysIso(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + delta)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Mo–Do der Woche ab Montag-ISO. */
export const FUEHRUNG_WOCHENTAGE_MO_DO = [
  { offset: 0, label: 'Montag', kurz: 'Mo' },
  { offset: 1, label: 'Dienstag', kurz: 'Di' },
  { offset: 2, label: 'Mittwoch', kurz: 'Mi' },
  { offset: 3, label: 'Donnerstag', kurz: 'Do' },
] as const

export function frageZeilenAusNotizen(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[·\-–•*]\s*/, '').trim())
    .filter(Boolean)
}

function normalizeFrage(line: string): string {
  return line
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/[.!?…]+$/g, '')
    .trim()
}

export type GebuendelteFrage = { text: string; anzahl: number }

/** Gleiche / sehr ähnliche Zeilen zusammenfassen → ×2, ×3 … */
export function buendelFragen(zeilen: string[]): GebuendelteFrage[] {
  const map = new Map<string, GebuendelteFrage>()
  for (const raw of zeilen) {
    const key = normalizeFrage(raw)
    if (!key) continue
    const cur = map.get(key)
    if (cur) cur.anzahl += 1
    else map.set(key, { text: raw, anzahl: 1 })
  }
  return [...map.values()].sort((a, b) => b.anzahl - a.anzahl || a.text.localeCompare(b.text, 'de'))
}

export function sammleFragenAusTage(
  tage: FuehrungMitarbeiterTag[],
  vonIso: string,
  bisIso: string,
): { wichtig: GebuendelteFrage[]; unnoetig: GebuendelteFrage[] } {
  const wichtigZeilen: string[] = []
  const unnoetigZeilen: string[] = []
  for (const t of tage) {
    if (t.datum < vonIso || t.datum > bisIso) continue
    wichtigZeilen.push(...frageZeilenAusNotizen(t.notizenWichtig))
    unnoetigZeilen.push(...frageZeilenAusNotizen(t.notizenUnnoetig))
  }
  return {
    wichtig: buendelFragen(wichtigZeilen),
    unnoetig: buendelFragen(unnoetigZeilen),
  }
}

function fragenListeHtml(items: GebuendelteFrage[]): string {
  if (items.length === 0) return '<p class="muted">Noch keine Notizen.</p>'
  return `<ul>${items
    .map((f) => {
      const mark = f.anzahl > 1 ? ` <span class="x">×${f.anzahl}</span>` : ''
      return `<li>${esc(f.text)}${mark}</li>`
    })
    .join('')}</ul>`
}

export function buildMitarbeiterGespraechHtml(
  state: FuehrungState,
  vonIso: string,
  bisIso: string,
): string {
  const split = summeMitarbeiterFragenSplit(state.mitarbeiterTage, vonIso, bisIso)
  const fragen = sammleFragenAusTage(state.mitarbeiterTage, vonIso, bisIso)
  const erstellt = new Date().toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const tagRows = FUEHRUNG_WOCHENTAGE_MO_DO.map((tag) => {
    const datum = addDaysIso(vonIso, tag.offset)
    if (datum > bisIso) {
      return `<tr>
        <td>${esc(tag.label)}</td>
        <td class="num muted-cell">—</td>
        <td class="num muted-cell">—</td>
        <td class="num muted-cell">—</td>
      </tr>`
    }
    const s = summeMitarbeiterFragenSplit(state.mitarbeiterTage, datum, datum)
    return `<tr>
      <td>${esc(tag.label)} <span class="day-date">${esc(formatDe(datum))}</span></td>
      <td class="num">${s.gesamt}</td>
      <td class="num ok">${s.wichtig}</td>
      <td class="num warn">${s.unnoetig}</td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>Teamgespräch · Fragen an die Führung</title>
  <style>
    @page { margin: 16mm 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      color: #1a1f24;
      margin: 0;
      padding: 28px 32px 40px;
      font-size: 11.5px;
      line-height: 1.5;
      background: #fff;
    }
    .brand {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #0f766e;
      margin: 0 0 6px;
    }
    h1 {
      font-size: 22px;
      margin: 0 0 6px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #0f172a;
    }
    .lead {
      font-size: 13px;
      color: #334155;
      max-width: 38rem;
      margin: 0 0 18px;
    }
    .meta { color: #64748b; margin: 0 0 20px; font-size: 11px; }
    .kpis {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin: 0 0 22px;
    }
    .kpi {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      background: #f8fafc;
    }
    .kpi span { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
    .kpi strong { display: block; font-size: 22px; margin-top: 2px; color: #0f172a; }
    .kpi.ok { border-color: #99f6e4; background: #f0fdfa; }
    .kpi.ok strong { color: #0f766e; }
    .kpi.warn { border-color: #fde68a; background: #fffbeb; }
    .kpi.warn strong { color: #b45309; }
    h2 {
      font-size: 13px;
      margin: 22px 0 8px;
      padding-bottom: 5px;
      border-bottom: 2px solid #0f766e;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
    th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; width: 72px; }
    td.ok { color: #0f766e; font-weight: 600; }
    td.warn { color: #b45309; font-weight: 600; }
    .day-date { color: #94a3b8; font-weight: 400; font-size: 10px; margin-left: 6px; }
    .muted-cell { color: #cbd5e1; }
    .legend {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin: 8px 0 4px;
    }
    .legend div {
      border-radius: 10px;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
    }
    .legend .ok { background: #f0fdfa; border-color: #99f6e4; }
    .legend .warn { background: #fffbeb; border-color: #fde68a; }
    .legend strong { display: block; margin-bottom: 2px; }
    .box {
      border-radius: 12px;
      padding: 12px 14px;
      margin-top: 8px;
      break-inside: avoid;
    }
    .box.ok { background: #f0fdfa; border: 1px solid #99f6e4; }
    .box.warn { background: #fffbeb; border: 1px solid #fde68a; }
    .box-label {
      margin: 0 0 8px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 700;
      color: #475569;
    }
    ul { margin: 0; padding-left: 1.15rem; }
    li { margin: 4px 0; }
    .x {
      display: inline-block;
      margin-left: 4px;
      padding: 0 6px;
      border-radius: 999px;
      background: #e2e8f0;
      font-size: 10px;
      font-weight: 700;
      color: #334155;
      vertical-align: middle;
    }
    .muted { color: #94a3b8; font-style: italic; margin: 0; }
    .outro {
      margin-top: 24px;
      padding: 14px 16px;
      border-radius: 12px;
      background: #f1f5f9;
      border-left: 4px solid #0f766e;
    }
    .outro p { margin: 0 0 6px; }
    .outro p:last-child { margin: 0; }
    .footer { margin-top: 28px; color: #94a3b8; font-size: 10px; }
    @media print {
      body { padding: 0; }
      .box { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <p class="brand">Stellv. Leiter Hartware · Teamgespräch</p>
  <h1>Fragen an die Führung — Überblick</h1>
  <p class="lead">
    Kurz und offen: Wie oft wurde ich als erste Anlaufstelle genutzt — und welche Fragen
    waren wirklich Führungsarbeit, welche hätten im Team selbst gelöst werden können.
  </p>
  <p class="meta">Zeitraum ${esc(formatDe(vonIso))} – ${esc(formatDe(bisIso))} · erstellt ${esc(erstellt)}</p>

  <div class="kpis">
    <div class="kpi"><span>Fragen gesamt</span><strong>${split.gesamt}</strong></div>
    <div class="kpi ok"><span>Wirklich wichtig</span><strong>${split.wichtig}</strong></div>
    <div class="kpi warn"><span>Ohne mich lösbar</span><strong>${split.unnoetig}</strong></div>
  </div>

  <div class="legend">
    <div class="ok">
      <strong>Wirklich wichtig</strong>
      Brauchte eine Führungsentscheidung, Eskalation oder echten Input von mir.
    </div>
    <div class="warn">
      <strong>Unnötig / ohne mich lösbar</strong>
      Wissen, Prozess oder Entscheidung lag im Team — ich war der kurze Weg.
    </div>
  </div>

  <h2>Nach Wochentag</h2>
  <table>
    <thead>
      <tr>
        <th>Tag</th>
        <th style="text-align:right">Gesamt</th>
        <th style="text-align:right">Wichtig</th>
        <th style="text-align:right">Unnötig</th>
      </tr>
    </thead>
    <tbody>${tagRows}</tbody>
  </table>

  <h2>Die Fragen</h2>
  <div class="box ok">
    <p class="box-label">Wirklich wichtig</p>
    ${fragenListeHtml(fragen.wichtig)}
  </div>
  <div class="box warn">
    <p class="box-label">Könnte ohne Führung gelöst werden</p>
    ${fragenListeHtml(fragen.unnoetig)}
  </div>

  <div class="outro">
    <p><strong>Was ich mir von uns wünsche</strong></p>
    <p>
      Bei echten Führungsfragen: klar bei mir. Bei allem anderen: zuerst selbst prüfen,
      Kollegin/Kollegen fragen, Empfehlung mitbringen — dann kommen wir schneller weiter
      und ich bleibe für die schwierigen Themen erreichbar.
    </p>
  </div>

  <p class="footer">Internes Arbeitsdokument · ohne Namensnennung · freundlich gemeint, klar gemeint</p>
</body>
</html>`
}

/** Drucken ohne Popup-Fenster (iframe im selben Tab → Browser „Als PDF speichern“). */
export function printMitarbeiterGespraech(
  state: FuehrungState,
  vonIso: string,
  bisIso: string,
): void {
  const html = buildMitarbeiterGespraechHtml(state, vonIso, bisIso)
  const prev = document.getElementById('fuehrung-ma-print-frame')
  if (prev) prev.remove()

  const iframe = document.createElement('iframe')
  iframe.id = 'fuehrung-ma-print-frame'
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document
  if (!doc) {
    // Fallback: HTML-Datei herunterladen (öffenbar / druckbar)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fuehrung-fragen-${vonIso}.html`
    a.click()
    URL.revokeObjectURL(url)
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  const win = iframe.contentWindow
  if (!win) return

  const cleanup = () => {
    setTimeout(() => iframe.remove(), 500)
  }
  win.addEventListener('afterprint', cleanup, { once: true })
  // falls afterprint ausbleibt
  setTimeout(() => {
    try {
      win.focus()
      win.print()
    } catch {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fuehrung-fragen-${vonIso}.html`
      a.click()
      URL.revokeObjectURL(url)
      cleanup()
    }
  }, 250)
}
