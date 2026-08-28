import { safeLocalStorageSetItem } from '@/lib/local-storage-safe'
import { ladeModeFotoBundle, speichereModeFotoBundle, type ModeFotoBundle } from '@/lib/modeberater/mode-fotos-idb'

export const MODEBERATER_STORAGE_KEY = 'omnia-modeberater-v1'
export const MODEBERATER_CHAT_KEY = 'omnia-modeberater-chat-v1'

export const MODE_STIL_OPTIONEN = [
  'Klassisch',
  'Smart Casual',
  'Business',
  'Streetwear',
  'Minimalistisch',
  'Sportlich',
  'Elegant',
  'Skandinavisch',
  'Vintage',
] as const

export const MODE_ANLASS_OPTIONEN = [
  'Alltag',
  'Büro / Arbeit',
  'Freizeit',
  'Date',
  'Sport',
  'Feier / Abend',
  'Reise',
  'Hochzeit / Anlass',
] as const

export const MODE_ERSCHEINUNG = [
  { id: '', label: 'Keine Angabe' },
  { id: 'maennlich', label: 'Männlich' },
  { id: 'weiblich', label: 'Weiblich' },
  { id: 'unbestimmt', label: 'Unbestimmt / anders' },
] as const

export const MODE_PERSON_FOTO_LABELS = ['Ganzkörper', 'Gesicht / Oberkörper', 'Aktuelles Outfit', 'Sonstiges'] as const

export type ModeProfil = {
  erscheinung: string
  alter: string
  groesseCm: string
  gewichtKg: string
  groesseOberteil: string
  groesseHose: string
  groesseSchuhe: string
  koerpertyp: string
  hautton: string
  haarfarbe: string
  bart: string
  augenfarbe: string
  stile: string[]
  farbenMag: string
  farbenNicht: string
  anlass: string
  budgetMin: string
  budgetMax: string
  notizen: string
}

export type ModeFoto = { mimeType: string; base64: string }

export type ModePersonFoto = ModeFoto & { id: string; label: string }

export type ModeKleidungItem = {
  id: string
  notiz: string
  url: string
  preisEur: string
  foto: ModeFoto | null
}

export type ModeBeraterStand = {
  profil: ModeProfil
  personFotos: ModePersonFoto[]
  kleidung: ModeKleidungItem[]
}

export function leeresModeProfil(): ModeProfil {
  return {
    erscheinung: '',
    alter: '',
    groesseCm: '',
    gewichtKg: '',
    groesseOberteil: '',
    groesseHose: '',
    groesseSchuhe: '',
    koerpertyp: '',
    hautton: '',
    haarfarbe: '',
    bart: '',
    augenfarbe: '',
    stile: [],
    farbenMag: '',
    farbenNicht: '',
    anlass: '',
    budgetMin: '',
    budgetMax: '',
    notizen: '',
  }
}

export function leererModeStand(): ModeBeraterStand {
  return { profil: leeresModeProfil(), personFotos: [], kleidung: [] }
}

function istFoto(raw: unknown): raw is ModeFoto {
  if (!raw || typeof raw !== 'object') return false
  const o = raw as Record<string, unknown>
  return typeof o.mimeType === 'string' && typeof o.base64 === 'string' && o.base64.length > 80
}

