import { ladeKapitalbasis } from '../lib/portfolio-analyse/kapitalbasis/kapitalbasis-server'
import { berechneRoiic } from '../lib/portfolio-analyse/kapitalbasis/roiic-berechnung'

async function main() {
  const s = await ladeKapitalbasis({ symbolYahoo: 'ROL' })
  if (!s) {
    console.log('keine serie')
    return
  }
  const roiic = berechneRoiic(s.jahre, s.ableitungen)
  const map = new Map(s.ableitungen.map((a) => [a.jahr, a]))
  console.table(
    s.jahre
      .filter((j) => j.jahr >= 2020)
      .map((j) => {
        const a = map.get(j.jahr)
        return {
          Jahr: j.jahr,
          NOPAT: a?.nopatMio,
          ICnetto: a?.icNettoMio,
          ICtangN: a?.icTangibleNettoMio,
          GW: j.goodwillMio,
          Intang: j.intangiblesMio,
          Cash: j.bargeldMio,
          CapEx: j.capexMio,
          Reinv: a?.bruttoReinvestMio,
        }
      }),
  )
  console.log(JSON.stringify({ organisch: roiic.organisch, buch: roiic.buch, ma: roiic.maJahre }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
