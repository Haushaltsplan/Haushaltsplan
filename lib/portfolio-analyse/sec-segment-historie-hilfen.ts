import type {
  SecSegmentEintrag,
  SecSegmentHistorie,
  SecSegmentHistoriePaket,
  SecStrukturPaket,
} from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'

/** Max. Jahre in der UI (Anzeige). */
export const MAX_SEGMENT_HISTORIE_JAHRE = 10

function segmentNamenAusJahren(jahre: SecSegmentHistorie['jahre']): string[] {
  return [...new Set(jahre.flatMap((j) => j.segmente.map((s) => s.name)))].sort()
}

export function begrenzeSegmentHistorie(
  hist: SecSegmentHistorie,
  maxJahre = MAX_SEGMENT_HISTORIE_JAHRE,
): SecSegmentHistorie {
  if (hist.jahre.length <= maxJahre) return hist
  const jahre = hist.jahre.slice(-maxJahre)
  return {
    ...hist,
    jahre,
    anzahlJahre: jahre.length,
    aeltestesJahr: jahre[0]!.jahr,
    juengstesJahr: jahre[jahre.length - 1]!.jahr,
    segmentNamen: segmentNamenAusJahren(jahre),
  }
}

export function snapshotZuHistorie(
  art: SecSegmentHistorie['art'],
  segmente: SecSegmentEintrag[],
  jahr: number,
): SecSegmentHistorie | null {
  if (segmente.length < 2 || jahr <= 0) return null
  const jahre = [{ jahr, segmente }]
  return {
    art,
    jahre,
    segmentNamen: segmente.map((s) => s.name),
    anzahlJahre: 1,
    aeltestesJahr: jahr,
    juengstesJahr: jahr,
  }
}

function mergeJahrInHistorie(hist: SecSegmentHistorie | null, jahrEintrag: SecSegmentHistorie['jahre'][0]): SecSegmentHistorie {
  if (!hist) {
    return {
      art: 'produkt',
      jahre: [jahrEintrag],
      segmentNamen: jahrEintrag.segmente.map((s) => s.name),
      anzahlJahre: 1,
      aeltestesJahr: jahrEintrag.jahr,
      juengstesJahr: jahrEintrag.jahr,
    }
  }
  const ohne = hist.jahre.filter((j) => j.jahr !== jahrEintrag.jahr)
  const jahre = [...ohne, jahrEintrag].sort((a, b) => a.jahr - b.jahr)
  return {
    ...hist,
    jahre,
    anzahlJahre: jahre.length,
    aeltestesJahr: jahre[0]!.jahr,
    juengstesJahr: jahre[jahre.length - 1]!.jahr,
    segmentNamen: segmentNamenAusJahren(jahre),
  }
}

function ergaenzeAusSnapshot(
  hist: SecSegmentHistorie | null,
  segmente: SecSegmentEintrag[],
  berichtJahr: number | null,
  art: SecSegmentHistorie['art'],
): SecSegmentHistorie | null {
  const basis = hist ?? snapshotZuHistorie(art, segmente, berichtJahr ?? 0)
  if (!basis) return null
  if (segmente.length >= 2 && berichtJahr != null) {
    const hatJahr = basis.jahre.some((j) => j.jahr === berichtJahr)
    if (!hatJahr) {
      return mergeJahrInHistorie(basis, { jahr: berichtJahr, segmente })
    }
  }
  return basis
}

