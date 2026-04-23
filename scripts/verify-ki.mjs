/**
 * Prüft, ob KI-Schlüssel in .env.local vorhanden sind (Werte werden nicht ausgegeben).
 * Aufruf: npm run check:ki
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const envPath = path.join(root, '.env.local')

function parseEnvLine(line) {
  const t = line.trim()
  if (!t || t.startsWith('#')) return null
  const eq = t.indexOf('=')
  if (eq <= 0) return null
  const key = t.slice(0, eq).trim()
  let val = t.slice(eq + 1).trim()
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1).trim()
  }
  return { key, val: val.replace(/^\uFEFF/, '') }
}

function main() {
  if (!fs.existsSync(envPath)) {
    console.error('Fehlt: .env.local im Projektroot (Kopie von .env.example, Werte eintragen).')
    process.exit(1)
  }
  const text = fs.readFileSync(envPath, 'utf8')
  const map = new Map()
  for (const line of text.split(/\r?\n/)) {
    const p = parseEnvLine(line)
    if (p) map.set(p.key, p.val)
  }

  const gemini = (map.get('GEMINI_API_KEY') || map.get('GOOGLE_GENERATIVE_AI_API_KEY') || '').trim()
  const openai = (map.get('OPENAI_API_KEY') || map.get('AI_API_KEY') || '').trim()
  const provider = (map.get('FINANCE_COACH_PROVIDER') || 'auto').trim().toLowerCase()

  console.log('KI-Konfiguration (.env.local, nur Anwesenheit — keine Secret-Werte):\n')
  console.log(`  GEMINI_API_KEY:         ${gemini ? 'gesetzt (' + gemini.length + ' Zeichen)' : '— leer —'}`)
  console.log(`  OPENAI_API_KEY:         ${openai ? 'gesetzt (' + openai.length + ' Zeichen)' : '— leer —'}`)
  console.log(`  FINANCE_COACH_PROVIDER: ${provider || 'auto'}`)

  const ok =
    (provider === 'gemini' && gemini) ||
    (provider === 'openai' && openai) ||
    (provider === 'auto' && (gemini || openai))

  if (!ok) {
    console.log('\n→ Kein nutzbarer Schlüssel für den gewählten Modus. Siehe .env.example.\n')
    process.exit(1)
  }
  console.log('\n→ Lokal sollte resolveCoachProvider mindestens einen Anbieter finden. Dev-Server neu starten nach Änderungen.\n')
  console.log('→ Online (Vercel & Co.): dieselben Variablen im Hosting-Dashboard setzen — .env.local wird nicht deployt.\n')
  process.exit(0)
}

main()
