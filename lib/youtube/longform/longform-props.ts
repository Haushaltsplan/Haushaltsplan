/** Projektzustand → Props der Composition „AktienAnalyse“. Läuft im Studio (Vorschau) und im Render. */
import type { AktienAnalyseProps, LongSatzProps } from '@/remotion/longform/long-types'
import { LONGFORM_KANAL_LOGO, LONGFORM_KANAL_NAME } from '@/lib/youtube/longform/longform-kanal'
import { industrieZeileEnglisch } from '@/lib/youtube/longform/longform-en'
import { waehleMusik, type LongformMusikTrack } from '@/lib/youtube/longform/longform-musik'
import {
  LONGFORM_ABSCHNITT_TITEL,
  type LongformChart10k,
  type LongformProjektZustand,
} from '@/lib/youtube/longform/longform-types'

/** Alte Projekte ohne Sektor-/Price-only-Felder bleiben renderbar. */
function normalisiereChart(c: LongformChart10k | null): LongformChart10k | null {
  if (!c) return null
  return {
    ...c,
    endwertSektor: c.endwertSektor ?? null,
    sektorEtf: c.sektorEtf ?? null,
    punkte: c.punkte.map((p) => ({
      ...p,
      kursOhneDiv: p.kursOhneDiv ?? null,
      sektor: p.sektor ?? null,
    })),
  }
}

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
    chart: normalisiereChart(fb.chart),
    moat: fb.moat,
    burggraben: fb.burggraben,
    segmente: fb.segmente
      ? {
          ...fb.segmente,
          eintraege: fb.segmente.eintraege.map((e) => ({
            ...e,
            margePct: e.margePct ?? null,
            wachstumPct: e.wachstumPct ?? null,
          })),
        }
      : null,
    reihen: fb.reihen ?? [],
    fakten,
    saetze,
    musik: { aktiv: z.musik.aktiv, pegel: z.musik.pegel, tracks: waehleMusik(katalog, abschnittIds, z.varianten.kameraSeed) },
    sfx: opts?.sfx !== false,
    abschnittTitel: LONGFORM_ABSCHNITT_TITEL,
    kanalName: LONGFORM_KANAL_NAME,
    kanalLogoUrl: LONGFORM_KANAL_LOGO,
    investiert: z.investiert ?? null,
  }
}

/** Credits aller verwendeten Fremdbilder, für die Videobeschreibung. */
export function bildCredits(z: LongformProjektZustand): string[] {
  const out = new Set<string>()
  for (const b of Object.values(z.bilder)) if (b?.credit) out.add(b.credit)
  return [...out]
}
