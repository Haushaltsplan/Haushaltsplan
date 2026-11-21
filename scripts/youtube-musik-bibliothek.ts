/**
 * Erzeugt einmalig die Long-Form-Musikbibliothek mit Eleven Music (instrumental, ohne Copyright-Risiko).
 * Aufruf: npm run youtube:musik            → fehlende Tracks erzeugen
 *         npm run youtube:musik -- --neu   → alle neu erzeugen
 * Ergebnis: public/youtube-music/long/*.mp3 + katalog.json
 */
import { existsSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { LONGFORM_MUSIK_KATALOG_PFAD, type LongformMusikStimmung, type LongformMusikTrack } from '../lib/youtube/longform/longform-musik'

const TRACKS: { id: string; stimmung: LongformMusikStimmung; sekunden: number; prompt: string }[] = [
  {
    id: 'long-spannung-1',
    stimmung: 'spannung',
    sekunden: 120,
    prompt:
      'Instrumental cinematic underscore for a finance documentary opening. Low pulsing synth bass, soft ticking percussion, restrained strings building tension. Minimal, modern, no vocals, no big drops, leaves room for narration. 92 BPM.',
  },
  {
    id: 'long-treibend-1',
    stimmung: 'treibend',
    sekunden: 150,
    prompt:
      'Instrumental modern documentary background music, steady driving rhythm with muted electric piano, light analog synth arpeggio, brushed drums. Optimistic but understated, no vocals, consistent energy for voice-over. 104 BPM.',
  },
  {
    id: 'long-nachdenklich-1',
    stimmung: 'nachdenklich',
    sekunden: 150,
    prompt:
      'Instrumental calm reflective piano and warm pad, sparse soft felt piano melody, subtle cello, gentle low-pass texture. Thoughtful, intelligent, minimal, no vocals, suitable under narration. 76 BPM.',
  },
  {
    id: 'long-warm-1',
    stimmung: 'warm',
    sekunden: 150,
    prompt:
      'Instrumental warm lo-fi documentary bed, mellow Rhodes chords, soft vinyl texture, gentle kick and shaker, relaxed and confident. No vocals, unobtrusive under voice-over. 88 BPM.',
  },
  {
    id: 'long-ernst-1',
    stimmung: 'ernst',
    sekunden: 120,
    prompt:
      'Instrumental serious documentary underscore, dark low strings, slow pulsing synth, distant piano notes, sense of risk and caution without being dramatic. No vocals, minimal, room for narration. 80 BPM.',
  },
]

const ORDNER = path.join(process.cwd(), 'public', 'youtube-music', 'long')

async function erzeuge(key: string, prompt: string, sekunden: number): Promise<Buffer> {
  const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, music_length_ms: sekunden * 1000, model_id: 'music_v1', force_instrumental: true }),
  })
  if (!res.ok) throw new Error(`Eleven Music ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return Buffer.from(await res.arrayBuffer())
}

async function main() {
  try {
    process.loadEnvFile('.env.local')
  } catch {
    /* Variablen kommen aus der Umgebung */
  }
  const key = process.env.ELEVENLABS_API_KEY?.trim()
  if (!key) throw new Error('ELEVENLABS_API_KEY fehlt in .env.local.')
  const neu = process.argv.includes('--neu')
  await fs.mkdir(ORDNER, { recursive: true })

  const katalog: LongformMusikTrack[] = []
  for (const t of TRACKS) {
    const datei = `youtube-music/long/${t.id}.mp3`
    const abs = path.join(process.cwd(), 'public', ...datei.split('/'))
    if (!neu && existsSync(abs)) {
      process.stdout.write(`✓ ${t.id} existiert schon\n`)
    } else {
      process.stdout.write(`… ${t.id} (${t.sekunden}s, ${t.stimmung})\n`)
      await fs.writeFile(abs, await erzeuge(key, t.prompt, t.sekunden))
    }
    katalog.push({ id: t.id, datei, stimmung: t.stimmung, sekunden: t.sekunden })
  }
  await fs.writeFile(path.join(process.cwd(), 'public', ...LONGFORM_MUSIK_KATALOG_PFAD.split('/')), JSON.stringify(katalog, null, 2), 'utf8')
  process.stdout.write(`Fertig: ${katalog.length} Tracks in public/youtube-music/long\n`)
}

void main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`)
  process.exit(1)
})
