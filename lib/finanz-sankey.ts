import {
  effektiveKategorie,
  kategorieDef,
  type FinanzKategorieKey,
} from '@/lib/finanz-kategorisierung'

/** Max. Einzelposten je Oberkategorie; Rest wird zu „Sonstige“ zusammengezogen. */
export const MAX_SANKEY_POSTEN_PRO_KATEGORIE = 7

const BUDGET_FARBE = '#7c8b9a'
const UEBERSCHUSS_FARBE = '#c4a35a'
const FEHLBETRAG_FARBE = '#c98b8b'
const QUELLE_FARBEN = ['#5ec4a8', '#6bb8c4', '#7aa3d4', '#8b9cc4', '#a78bb4', '#c4a0b0'] as const

export type FinanzSankeyBuchung = {
  kategorie?: string | null
  beschreibung?: string | null
  betrag?: number | string | null
  kategorie_key?: string | null
}

export type FinanzSankeyEbene =
  | 'quelle'
  | 'fehlbetrag'
  | 'budget'
  | 'kategorie'
  | 'posten'
  | 'ueberschuss'

export type FinanzSankeyNode = {
  name: string
  farbe: string
  ebene: FinanzSankeyEbene
}

export type FinanzSankeyLink = {
  source: number
  target: number
  value: number
  farbe: string
}

export type FinanzSankeyKategorie = {
  key: string
  name: string
  farbe: string
  betrag: number
}

export type FinanzSankeyErgebnis = {
  nodes: FinanzSankeyNode[]
  links: FinanzSankeyLink[]
  kategorien: FinanzSankeyKategorie[]
  gesamtEinkommen: number
  gesamtAusgaben: number
  saldo: number
  hatDaten: boolean
  postenAnzahl: number
}

function runde(n: number) {
  return Math.round(n * 100) / 100
}

function betragVon(row: FinanzSankeyBuchung): number {
  const b = Number(row.betrag)
  return Number.isFinite(b) && b > 0 ? runde(b) : 0
}

function anzeigename(row: FinanzSankeyBuchung): string {
  const n = String(row.kategorie ?? '').trim()
  return n || 'Ohne Angabe'
}

function gruppiereBuchungen(rows: FinanzSankeyBuchung[]): Array<{ name: string; betrag: number }> {
  const map = new Map<string, number>()
  for (const r of rows) {
    const b = betragVon(r)
    if (b <= 0) continue
    const name = anzeigename(r)
    map.set(name, runde((map.get(name) || 0) + b))
  }
  return sortiereNachBetrag(map)
}

function buendelePosten(items: Array<{ name: string; betrag: number }>): Array<{ name: string; betrag: number }> {
  const map = new Map<string, number>()
  for (const it of items) {
    if (it.betrag <= 0) continue
    map.set(it.name, runde((map.get(it.name) || 0) + it.betrag))
  }
  return sortiereNachBetrag(map)
}

function sortiereNachBetrag(map: Map<string, number>): Array<{ name: string; betrag: number }> {
  return [...map.entries()]
    .map(([name, betrag]) => ({ name, betrag }))
    .sort((a, b) => b.betrag - a.betrag)
}

function kappePosten(
  items: Array<{ name: string; betrag: number }>,
  sonstigeLabel: string,
): Array<{ name: string; betrag: number }> {
  if (items.length <= MAX_SANKEY_POSTEN_PRO_KATEGORIE) return items
  const top = items.slice(0, MAX_SANKEY_POSTEN_PRO_KATEGORIE - 1)
  const rest = items.slice(MAX_SANKEY_POSTEN_PRO_KATEGORIE - 1)
  if (rest.length === 1) return items
  const restBetrag = runde(rest.reduce((a, x) => a + x.betrag, 0))
  return [...top, { name: sonstigeLabel, betrag: restBetrag }]
}

/**
 * Baut den Sankey-Graphen: Einnahmequellen → Budget → Oberkategorien → Einzelposten.
 * Saldo wird als Überschuss (Rest) bzw. Fehlbetrag (linke Quelle) ausgeglichen.
 */
