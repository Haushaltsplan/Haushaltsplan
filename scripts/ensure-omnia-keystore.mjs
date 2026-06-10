#!/usr/bin/env node
/**
 * Festes Debug-Keystore für Omnia — gleiche Signatur bei jedem Build,
 * damit Android Studio Run die App überschreibt (kein Deinstallieren nötig).
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const keystore = path.join(root, 'android', 'omnia-debug.keystore')
function findeKeytool() {
  if (process.env.JAVA_HOME) {
    const k = path.join(process.env.JAVA_HOME, 'bin', 'keytool' + (process.platform === 'win32' ? '.exe' : ''))
    if (fs.existsSync(k)) return k
  }
  const studioJbr =
    process.platform === 'win32'
      ? 'C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\keytool.exe'
      : null
  if (studioJbr && fs.existsSync(studioJbr)) return studioJbr
  return 'keytool'
}

if (!fs.existsSync(keystore)) {
  const keytool = findeKeytool()
  console.log('Erstelle Omnia-Debug-Keystore (einmalig) …')
  execSync(
    [
      `"${keytool}"`,
      '-genkeypair -v',
      `-keystore "${keystore}"`,
      '-alias omnia',
      '-keyalg RSA -keysize 2048 -validity 36500',
      '-storepass omnia-dev -keypass omnia-dev',
      '-dname "CN=Omnia Dev, OU=Dev, O=Omnia, L=Local"',
    ].join(' '),
    { stdio: 'inherit', shell: true },
  )
}