export function parseModeStand(raw: unknown): ModeBeraterStand {
  const leer = leererModeStand()
  if (!raw || typeof raw !== 'object') return leer
  const o = raw as Record<string, unknown>
  const p = o.profil && typeof o.profil === 'object' ? (o.profil as Record<string, unknown>) : {}
  const profil: ModeProfil = {
    ...leeresModeProfil(),
    erscheinung: typeof p.erscheinung === 'string' ? p.erscheinung : '',
    alter: typeof p.alter === 'string' ? p.alter : '',
    groesseCm: typeof p.groesseCm === 'string' ? p.groesseCm : '',
    gewichtKg: typeof p.gewichtKg === 'string' ? p.gewichtKg : '',
    groesseOberteil: typeof p.groesseOberteil === 'string' ? p.groesseOberteil : '',
    groesseHose: typeof p.groesseHose === 'string' ? p.groesseHose : '',
    groesseSchuhe: typeof p.groesseSchuhe === 'string' ? p.groesseSchuhe : '',
    koerpertyp: typeof p.koerpertyp === 'string' ? p.koerpertyp : '',
    hautton: typeof p.hautton === 'string' ? p.hautton : '',
    haarfarbe: typeof p.haarfarbe === 'string' ? p.haarfarbe : '',
    bart: typeof p.bart === 'string' ? p.bart : '',
    augenfarbe: typeof p.augenfarbe === 'string' ? p.augenfarbe : '',
    stile: Array.isArray(p.stile) ? p.stile.filter((s): s is string => typeof s === 'string').slice(0, 8) : [],
    farbenMag: typeof p.farbenMag === 'string' ? p.farbenMag : '',
    farbenNicht: typeof p.farbenNicht === 'string' ? p.farbenNicht : '',
    anlass: typeof p.anlass === 'string' ? p.anlass : '',
    budgetMin: typeof p.budgetMin === 'string' ? p.budgetMin : '',
    budgetMax: typeof p.budgetMax === 'string' ? p.budgetMax : '',
    notizen: typeof p.notizen === 'string' ? p.notizen : '',
  }

  const personFotos: ModePersonFoto[] = []
  if (Array.isArray(o.personFotos)) {
    for (const row of o.personFotos) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const mimeType = typeof r.mimeType === 'string' ? r.mimeType : 'image/jpeg'
      const base64 = typeof r.base64 === 'string' ? r.base64 : ''
      const id = typeof r.id === 'string' && r.id ? r.id : crypto.randomUUID()
      const label = typeof r.label === 'string' ? r.label : 'Sonstiges'
      if (!base64 && !id) continue
      personFotos.push({ id, label, mimeType, base64 })
      if (personFotos.length >= 4) break
    }
  }

  const kleidung: ModeKleidungItem[] = []
  if (Array.isArray(o.kleidung)) {
    for (const row of o.kleidung) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const fotoRaw = r.foto
      let foto: ModeFoto | null = null
      if (istFoto(fotoRaw)) {
        foto = { mimeType: fotoRaw.mimeType, base64: fotoRaw.base64 }
      } else if (fotoRaw && typeof fotoRaw === 'object') {
        const f = fotoRaw as Record<string, unknown>
        if (typeof f.mimeType === 'string' && f.mimeType) {
          foto = { mimeType: f.mimeType, base64: typeof f.base64 === 'string' ? f.base64 : '' }
        }
      }
      kleidung.push({
        id: typeof r.id === 'string' && r.id ? r.id : crypto.randomUUID(),
        notiz: typeof r.notiz === 'string' ? r.notiz : '',
        url: typeof r.url === 'string' ? r.url : '',
        preisEur: typeof r.preisEur === 'string' ? r.preisEur : '',
        foto,
      })
      if (kleidung.length >= 8) break
    }
  }

  return { profil, personFotos, kleidung }
}

export function ladeModeStand(): ModeBeraterStand {
  if (typeof window === 'undefined') return leererModeStand()
  try {
    const raw = window.localStorage.getItem(MODEBERATER_STORAGE_KEY)
    if (!raw) return leererModeStand()
    return parseModeStand(JSON.parse(raw) as unknown)
  } catch {
    return leererModeStand()
  }
}

export function speichereModeStand(stand: ModeBeraterStand): boolean {
  return safeLocalStorageSetItem(MODEBERATER_STORAGE_KEY, JSON.stringify(standOhneFotoBytes(stand)))
}

export function standOhneFotoBytes(stand: ModeBeraterStand): ModeBeraterStand {
  return {
    profil: stand.profil,
    personFotos: stand.personFotos.map((f) => ({
      id: f.id,
      label: f.label,
      mimeType: f.mimeType || 'image/jpeg',
      base64: '',
    })),
    kleidung: stand.kleidung.map((k) => ({
      ...k,
      foto: k.foto ? { mimeType: k.foto.mimeType || 'image/jpeg', base64: '' } : null,
    })),
  }
}

export function kleidungHatInhalt(k: ModeKleidungItem): boolean {
  return Boolean(k.foto?.base64 || k.foto?.mimeType || k.url.trim() || k.notiz.trim() || k.preisEur.trim())
}

export function bundleAusStand(stand: ModeBeraterStand): ModeFotoBundle {
  const kleidung: Record<string, ModeFoto> = {}
  for (const k of stand.kleidung) {
    if (k.foto?.base64) kleidung[k.id] = k.foto
  }
  return {
    person: stand.personFotos.filter((f) => f.base64.length > 80),
    kleidung,
  }
}

export async function ladeModeStandVollstaendig(): Promise<ModeBeraterStand> {
  const meta = ladeModeStand()
  const bundle = await ladeModeFotoBundle()
  const lsHatBytes =
    meta.personFotos.some((f) => f.base64.length > 80) ||
    meta.kleidung.some((k) => (k.foto?.base64.length ?? 0) > 80)

  let stand = meta
  if (bundle) {
    const byId = new Map(bundle.person.map((p) => [p.id, p]))
    stand = {
      ...meta,
      personFotos: meta.personFotos.map((f) => {
        const voll = byId.get(f.id)
        return voll?.base64 ? { ...f, mimeType: voll.mimeType, base64: voll.base64 } : f
      }),
      kleidung: meta.kleidung.map((k) => {
        const voll = bundle.kleidung[k.id]
        return voll?.base64 ? { ...k, foto: voll } : k
      }),
    }
    for (const p of bundle.person) {
      if (p.base64 && !stand.personFotos.some((x) => x.id === p.id)) stand.personFotos.push(p)
    }
  }

  if (lsHatBytes) {
    await speichereModeFotoBundle(bundleAusStand(stand))
    speichereModeStand(stand)
  }
  return stand
}

