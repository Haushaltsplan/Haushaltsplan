/**
 * Bootstrap / Sync / APK für die separate Omnia-Whoop Capacitor-App.
 * Capacitor CLI kennt hier kein --config → wir tauschen kurz capacitor.config.ts.
 *
 * npm run whoop:apk      → Omnia-Whoop-debug.apk im Projektroot
 * npm run whoop:install  → APK bauen + adb install -r
 */
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync, rmSync } from 'fs'
import { join, relative } from 'path'
import { spawnSync } from 'child_process'

const ROOT = process.cwd()
const WHOOP_ANDROID = join(ROOT, 'apps', 'omnia-whoop', 'android')
const SOURCE_ANDROID = join(ROOT, 'android')
const MAIN_CONFIG = join(ROOT, 'capacitor.config.ts')
const WHOOP_CONFIG = join(ROOT, 'capacitor.whoop.config.ts')
const MAIN_CONFIG_BAK = join(ROOT, 'capacitor.config.ts.omnia-bak')

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, cwd: ROOT, ...opts })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

function ensureJavaHome() {
  if (process.env.JAVA_HOME && existsSync(join(process.env.JAVA_HOME, 'bin', 'java.exe'))) return
  const candidates = [
    'C:\\Program Files\\Android\\Android Studio\\jbr',
    'C:\\Program Files\\Android\\Android Studio\\jre',
  ]
  for (const c of candidates) {
    if (existsSync(join(c, 'bin', 'java.exe'))) {
      process.env.JAVA_HOME = c
      console.log('JAVA_HOME → ' + c)
      return
    }
  }
  console.error('JAVA_HOME fehlt und Android Studio JBR nicht gefunden.')
  process.exit(1)
}

function withWhoopConfig(fn) {
  if (!existsSync(WHOOP_CONFIG)) {
    console.error('Fehlt: capacitor.whoop.config.ts')
    process.exit(1)
  }
  cpSync(MAIN_CONFIG, MAIN_CONFIG_BAK)
  cpSync(WHOOP_CONFIG, MAIN_CONFIG)
  try {
    return fn()
  } finally {
    if (existsSync(MAIN_CONFIG_BAK)) {
      cpSync(MAIN_CONFIG_BAK, MAIN_CONFIG)
      unlinkSync(MAIN_CONFIG_BAK)
    }
  }
}

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'build' || name === '.gradle' || name === 'capacitor-cordova-android-plugins') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walkFiles(p, out)
    else out.push(p)
  }
  return out
}

function replaceInFile(file) {
  const raw = readFileSync(file, 'utf8')
  let next = raw.split('de/omnia/haushalt').join('de/omnia/whoop')
  next = next.split('de.omnia.haushalt').join('de.omnia.whoop')
  next = next.split('OmniaCapacitor').join('OmniaWhoopCapacitor')
  if (next !== raw) writeFileSync(file, next)
}

function bootstrapAndroid() {
  mkdirSync(join(ROOT, 'apps', 'omnia-whoop'), { recursive: true })
  if (!existsSync(SOURCE_ANDROID)) {
    console.error('Kein android/ im Root — zuerst Omnia: npx cap add android')
    process.exit(1)
  }
  if (existsSync(WHOOP_ANDROID)) {
    console.log('apps/omnia-whoop/android existiert bereits — überspringe Kopie.')
  } else {
    console.log('Kopiere android/ → apps/omnia-whoop/android …')
    cpSync(SOURCE_ANDROID, WHOOP_ANDROID, {
      recursive: true,
      filter: (src) => {
        const rel = relative(SOURCE_ANDROID, src).replace(/\\/g, '/')
        if (rel.includes('/build/') || rel.startsWith('build/') || rel.includes('/.gradle/')) return false
        return true
      },
    })
  }

  const oldPkg = join(WHOOP_ANDROID, 'app', 'src', 'main', 'java', 'de', 'omnia', 'haushalt')
  const newPkg = join(WHOOP_ANDROID, 'app', 'src', 'main', 'java', 'de', 'omnia', 'whoop')
  if (existsSync(oldPkg)) {
    if (!existsSync(newPkg)) {
      mkdirSync(join(WHOOP_ANDROID, 'app', 'src', 'main', 'java', 'de', 'omnia'), { recursive: true })
      cpSync(oldPkg, newPkg, { recursive: true })
    }
    rmSync(oldPkg, { recursive: true, force: true })
  }

  for (const file of walkFiles(WHOOP_ANDROID)) {
    if (!/\.(java|xml|gradle|properties|kt|md|json)$/i.test(file)) continue
    replaceInFile(file)
  }

  const strings = join(WHOOP_ANDROID, 'app', 'src', 'main', 'res', 'values', 'strings.xml')
  if (existsSync(strings)) {
    let s = readFileSync(strings, 'utf8')
    s = s.replace(/>Omnia</g, '>Omnia Whoop<')
    writeFileSync(strings, s)
  }

  console.log('Bootstrap fertig.')
}

