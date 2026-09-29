/**
 * Omnia-Whoop-Logo → Android Launcher-Icons + PWA-PNGs.
 * Quelle: public/omnia-whoop-icon-source.png (Fallback: omnia-whoop-icon.svg)
 * Aufruf: npm run icon:whoop
 */
import { copyFile, mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = join(__dir, '..')
const pngSource = join(root, 'public', 'omnia-whoop-icon-source.png')
const svgSource = join(root, 'public', 'omnia-whoop-icon.svg')
const resDir = join(root, 'apps', 'omnia-whoop', 'android', 'app', 'src', 'main', 'res')
const publicDir = join(root, 'public')

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

const BG = '#070b10'

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function ladeQuelle() {
  if (await exists(pngSource)) return readFile(pngSource)
  return readFile(svgSource)
}

async function schreibeIcon(ordner, name, size, input) {
  await mkdir(join(resDir, ordner), { recursive: true })
  await sharp(input).resize(size, size).png().toFile(join(resDir, ordner, `${name}.png`))
}

async function schreibeForeground(ordner, size, input) {
  await mkdir(join(resDir, ordner), { recursive: true })
  const inner = Math.round(size * 0.72)
  const inset = Math.floor((size - inner) / 2)
  const fg = await sharp(input).resize(inner, inner).png().toBuffer()
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 7, g: 11, b: 16, alpha: 0 },
    },
  })
    .composite([{ input: fg, left: inset, top: inset }])
    .png()
    .toFile(join(resDir, ordner, 'ic_launcher_foreground.png'))
}

async function main() {
  const input = await ladeQuelle()

  for (const [ordner, size] of Object.entries(LAUNCHER)) {
    await schreibeIcon(ordner, 'ic_launcher', size, input)
    await schreibeIcon(ordner, 'ic_launcher_round', size, input)
  }

  for (const [ordner, size] of Object.entries(FOREGROUND)) {
    await schreibeForeground(ordner, size, input)
  }

  await writeFile(
    join(resDir, 'values', 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`,
    'utf8',
  )

  await sharp(input).resize(512, 512).png().toFile(join(publicDir, 'omnia-whoop-512.png'))
  await sharp(input).resize(192, 192).png().toFile(join(publicDir, 'omnia-whoop-192.png'))
  await copyFile(join(publicDir, 'omnia-whoop-512.png'), join(publicDir, 'omnia-whoop-icon.png'))

  console.log('generate-whoop-android-icons: fertig → mipmap-* + public/omnia-whoop-*.png')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