export async function speichereModeStandVollstaendig(stand: ModeBeraterStand): Promise<boolean> {
  const okLs = speichereModeStand(stand)
  await speichereModeFotoBundle(bundleAusStand(stand))
  void import('@/lib/client-state/client-state-sync').then(({ pushClientState }) => {
    pushClientState('modeberater', { stand: standOhneFotoBytes(stand), chat: ladeModeChat() })
    pushClientState('modeberater-fotos', bundleAusStand(stand))
  })
  return okLs
}

export function profilHatDaten(profil: ModeProfil): boolean {
  const p = profilFuerPrompt(profil)
  return Object.keys(p).length > 0
}

/** Bytes-Signatur: ändert sich nur bei Foto- oder Link-Wechsel. */
export function modeFotoSignatur(stand: ModeBeraterStand): string {
  const p = stand.personFotos.map((f) => `${f.id}:${f.base64.length}`).join(',')
  const k = stand.kleidung
    .filter(kleidungHatInhalt)
    .map((x) => `${x.id}:${x.foto?.base64.length ?? 0}:${x.url.trim()}`)
    .join(',')
  return `${p}#${k}`
}

export function standFuerKi(stand: ModeBeraterStand, mitFotos: boolean): ModeBeraterStand {
  const kleidung = stand.kleidung.filter(kleidungHatInhalt)
  if (mitFotos) return { ...stand, kleidung }
  return {
    profil: stand.profil,
    personFotos: stand.personFotos.map((f) => ({ ...f, base64: '' })),
    kleidung: kleidung.map((k) => ({ ...k, foto: k.foto ? { mimeType: k.foto.mimeType, base64: '' } : null })),
  }
}

export type ModeChatTurn = { role: 'user' | 'assistant'; content: string }

export function ladeModeChat(): ModeChatTurn[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(MODEBERATER_CHAT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: ModeChatTurn[] = []
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      if (r.role !== 'user' && r.role !== 'assistant') continue
      if (typeof r.content !== 'string' || !r.content.trim()) continue
      out.push({ role: r.role, content: r.content.slice(0, 8000) })
      if (out.length >= 40) break
    }
    return out
  } catch {
    return []
  }
}

export function speichereModeChat(messages: ModeChatTurn[]): void {
  safeLocalStorageSetItem(MODEBERATER_CHAT_KEY, JSON.stringify(messages.slice(-40)))
  void import('@/lib/client-state/client-state-sync').then(({ pushClientState }) => {
    pushClientState('modeberater', { stand: standOhneFotoBytes(ladeModeStand()), chat: messages.slice(-40) })
  })
}

export function loescheModeChat(): void {
  try {
    window.localStorage.removeItem(MODEBERATER_CHAT_KEY)
  } catch {
    /* ignore */
  }
  void import('@/lib/client-state/client-state-sync').then(({ pushClientState }) => {
    pushClientState('modeberater', { stand: standOhneFotoBytes(ladeModeStand()), chat: [] })
  })
}

export function urlsAusFreitext(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s<>"'()]+/gi) || []
  return found.map((u) => u.replace(/[.,;:!?)]+$/, '')).slice(0, 4)
}

/** Kompaktes JSON für den KI-Prompt — leere Felder weglassen. */
export function profilFuerPrompt(profil: ModeProfil): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  const map: Array<[keyof ModeProfil, string]> = [
    ['erscheinung', 'erscheinung'],
    ['alter', 'alter'],
    ['groesseCm', 'groesse_cm'],
    ['gewichtKg', 'gewicht_kg'],
    ['groesseOberteil', 'groesse_oberteil'],
    ['groesseHose', 'groesse_hose'],
    ['groesseSchuhe', 'groesse_schuhe'],
    ['koerpertyp', 'koerpertyp'],
    ['hautton', 'hautton'],
    ['haarfarbe', 'haarfarbe'],
    ['bart', 'bart'],
    ['augenfarbe', 'augenfarbe'],
    ['anlass', 'anlass'],
    ['budgetMin', 'budget_min_eur'],
    ['budgetMax', 'budget_max_eur'],
    ['farbenMag', 'farben_mag'],
    ['farbenNicht', 'farben_meiden'],
    ['notizen', 'notizen'],
  ]
  for (const [k, name] of map) {
    const v = String(profil[k] ?? '').trim()
    if (v) out[name] = v
  }
  if (profil.stile.length) out.stile = profil.stile
  return out
}
