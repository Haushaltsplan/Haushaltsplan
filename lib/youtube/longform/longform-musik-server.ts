import 'server-only'

import { existsSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  LONGFORM_MUSIK_FALLBACK,
  LONGFORM_MUSIK_KATALOG_PFAD,
  LONGFORM_MUSIK_STIMMUNGEN,
  type LongformMusikTrack,
} from '@/lib/youtube/longform/longform-musik'

const oeffentlich = (rel: string) => path.join(process.cwd(), 'public', ...rel.split('/'))

/** Katalog aus public/youtube-music/long; fehlt er, die vorhandenen Short-Tracks. */
export async function ladeMusikKatalog(): Promise<LongformMusikTrack[]> {
  try {
    const roh = JSON.parse(await fs.readFile(oeffentlich(LONGFORM_MUSIK_KATALOG_PFAD), 'utf8')) as LongformMusikTrack[]
    const ok = roh.filter(
      (t) =>
        typeof t.datei === 'string' &&
        t.datei.startsWith('youtube-music/') &&
        !t.datei.includes('..') &&
        (LONGFORM_MUSIK_STIMMUNGEN as readonly string[]).includes(t.stimmung) &&
        existsSync(oeffentlich(t.datei)),
    )
    if (ok.length) return ok
  } catch {
    /* Katalog noch nicht erzeugt */
  }
  return LONGFORM_MUSIK_FALLBACK.filter((t) => existsSync(oeffentlich(t.datei)))
}