function ensureKeystore() {
  run('node', ['scripts/ensure-omnia-keystore.mjs'])
  const src = join(ROOT, 'android', 'omnia-debug.keystore')
  const dst = join(WHOOP_ANDROID, 'omnia-debug.keystore')
  if (existsSync(src) && !existsSync(dst)) cpSync(src, dst)
}

function capSyncWhoop() {
  withWhoopConfig(() => {
    run('npx', ['cap', 'sync', 'android'])
  })
}

function findeApk() {
  const candidates = [
    join(WHOOP_ANDROID, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
    join(WHOOP_ANDROID, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug-unsigned.apk'),
  ]
  return candidates.find((p) => existsSync(p)) ?? null
}

function buildApk() {
  if (!existsSync(WHOOP_ANDROID)) bootstrapAndroid()
  ensureKeystore()
  console.log('Capacitor sync (Whoop) …')
  capSyncWhoop()
  console.log('Gradle assembleDebug …')
  ensureJavaHome()
  const gradlew = join(WHOOP_ANDROID, 'gradlew.bat')
  const r = spawnSync(gradlew, ['assembleDebug'], {
    stdio: 'inherit',
    shell: true,
    cwd: WHOOP_ANDROID,
    env: { ...process.env, JAVA_HOME: process.env.JAVA_HOME },
  })
  if (r.status !== 0) process.exit(r.status ?? 1)
  const apk = findeApk()
  if (!apk) {
    console.error('APK nicht gefunden unter app/build/outputs/apk/debug/')
    process.exit(1)
  }
  const out = join(ROOT, 'Omnia-Whoop-debug.apk')
  cpSync(apk, out)
  console.log('')
  console.log('Fertig. APK liegt hier:')
  console.log('  ' + out)
  console.log('Aufs Handy kopieren und installieren (unbekannte Quellen erlauben).')
  return out
}

function installApk() {
  const out = buildApk()
  const r = spawnSync('adb', ['install', '-r', out], { stdio: 'inherit', shell: true, cwd: ROOT })
  if (r.status !== 0) {
    console.error('')
    console.error('adb install fehlgeschlagen — APK manuell aufs Handy laden:')
    console.error('  ' + out)
    process.exit(r.status ?? 1)
  }
  console.log('Installiert: de.omnia.whoop')
}

const cmd = process.argv[2] || 'sync'

if (cmd === 'bootstrap') {
  bootstrapAndroid()
} else if (cmd === 'sync') {
  if (!existsSync(WHOOP_ANDROID)) bootstrapAndroid()
  ensureKeystore()
  capSyncWhoop()
} else if (cmd === 'open') {
  withWhoopConfig(() => run('npx', ['cap', 'open', 'android']))
} else if (cmd === 'android') {
  if (!existsSync(WHOOP_ANDROID)) bootstrapAndroid()
  ensureKeystore()
  capSyncWhoop()
  withWhoopConfig(() => run('npx', ['cap', 'open', 'android']))
} else if (cmd === 'apk') {
  buildApk()
} else if (cmd === 'install') {
  installApk()
} else {
  console.error('Usage: node scripts/whoop-cap.mjs [bootstrap|sync|open|android|apk|install]')
  process.exit(1)
}