export function baueEffectiveSegmentPaket(
  secStruktur: SecStrukturPaket | null | undefined,
  paket: SecSegmentHistoriePaket | null | undefined,
): {
  produkt: SecSegmentHistorie | null
  geo: SecSegmentHistorie | null
  berichtJahr: number | null
  quelle: SecSegmentHistoriePaket['quelle'] | 'sec_edgar'
  hatPaketExtras: boolean
} {
  const berichtJahr = secStruktur?.berichtJahr ?? paket?.berichtJahr ?? null

  let produkt = ergaenzeAusSnapshot(
    paket?.produkt ?? null,
    secStruktur?.segmenteProdukt ?? [],
    berichtJahr,
    'produkt',
  )
  let geo = ergaenzeAusSnapshot(
    paket?.geo ?? null,
    secStruktur?.segmenteGeo ?? [],
    berichtJahr,
    'geo',
  )

  if (!produkt && secStruktur?.segmentArt === 'produkt' && secStruktur.segmente.length >= 2 && berichtJahr) {
    produkt = snapshotZuHistorie('produkt', secStruktur.segmente, berichtJahr)
  }
  if (!geo && secStruktur?.segmentArt === 'geo' && secStruktur.segmente.length >= 2 && berichtJahr) {
    geo = snapshotZuHistorie('geo', secStruktur.segmente, berichtJahr)
  }

  if (produkt) produkt = begrenzeSegmentHistorie(produkt)
  if (geo) geo = begrenzeSegmentHistorie(geo)

  const hatPaketExtras = Boolean(
    paket &&
      (paket.kennzahlen ||
        paket.backlog ||
        paket.zusatz.mitarbeiterAnzahl ||
        paket.zusatz.mitarbeiterHistorie.length >= 2 ||
        paket.zusatz.hauptkunden.length > 0 ||
        paket.kategorien.length > 0),
  )

  return {
    produkt,
    geo,
    berichtJahr,
    quelle: paket?.quelle ?? 'sec_edgar',
    hatPaketExtras,
  }
}

function historieReichhaltiger(
  a: SecSegmentHistorie | null,
  b: SecSegmentHistorie | null,
): SecSegmentHistorie | null {
  if (!a) return b
  if (!b) return a
  return (a.anzahlJahre >= b.anzahlJahre ? a : b)
}

/** Marketscreener + SEC EDGAR — je Dimension die reichhaltigere Quelle. */
export function mergeSecSegmentHistoriePakete(
  primaer: SecSegmentHistoriePaket | null,
  sekundaer: SecSegmentHistoriePaket | null,
): SecSegmentHistoriePaket | null {
  if (!primaer) return sekundaer
  if (!sekundaer) return primaer

  const produkt = historieReichhaltiger(primaer.produkt, sekundaer.produkt)
  const geo = historieReichhaltiger(primaer.geo, sekundaer.geo)
  const kategorien =
    sekundaer.kategorien.length >= primaer.kategorien.length ? sekundaer.kategorien : primaer.kategorien

  const quelle =
    (sekundaer.produkt?.anzahlJahre ?? 0) > (primaer.produkt?.anzahlJahre ?? 0) ||
    (sekundaer.geo?.anzahlJahre ?? 0) > (primaer.geo?.anzahlJahre ?? 0)
      ? sekundaer.quelle
      : primaer.quelle

  return {
    produkt,
    geo,
    kategorien,
    zusatz: {
      mitarbeiterAnzahl: sekundaer.zusatz.mitarbeiterAnzahl ?? primaer.zusatz.mitarbeiterAnzahl,
      auslandsumsatzAnteilPct:
        sekundaer.zusatz.auslandsumsatzAnteilPct ?? primaer.zusatz.auslandsumsatzAnteilPct,
      hauptkunden:
        sekundaer.zusatz.hauptkunden.length >= primaer.zusatz.hauptkunden.length
          ? sekundaer.zusatz.hauptkunden
          : primaer.zusatz.hauptkunden,
      mitarbeiterHistorie:
        sekundaer.zusatz.mitarbeiterHistorie.length >= primaer.zusatz.mitarbeiterHistorie.length
          ? sekundaer.zusatz.mitarbeiterHistorie
          : primaer.zusatz.mitarbeiterHistorie,
      kundenKonzentrationHistorie:
        sekundaer.zusatz.kundenKonzentrationHistorie.length >=
        primaer.zusatz.kundenKonzentrationHistorie.length
          ? sekundaer.zusatz.kundenKonzentrationHistorie
          : primaer.zusatz.kundenKonzentrationHistorie,
    },
    backlog: sekundaer.backlog ?? primaer.backlog,
    kennzahlen: sekundaer.kennzahlen ?? primaer.kennzahlen,
    berichtJahr: Math.max(primaer.berichtJahr ?? 0, sekundaer.berichtJahr ?? 0) || null,
    anzahl10k: Math.max(primaer.anzahl10k, sekundaer.anzahl10k),
    geladenAm: new Date().toISOString(),
    quelle,
  }
}
