/**
 * Suchbegriffe Google News (Profi-Wintersport) — in Batches OR-verknüpft.
 * Struktur = Ausgangsbasis, Export ist eine flache Liste.
 */
const WINTERSPORT_KEYWORDS_2026 = {
  events: [
    'Olympische Winterspiele 2026',
    'Milano Cortina 2026',
    'Vierschanzentournee',
    'Tour de Ski',
    'Hahnenkammrennen',
    'Lauberhornrennen',
    'Ski-Weltcup',
    'Biathlon-Weltcup',
    'Nordische Ski-WM',
    'Weltcupfinale',
  ],
  orte: [
    'Oberhof',
    'Ruhpolding',
    'Antholz',
    'Kitzbühel',
    'Wengen',
    'Sölden',
    'Planica',
    'Oslo Holmenkollen',
    'Hochfilzen',
    'Garmisch-Partenkirchen',
    'Innsbruck',
    'Bischofshofen',
    'Lillehammer',
    "Cortina d'Ampezzo",
    'Bormio',
  ],
  athleten: {
    biathlon: [
      'Johannes Thingnes Boe',
      'Sturla Holm Laegreid',
      'Tarjei Boe',
      'Julia Simon',
      'Ingrid Landmark Tandrevold',
      'Lisa Vittozzi',
      'Benedikt Doll',
      'Franziska Preuß',
    ],
    ski_alpin: [
      'Marco Odermatt',
      'Mikaela Shiffrin',
      'Lara Gut-Behrami',
      'Cyprien Sarrazin',
      'Aleksander Aamodt Kilde',
      'Petra Vlhova',
      'Manuel Feller',
      'Linus Straßer',
    ],
    skispringen_noko: [
      'Stefan Kraft',
      'Ryoyu Kobayashi',
      'Andreas Wellinger',
      'Jan Hörl',
      'Jarl Magnus Riiber',
      'Johannes Lamparter',
      'Vinzenz Geiger',
    ],
    langlauf: [
      'Johannes Hoesflot Klaebo',
      'Jessie Diggins',
      'Frida Karlsson',
      'Ebba Andersson',
    ],
  },
  fachbegriffe: [
    'Kristallkugel',
    'Gesamtweltcup',
    'Podestplatz',
    'Disqualifikation',
    'Schanzenrekord',
    'Gundersen-Methode',
    'Strafrunde',
    'Schießfehler',
    'Telemark',
    'Skifliegen',
    'FIS',
    'IBU',
    'DSV',
    'ÖSV',
    'Fluor-Wachs Verbot',
    'Zeitstrafe',
    'Abfahrtshocker',
    'Slalomhang',
  ],
} as const

function flacheWintersportListe(): string[] {
  const a = WINTERSPORT_KEYWORDS_2026
  const at = a.athleten
  const roh = [
    ...a.events,
    ...a.orte,
    ...at.biathlon,
    ...at.ski_alpin,
    ...at.skispringen_noko,
    ...at.langlauf,
    ...a.fachbegriffe,
  ]
  const gesehen = new Set<string>()
  const out: string[] = []
  for (const s of roh) {
    const t = s.trim()
    if (!t) continue
    const k = t.toLowerCase()
    if (gesehen.has(k)) continue
    gesehen.add(k)
    out.push(t)
  }
  return out
}

export const SPORT_WINTER_SCHLUESSELWOERTER: readonly string[] = flacheWintersportListe()