export function baueFinanzSankey(
  einnahmen: FinanzSankeyBuchung[],
  ausgaben: FinanzSankeyBuchung[],
): FinanzSankeyErgebnis {
  const leer: FinanzSankeyErgebnis = {
    nodes: [],
    links: [],
    kategorien: [],
    gesamtEinkommen: 0,
    gesamtAusgaben: 0,
    saldo: 0,
    hatDaten: false,
    postenAnzahl: 0,
  }

  const quellen = gruppiereBuchungen(einnahmen)
  const gesamtEinkommen = runde(quellen.reduce((a, q) => a + q.betrag, 0))

  const nachKat = new Map<FinanzKategorieKey, Array<{ name: string; betrag: number }>>()
  for (const r of ausgaben) {
    const b = betragVon(r)
    if (b <= 0) continue
    const key = effektiveKategorie(r, false)
    const arr = nachKat.get(key) ?? []
    arr.push({ name: anzeigename(r), betrag: b })
    nachKat.set(key, arr)
  }

  const kategorienRoh = [...nachKat.entries()]
    .map(([key, rows]) => {
      const def = kategorieDef(key)
      const gebuendelt = buendelePosten(rows)
      const posten = kappePosten(gebuendelt, `Sonstige (${def.label})`)
      const betrag = runde(posten.reduce((a, p) => a + p.betrag, 0))
      return { key, name: def.label, farbe: def.farbe, betrag, posten }
    })
    .filter((k) => k.betrag > 0)
    .sort((a, b) => b.betrag - a.betrag)

  const gesamtAusgaben = runde(kategorienRoh.reduce((a, k) => a + k.betrag, 0))
  const saldo = runde(gesamtEinkommen - gesamtAusgaben)
  const fehlbetrag = saldo < 0 ? runde(-saldo) : 0
  const ueberschuss = saldo > 0 ? saldo : 0

  if (gesamtEinkommen <= 0 && gesamtAusgaben <= 0) return leer

  const nodes: FinanzSankeyNode[] = []
  const links: FinanzSankeyLink[] = []
  const idx = () => nodes.length

  const quelleIdx: number[] = []
  for (let i = 0; i < quellen.length; i++) {
    const q = quellen[i]!
    quelleIdx.push(idx())
    nodes.push({
      name: q.name,
      farbe: QUELLE_FARBEN[i % QUELLE_FARBEN.length],
      ebene: 'quelle',
    })
  }

  let fehlIdx: number | null = null
  if (fehlbetrag > 0) {
    fehlIdx = idx()
    nodes.push({ name: 'Fehlbetrag', farbe: FEHLBETRAG_FARBE, ebene: 'fehlbetrag' })
  }

  const budgetIdx = idx()
  nodes.push({ name: 'Budget', farbe: BUDGET_FARBE, ebene: 'budget' })

  for (let i = 0; i < quellen.length; i++) {
    links.push({
      source: quelleIdx[i]!,
      target: budgetIdx,
      value: quellen[i]!.betrag,
      farbe: nodes[quelleIdx[i]!]!.farbe,
    })
  }
  if (fehlIdx != null) {
    links.push({
      source: fehlIdx,
      target: budgetIdx,
      value: fehlbetrag,
      farbe: FEHLBETRAG_FARBE,
    })
  }

  const kategorien: FinanzSankeyKategorie[] = []

  for (const kat of kategorienRoh) {
    const katIdx = idx()
    nodes.push({ name: kat.name, farbe: kat.farbe, ebene: 'kategorie' })
    kategorien.push({ key: kat.key, name: kat.name, farbe: kat.farbe, betrag: kat.betrag })
    links.push({
      source: budgetIdx,
      target: katIdx,
      value: kat.betrag,
      farbe: kat.farbe,
    })
    for (const p of kat.posten) {
      const pIdx = idx()
      nodes.push({ name: p.name, farbe: kat.farbe, ebene: 'posten' })
      links.push({
        source: katIdx,
        target: pIdx,
        value: p.betrag,
        farbe: kat.farbe,
      })
    }
  }

  if (ueberschuss > 0) {
    const uKatIdx = idx()
    nodes.push({ name: 'Überschuss', farbe: UEBERSCHUSS_FARBE, ebene: 'ueberschuss' })
    kategorien.push({
      key: 'ueberschuss',
      name: 'Überschuss',
      farbe: UEBERSCHUSS_FARBE,
      betrag: ueberschuss,
    })
    links.push({
      source: budgetIdx,
      target: uKatIdx,
      value: ueberschuss,
      farbe: UEBERSCHUSS_FARBE,
    })
    const uPostenIdx = idx()
    nodes.push({ name: 'nicht ausgegeben', farbe: UEBERSCHUSS_FARBE, ebene: 'posten' })
    links.push({
      source: uKatIdx,
      target: uPostenIdx,
      value: ueberschuss,
      farbe: UEBERSCHUSS_FARBE,
    })
  }

  const postenAnzahl = nodes.filter((n) => n.ebene === 'posten').length

  return {
    nodes,
    links,
    kategorien,
    gesamtEinkommen,
    gesamtAusgaben,
    saldo,
    hatDaten: links.length > 0,
    postenAnzahl,
  }
}
