import { MOAT_SHORT_KATALOG_PFADE, musikTrack, trackZumUrteil } from '../lib/youtube/moat-short-musik'
import { rendereMoatShort } from '../lib/youtube/moat-short-render-server'
import { MOAT_SHORT_DEFAULT_PROPS, MOAT_SHORT_FPS, type MoatShortProps } from '../remotion/moat-short-types'

function mitMusik(props: MoatShortProps): MoatShortProps {
  const src = props.musicSrc ?? trackZumUrteil(props.verdict, MOAT_SHORT_KATALOG_PFADE)
  const track = src ? musikTrack(src) : null
  return {
    ...props,
    musicSrc: src,
    musicGain: props.musicSrc ? props.musicGain : (track?.gain ?? 1) * 0.5,
    musicTrim: Math.round((track?.startSekunden ?? 0) * MOAT_SHORT_FPS),
    sfx: props.sfx !== false,
  }
}

async function main() {
  const arg = process.argv[2]
  let props = MOAT_SHORT_DEFAULT_PROPS
  if (arg) {
    const { readFileSync } = await import('node:fs')
    props = JSON.parse(readFileSync(arg, 'utf8')) as MoatShortProps
  }
  const fertig = mitMusik(props)
  process.stdout.write(`Rendere ${fertig.ticker} mit ${fertig.musicSrc ?? 'ohne Musik'}…\n`)
  const r = await rendereMoatShort(fertig)
  process.stdout.write(`Fertig: ${r.ziel}\n`)
}

void main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : e}\n`)
  process.exit(1)
})
