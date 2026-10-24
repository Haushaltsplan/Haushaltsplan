/** Nur Node (API-Route oder `npm run youtube:render`), nicht im Client importieren. */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import type { MoatShortProps } from '@/remotion/moat-short-types'

export const MOAT_SHORT_OUT_ORDNER = path.join(process.cwd(), 'out', 'youtube')

function freierPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.unref()
    s.on('error', reject)
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      s.close((err) => (err ? reject(err) : resolve(port)))
    })
  })
}

const DATEINAME = /^[A-Z0-9]{1,16}-\d{12,14}\.mp4$/
const RENDER_TIMEOUT_MS = 8 * 60 * 1000

export type MoatShortRenderStand =
  | { ok: true; status: 'laeuft'; dateiname: string; sekunden: number }
  | { ok: true; status: 'fertig'; dateiname: string }
  | { ok: false; status: 'fehler'; fehler: string }

type JobDatei = {
  status: 'laeuft' | 'fertig' | 'fehler'
  dateiname: string
  gestartet: number
  fehler?: string
}

export function istMoatShortDateiname(name: string): boolean {
  return DATEINAME.test(name)
}

export function renderDateiPfad(dateiname: string): string {
  return path.join(MOAT_SHORT_OUT_ORDNER, dateiname)
}

function jobPfad(dateiname: string): string {
  return path.join(MOAT_SHORT_OUT_ORDNER, `.${dateiname}.job.json`)
}

function remotionCli(): string {
  return path.join(process.cwd(), 'node_modules', '@remotion', 'cli', 'remotion-cli.js')
}

function musikPfadOk(rel: string | null | undefined): string | null {
  if (!rel) return null
  const norm = rel.replace(/\\/g, '/').replace(/^\/+/, '')
  if (norm.includes('..') || !norm.startsWith('youtube-music/')) return null
  const abs = path.join(process.cwd(), 'public', ...norm.split('/'))
  return existsSync(abs) ? norm : null
}

export function normalisiereRenderProps(props: MoatShortProps): MoatShortProps {
  return {
    ...props,
    musicSrc: musikPfadOk(props.musicSrc),
    musicGain: Number.isFinite(props.musicGain) ? Math.min(1, Math.max(0, props.musicGain)) : 0.5,
    musicTrim: Number.isFinite(props.musicTrim) ? Math.max(0, Math.floor(props.musicTrim)) : 0,
    sfx: props.sfx !== false,
    logoUrl: props.logoUrl || null,
  }
}

async function schreibeJob(job: JobDatei): Promise<void> {
  await fs.writeFile(jobPfad(job.dateiname), JSON.stringify(job), 'utf8')
}

async function leseJob(dateiname: string): Promise<JobDatei | null> {
  try {
    return JSON.parse(await fs.readFile(jobPfad(dateiname), 'utf8')) as JobDatei
  } catch {
    return null
  }
}

export async function leseRenderStatus(dateiname: string): Promise<MoatShortRenderStand> {
  if (!istMoatShortDateiname(dateiname)) return { ok: false, status: 'fehler', fehler: 'Ungültiger Dateiname.' }
  const job = await leseJob(dateiname)
  const ziel = renderDateiPfad(dateiname)
  let groesse = 0
  let mtime = 0
  try {
    const st = await fs.stat(ziel)
    groesse = st.size
    mtime = st.mtimeMs
  } catch {
    groesse = 0
  }
  const fertigDatei = groesse > 50_000 && Date.now() - mtime > 2000
  if (job?.status === 'fertig' || (fertigDatei && job?.status !== 'fehler')) {
    return { ok: true, status: 'fertig', dateiname }
  }
  if (job?.status === 'fehler') {
    return { ok: false, status: 'fehler', fehler: job.fehler || 'Render fehlgeschlagen.' }
  }
  if (job?.status === 'laeuft') {
    if (Date.now() - job.gestartet > RENDER_TIMEOUT_MS) {
      return { ok: false, status: 'fehler', fehler: 'Render hat länger als 8 Minuten gedauert.' }
    }
    return { ok: true, status: 'laeuft', dateiname, sekunden: Math.floor((Date.now() - job.gestartet) / 1000) }
  }
  if (fertigDatei) return { ok: true, status: 'fertig', dateiname }
  return { ok: false, status: 'fehler', fehler: 'Kein Render-Auftrag zu dieser Datei.' }
}

export async function leseRenderDatei(dateiname: string): Promise<Buffer | null> {
  const stand = await leseRenderStatus(dateiname)
  if (stand.status !== 'fertig') return null
  return fs.readFile(renderDateiPfad(dateiname))
}

export async function starteMoatShortRender(props: MoatShortProps): Promise<{ dateiname: string }> {
  const fertig = normalisiereRenderProps(props)
  const ticker = fertig.ticker.replace(/[^A-Z0-9]/gi, '').toUpperCase() || 'SHORT'
  const stempel = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')
  const dateiname = `${ticker}-${stempel}.mp4`
  const ziel = renderDateiPfad(dateiname)
  const propsDatei = path.join(os.tmpdir(), `moat-short-${ticker}-${stempel}.json`)
  const logDatei = path.join(MOAT_SHORT_OUT_ORDNER, `.${dateiname}.log`)

  await fs.mkdir(MOAT_SHORT_OUT_ORDNER, { recursive: true })
  await fs.writeFile(propsDatei, JSON.stringify(fertig), 'utf8')
  await schreibeJob({ status: 'laeuft', dateiname, gestartet: Date.now() })
  const port = await freierPort()

  const kind = spawn(
    process.execPath,
    [
      remotionCli(),
      'render',
      path.join(process.cwd(), 'remotion', 'index.ts'),
      'MoatShort',
      ziel,
      `--props=${propsDatei}`,
      `--port=${port}`,
      '--overwrite',
    ],
    { cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
  )

  let log = ''
  const anhaengen = (d: Buffer) => {
    log = (log + d.toString()).slice(-8000)
  }
  kind.stdout?.on('data', anhaengen)
  kind.stderr?.on('data', anhaengen)

  kind.on('error', (e) => {
    void schreibeJob({ status: 'fehler', dateiname, gestartet: Date.now(), fehler: e.message })
    void fs.writeFile(logDatei, log || e.message, 'utf8')
    void fs.rm(propsDatei, { force: true })
  })

  kind.on('close', (code) => {
    void (async () => {
      await fs.writeFile(logDatei, log, 'utf8').catch(() => undefined)
      await fs.rm(propsDatei, { force: true })
      if (code === 0 && existsSync(ziel)) {
        await schreibeJob({ status: 'fertig', dateiname, gestartet: Date.now() })
        return
      }
      await schreibeJob({
        status: 'fehler',
        dateiname,
        gestartet: Date.now(),
        fehler: (log.trim().slice(-600) || `Remotion endete mit Code ${code}.`).replace(/\s+/g, ' '),
      })
    })()
  })

  return { dateiname }
}

export async function rendereMoatShort(props: MoatShortProps): Promise<{ dateiname: string; ziel: string }> {
  const { dateiname } = await starteMoatShortRender(props)
  for (;;) {
    const stand = await leseRenderStatus(dateiname)
    if (stand.status === 'fertig') return { dateiname, ziel: renderDateiPfad(dateiname) }
    if (stand.status === 'fehler') throw new Error(stand.fehler)
    await new Promise((r) => setTimeout(r, 1500))
  }
}
