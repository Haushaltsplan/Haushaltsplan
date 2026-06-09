/**
 * Omnia-Logo → Android Launcher-Icons (aus app/icon.svg, wie PWA).
 * Aufruf: node scripts/generate-android-icons.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = join(__dir, '..')
const svgPath = join(root, 'app', 'icon.svg')
const resDir = join(root, 'android', 'app', 'src', 'main', 'res')

const LAUNCHER = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
}

const FOREGROUND = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
}

const BG = '#030304'

async function pngAusSvg(svg, size) {
  return sharp(svg).png().resize(size, size).toBuffer()
}

async function schreibeIcon(ordner, name, size, svg) {
  const buf = await pngAusSvg(svg, size)
  await sharp(buf).toFile(join(resDir, ordner, `${name}.png`))
}

async function main() {
  const svg = await readFile(svgPath)

  for (const [ordner, size] of Object.entries(LAUNCHER)) {
    await schreibeIcon(ordner, 'ic_launcher', size, svg)
    await schreibeIcon(ordner, 'ic_launcher_round', size, svg)
  }

  for (const [ordner, size] of Object.entries(FOREGROUND)) {
    await schreibeIcon(ordner, 'ic_launcher_foreground', size, svg)
  }

  const bgXml = join(resDir, 'values', 'ic_launcher_background.xml')
  await writeFile(
    bgXml,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`,
    'utf8',
  )

  console.log('generate-android-icons: Omnia-Logo → android/app/src/main/res/mipmap-*')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
