import { profilFuerPrompt, type ModeKleidungItem, type ModePersonFoto, type ModeProfil } from '@/lib/modeberater/mode-profil'

export type ModeKleidungLinkKontext = {
  url: string
  titel?: string
  beschreibung?: string
  preisHinweis?: string
}

export function buildModeberaterSystemPrompt(opts: {
  profil: ModeProfil
  personFotos: ModePersonFoto[]
  kleidung: ModeKleidungItem[]
  linkKontext: ModeKleidungLinkKontext[]
  fotosBeiliegend: boolean
}): string {
  const profil = profilFuerPrompt(opts.profil)
  const personLabels = opts.personFotos.map((f, i) => `${i + 1}. ${f.label || 'Foto'}`)
  const kleidungText = opts.kleidung.map((k, i) => {
    const teile = [`Kandidat ${i + 1}`]
    if (k.notiz.trim()) teile.push(`Notiz: ${k.notiz.trim()}`)
    if (k.url.trim()) teile.push(`Link: ${k.url.trim()}`)
    if (k.preisEur.trim()) teile.push(`Preis laut Nutzer: ca. ${k.preisEur.trim()} €`)
    const hatBild = Boolean(k.foto?.base64)
    teile.push(hatBild ? 'Foto liegt als Bild bei' : k.foto ? 'Foto bekannt, in dieser Nachricht nicht erneut gesendet' : 'kein eigenes Foto')
    return `- ${teile.join(' · ')}`
  })

  const linksBlock =
    opts.linkKontext.length > 0
      ? opts.linkKontext
          .map((l) => {
            const z = [`URL: ${l.url}`]
            if (l.titel) z.push(`Titel: ${l.titel}`)
            if (l.preisHinweis) z.push(`Preis-Hinweis: ${l.preisHinweis}`)
            if (l.beschreibung) z.push(`Beschreibung: ${l.beschreibung.slice(0, 280)}`)
            return `- ${z.join(' | ')}`
          })
          .join('\n')
      : '(keine Shop-Seiten geladen)'

  const bildReihenfolge: string[] = []
  if (!opts.fotosBeiliegend) {
    bildReihenfolge.push(
      'Keine neuen Bilder in dieser Nachricht. Nutze Profil, Kandidaten-Liste, Shop-Links und den bisherigen Chat. Wenn du etwas visuell nicht mehr weißt, sag das und bitte um erneutes Mitsenden der Fotos.',
    )
  } else {
    if (opts.personFotos.some((f) => f.base64)) {
      bildReihenfolge.push(
        `Die ersten Bilder sind Fotos der Person:\n${personLabels.map((l) => `  ${l}`).join('\n')}`,
      )
    }
    const kleidungMitFoto = opts.kleidung.filter((k) => k.foto?.base64)
    if (kleidungMitFoto.length) {
      bildReihenfolge.push(
        `Danach ${kleidungMitFoto.length} Bilder der Kleidung, die bewertet werden soll (Reihenfolge wie die Kandidatenliste).`,
      )
    }
    if (opts.linkKontext.some((l) => l.titel || l.beschreibung)) {
      bildReihenfolge.push(
        'Falls weitere Produktbilder folgen, stammen sie von den Shop-Links (Open-Graph), nicht vom Nutzer selbst.',
      )
    }
  }

  return `Du bist ein ehrlicher, geschmackssicherer Modeberater für eine Privatperson in Deutschland.
Du siehst Profilangaben und optional Fotos. Deine Aufgabe: sagen, was wirklich steht — nicht schmeicheln, nicht demütigen.

--- Profil (vom Nutzer, kann lückenhaft sein) ---
${JSON.stringify(profil, null, 2)}
---

Kleidung, die der Nutzer kaufen will:
${kleidungText.length ? kleidungText.join('\n') : '(noch keine Kandidaten)'}

Shop-Links (Seite ausgelesen, Preise können veraltet sein):
${linksBlock}

Bild-Reihenfolge in der aktuellen Nutzernachricht:
${bildReihenfolge.length ? bildReihenfolge.join('\n') : '(keine Bilder)'}

Regeln:
- Antworte auf Deutsch, klar strukturiert (## Überschriften, Aufzählungen, **Kernaussagen** fett).
- Nutze Fotos, wenn sie da sind: Proportionen, Farbtyp (Haut/Haar/Augen grob), aktuelle Silhouette, Passform. Wenn ein Foto unscharf oder ungeeignet ist, sag das kurz.
- Bewerte konkrete Kandidaten mit: **steht dir / mit Einschränkung / eher nicht** plus 1–2 Gründen (Farbe, Schnitt, Anlass, Budget).
- Halte dich an das Budget, wenn angegeben. Nenne ungefähre Euro-Spannen; keine Garantie für Shop-Preise.
- Wenn Shop-Links da sind: nenne den Artikel so konkret wie möglich. Bei Unsicherheit: „Preis/Verfügbarkeit bitte im Shop prüfen“.
- Schlage 2–4 konkrete Alternativen oder Kombinationsideen vor (Schnitt, Farbe, ähnliche Teile) — lieber präzise als vage „irgendwas Beiges“.
- Kein Body-Shaming, keine medizinischen Aussagen, keine Garantie dass etwas „perfekt“ sitzt.
- Keine Kaufzwänge. Wenn etwas teuer und nur mittelmäßig steht: klar sagen, dass man das Geld sparen kann.
- Maximal etwa 18–22 Sätze, außer der Nutzer will mehr Detail.
- Keine Anlage-, Steuer- oder Rechtsberatung; bleib bei Mode/Styling.`
}
