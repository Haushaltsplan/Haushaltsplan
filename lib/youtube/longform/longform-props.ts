/** Projektzustand → Props der Composition „AktienAnalyse“. Läuft im Studio (Vorschau) und im Render. */
import type { AktienAnalyseProps, LongSatzProps } from '@/remotion/longform/long-types'
import { industrieZeileEnglisch } from '@/lib/youtube/longform/longform-en'
import { waehleMusik, type LongformMusikTrack } from '@/lib/youtube/longform/longform-musik'
import { LONGFORM_ABSCHNITT_TITEL, type LongformProjektZustand } from '@/lib/youtube/longform/longform-types'

export function baueAnalyseProps(z: LongformProjektZustand, katalog: LongformMusikTrack[], opts?: { sfx?: boolean }): AktienAnalyseProps | null {
  const fb = z.faktenblatt
  const skript = z.skript
  if (!skript) return null

  const saetze: LongSatzProps[] = skript.abschnitte.flatMap((a) =>
    a.saetze.map((s) => {
      const st = z.stimme.saetze[s.id]
      const take = st?.takes.find((t) => t.id === st.aktiv) ?? null
      const bild = z.bilder[s.id] ?? null
      return {
        id: s.id,
        abschnittId: a.id,
        text: s.text,
        visual: s.visual,
        faktIds: s.faktIds,
        audioUrl: take?.url ?? null,
        dauerMs: take?.dauerMs ?? 0,
        woerter: take?.woerter ?? [],
        bildUrl: bild?.url ?? null,
        bildArt: bild?.art ?? null,
        bildCredit: bild?.credit ?? null,
      }
    }),
  )

  const fakten: AktienAnalyseProps['fakten'] = {}
  for (const f of fb.fakten) fakten[f.id] = { text: f.text, label: f.label, wert: f.wert }

  const abschnittIds = skript.abschnitte.map((a) => a.id)
  return {
    ticker: fb.ticker,
    firmenname: fb.firmenname,
    logoUrl: fb.logoUrl,
    branche: industrieZeileEnglisch(fb.sektor, fb.branche),
    leitfrage: skript.leitfrage,
    varianten: z.varianten,
    chart: fb.chart,
    moat: fb.moat,
    burggraben: fb.burggraben,
    segmente: fb.segmente,
    fakten,
    saetze,
    musik: { aktiv: z.musik.aktiv, pegel: z.musik.pegel, tracks: waehleMusik(katalog, abschnittIds, z.varianten.kameraSeed) },
    sfx: opts?.sfx !== false,
    abschnittTitel: LONGFORM_ABSCHNITT_TITEL,
  }
}

/** Credits aller verwendeten Fremdbilder, für die Videobeschreibung. */
export function bildCredits(z: LongformProjektZustand): string[] {
  const out = new Set<string>()
  for (const b of Object.values(z.bilder)) if (b?.credit) out.add(b.credit)
  return [...out]
}
