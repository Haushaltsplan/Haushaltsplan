/**
 * Liest app/icon.svg und erzeugt PNGs für PWA-Installation (192 / 180 / 512).
 * Aufruf: node scripts/rasterize-omnia-icon.mjs
 */
import { copyFile, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = join(__dir, '..')
const svgPath = join(root, 'app', 'icon.svg')
const outDir = join(root, 'public')

async function main() {
  const buf = await readFile(svgPath)
  await sharp(buf).png().resize(192, 192).toFile(join(outDir, 'omnia-192.png'))
  await sharp(buf).png().resize(180, 180).toFile(join(outDir, 'omnia-180.png'))
  await sharp(buf).png().resize(512, 512).toFile(join(outDir, 'omnia-512.png'))
  await copyFile(join(outDir, 'omnia-180.png'), join(root, 'app', 'apple-icon.png'))
  console.log('rasterize-omnia-icon: public/omnia-{180,192,512}.png + app/apple-icon.png')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
