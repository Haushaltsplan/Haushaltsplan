/** Führende Stille in der TTS-Datei. Der erste Ton soll auf Frame 0 liegen. */

const MAX_STILLE_MS = 450
const SCHWELLE = 10 ** (-42 / 20)
const FENSTER_SEK = 0.01

export async function fuehrendeStilleMs(blob: Blob): Promise<number> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return 0
  const ctx = new Ctx()
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer())
    const rate = buf.sampleRate
    const fenster = Math.max(1, Math.round(rate * FENSTER_SEK))
    const decke = Math.min(buf.length, Math.round(rate * (MAX_STILLE_MS / 1000)))
    let summe = 0
    for (let i = 0; i < decke; i++) {
      let pegel = 0
      for (let c = 0; c < buf.numberOfChannels; c++) pegel = Math.max(pegel, Math.abs(buf.getChannelData(c)[i] ?? 0))
      summe += pegel
      if (i >= fenster) {
        let alt = 0
        for (let c = 0; c < buf.numberOfChannels; c++) alt = Math.max(alt, Math.abs(buf.getChannelData(c)[i - fenster] ?? 0))
        summe -= alt
      }
      if (i >= fenster && summe / fenster >= SCHWELLE) {
        const start = Math.max(0, i - fenster)
        return Math.min(MAX_STILLE_MS, Math.round((start / rate) * 1000))
      }
    }
    return 0
  } finally {
    await ctx.close()
  }
}
