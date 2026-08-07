/**
 * Mitarbeiter-Fragen als druckbares HTML (Browser → PDF).
 * Für das offene Teamgespräch (Lernwoche 2 · Montag).
 */

import {
  mitarbeiterFragenStats,
  summeMitarbeiterFragenSplit,
  tagFragenGesamt,
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

function formatKurz(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'short',
  })
}

function notizenAlsListenHtml(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[·\-–•]\s*/, '').trim())
    .filter(Boolean)
  if (lines.length === 0) return ''
  return `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`
}

export function buildMitarbeiterGespraechHtml(
  state: FuehrungState,
  vonIso: string,
  bisIso: string,
): string {
  const split = summeMitarbeiterFragenSplit(state.mitarbeiterTage, vonIso, bisIso)
  const ranking = mitarbeiterFragenStats(state.mitarbeiter, state.mitarbeiterTage, vonIso, bisIso).filter(
    (x) => x.anzahl > 0,
  )
  const erstellt = new Date().toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const rankingRows = ranking
    .map(
      (r, i) =>
        `<tr>
          <td class="rank">${i + 1}</td>
          <td class="name">${esc(r.name)}</td>
          <td class="num">${r.anzahl}</td>
          <td class="num ok">${r.anzahlWichtig}</td>
          <td class="num warn">${r.anzahlUnnoetig}</td>
        </tr>`,
    )
    .join('')

  const personBlocks = ranking
    .map((r) => {
      const tage = state.mitarbeiterTage
        .filter((t) => t.mitarbeiterId === r.id && t.datum >= vonIso && t.datum <= bisIso)
        .filter((t) => tagFragenGesamt(t) > 0 || t.notizenWichtig.trim() || t.notizenUnnoetig.trim())
        .sort((a, b) => a.datum.localeCompare(b.datum))

      const dayBits = tage
        .map((t) => {
          const w = notizenAlsListenHtml(t.notizenWichtig)
          const u = notizenAlsListenHtml(t.notizenUnnoetig)
          if (!w && !u && tagFragenGesamt(t) === 0) return ''
          return `<div class="day">
            <p class="day-label">${esc(formatKurz(t.datum))} · ${t.anzahlWichtig} wichtig · ${t.anzahlUnnoetig} unnötig</p>
            ${w ? `<div class="box ok"><p class="box-label">Wirklich wichtig</p>${w}</div>` : ''}
            ${u ? `<div class="box warn"><p class="box-label">Könnte ohne Führung gelöst werden</p>${u}</div>` : ''}
          </div>`
        })
        .filter(Boolean)
        .join('')

      return `<section class="person">
        <h3>${esc(r.name)} <span>${r.anzahl} Fragen · ${r.anzahlWichtig} wichtig · ${r.anzahlUnnoetig} unnötig</span></h3>
        ${dayBits || '<p class="muted">Keine Notizen — nur Zählung.</p>'}
      </section>`
    })
    .join('')

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
    td.rank { width: 28px; color: #94a3b8; font-weight: 600; }
    td.name { font-weight: 600; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; width: 64px; }
    td.ok { color: #0f766e; font-weight: 600; }
    td.warn { color: #b45309; font-weight: 600; }
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
    .person {
      break-inside: avoid;
      margin: 14px 0;
      padding: 12px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
    }
    .person h3 {
      margin: 0 0 8px;
      font-size: 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: baseline;
      justify-content: space-between;
    }
    .person h3 span { font-size: 11px; font-weight: 500; color: #64748b; }
    .day { margin-top: 8px; }
    .day-label { margin: 0 0 4px; font-size: 10px; color: #64748b; font-weight: 600; }
    .box { border-radius: 8px; padding: 8px 10px; margin-top: 4px; }
    .box.ok { background: #f0fdfa; }
    .box.warn { background: #fffbeb; }
    .box-label { margin: 0 0 4px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; color: #475569; }
    ul { margin: 0; padding-left: 1.1rem; }
    li { margin: 2px 0; }
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
      .person { break-inside: avoid; }
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

  <h2>Ranking im Zeitraum</h2>
  ${
    rankingRows
      ? `<table>
    <thead>
      <tr>
        <th>#</th>
        <th>Mitarbeiter</th>
        <th style="text-align:right">Gesamt</th>
        <th style="text-align:right">Wichtig</th>
        <th style="text-align:right">Unnötig</th>
      </tr>
    </thead>
    <tbody>${rankingRows}</tbody>
  </table>`
      : '<p class="muted">Noch keine Einträge im Zeitraum.</p>'
  }

  <h2>Details &amp; Beispiele</h2>
  ${personBlocks || '<p class="muted">Noch keine Details.</p>'}

  <div class="outro">
    <p><strong>Was ich mir von uns wünsche</strong></p>
    <p>
      Bei echten Führungsfragen: klar bei mir. Bei allem anderen: zuerst selbst prüfen,
      Kollegin/Kollegen fragen, Empfehlung mitbringen — dann kommen wir schneller weiter
      und ich bleibe für die schwierigen Themen erreichbar.
    </p>
  </div>

  <p class="footer">Internes Arbeitsdokument · freundlich gemeint, klar gemeint</p>
</body>
</html>`
}

export function printMitarbeiterGespraech(
  state: FuehrungState,
  vonIso: string,
  bisIso: string,
): void {
  const html = buildMitarbeiterGespraechHtml(state, vonIso, bisIso)
  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) {
    alert('Popup blockiert — bitte Popups für diese Seite erlauben und erneut versuchen.')
    return
  }
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 400)
}
