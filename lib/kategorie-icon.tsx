'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'

function deutschLower(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
}

/**
 * Bekannte Bezeichnungen → Hostname für Google-Favicon (sieht oft wie ein kleines Markenlogo aus).
 * Längere / spezifischere Fragmente zuerst.
 */
const FRAGMENT_HOST: ReadonlyArray<[string, string]> = [
  ['aktien', 'traderepublic.com'],
  ['trade republic', 'traderepublic.com'],
  ['traderepublic', 'traderepublic.com'],
  ['mintos', 'mintos.com'],
  ['bondora', 'bondora.com'],
  ['peerberry', 'peerberry.com'],
  ['auxmoney', 'auxmoney.com'],
  ['estateguru', 'estateguru.co'],
  ['twino', 'twino.eu'],
  ['robocash', 'robocash.com'],
  ['scalable', 'scalable.capital'],
  ['uniprofirente', 'union-investment.de'],
  ['uniglobal fond', 'union-investment.de'],
  ['uniglobal', 'union-investment.de'],
  ['discovery+', 'discoveryplus.de'],
  ['discovery', 'discoveryplus.de'],
  ['netflix', 'netflix.com'],
  ['spotify', 'spotify.com'],
  ['amazon', 'amazon.de'],
  ['apple', 'apple.com'],
  ['telekom', 'telekom.de'],
  ['vodafone', 'vodafone.de'],
  ['o2 handy', 'o2online.de'],
  [' o2', 'o2online.de'],
  ['o2', 'o2online.de'],
  ['strava', 'strava.com'],
  ['whoop', 'whoop.com'],
  ['gemini', 'gemini.google.com'],
  ['allianz', 'allianz.de'],
  ['paypal', 'paypal.com'],
  ['deutsche bank', 'deutsche-bank.de'],
  ['comdirect', 'comdirect.de'],
  ['ing ', 'ing.de'],
  ['ing-diba', 'ing.de'],
  ['sparkasse', 'sparkasse.de'],
  ['volksbank', 'volksbank.de'],
  ['baufinanzierung', 'baufinanzierung.de'],
  ['versicherung', 'allianz.de'],
  ['rente', 'union-investment.de'],
  ['fond', 'union-investment.de'],
  ['youtube', 'youtube.com'],
  ['google', 'google.com'],
  ['microsoft', 'microsoft.com'],
  ['adobe', 'adobe.com'],
  ['dropbox', 'dropbox.com'],
  ['github', 'github.com'],
  ['rewe', 'rewe.de'],
  ['edeka', 'edeka.de'],
  ['lidl', 'lidl.de'],
  ['aldi sued', 'aldi-sued.de'],
  ['aldi nord', 'aldi-nord.de'],
  ['aldi', 'aldi.de'],
  ['kaufland', 'kaufland.de'],
  ['penny', 'penny.de'],
  ['netto', 'netto-online.de'],
  ['dm-drogerie', 'dm.de'],
  [' dm ', 'dm.de'],
  ['^dm$', 'dm.de'],
  ['rossmann', 'rossmann.de'],
  ['mueller', 'mueller.de'],
  ['shell', 'shell.de'],
  ['aral', 'aral.de'],
  ['total', 'totalenergies.de'],
  ['esso', 'esso.de'],
  ['mcdonald', 'mcdonalds.de'],
  ['burger king', 'burgerking.de'],
  ['ikea', 'ikea.com'],
  ['hornbach', 'hornbach.de'],
  ['obi', 'obi.de'],
  ['bauhaus', 'bauhaus.info'],
  ['saturn', 'saturn.de'],
  ['mediamarkt', 'mediamarkt.de'],
  ['siemens', 'siemens.com'],
  ['bosch', 'bosch.de'],
  ['mercedes', 'mercedes-benz.de'],
  ['bmw', 'bmw.de'],
  ['vw ', 'volkswagen.de'],
  ['volkswagen', 'volkswagen.de'],
  ['adac', 'adac.de'],
  ['postbank', 'postbank.de'],
  ['dhl', 'dhl.de'],
  ['hermes', 'hermesworld.com'],
  ['dpd', 'dpd.com'],
  ['ups ', 'ups.com'],
  ['zalando', 'zalando.de'],
  ['otto ', 'otto.de'],
  ['conrad', 'conrad.de'],
  ['thalia', 'thalia.de'],
]

function hostFuerKategorie(kategorie: string): string | null {
  const t = deutschLower(kategorie)
  if (!t) return null
  for (const [needle, host] of FRAGMENT_HOST) {
    if (needle.startsWith('^') && needle.endsWith('$')) {
      const core = needle.slice(1, -1)
      if (new RegExp(`^${core}$`).test(t)) return host
      continue
    }
    if (t.includes(needle)) return host
  }
  return null
}

function wortZuSlug(w: string) {
  return deutschLower(w).replace(/[^a-z0-9]/g, '')
}

/** Aus Freitext-Firma plausible Domains bauen (für Google-Favicon). */
function firmaZuHostKandidaten(name: string): string[] {
  const raw = name.trim()
  if (!raw) return []
  const noProto = raw.replace(/^https?:\/\//i, '').split('/')[0]?.trim() ?? ''
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(noProto) && noProto.includes('.')) {
    return [noProto.toLowerCase().replace(/^www\./, '')]
  }
  let core = raw.replace(/\s*(gmbh|ag|kg|ug|ohg|gbr|e\.k\.|e\.v\.|co\.?\s*kg|limited|ltd)\.?\s*$/i, '').trim()
  if (!core) core = raw
  const parts = core.split(/[\s/&,-]+/).filter((p) => p.length > 0)
  const out: string[] = []
  const seen = new Set<string>()
  const push = (host: string) => {
    const x = host.toLowerCase().replace(/^www\./, '')
    if (x.includes('.') && x.length > 3 && !seen.has(x)) {
      seen.add(x)
      out.push(x)
    }
  }
  for (const p of parts) {
    const sl = wortZuSlug(p)
    if (sl.length >= 2) {
      push(`${sl}.de`)
      push(`${sl}.com`)
    }
  }
  if (parts.length >= 2) {
    const a = wortZuSlug(parts[0])
    const b = wortZuSlug(parts[1])
    if (a.length >= 2 && b.length >= 2) {
      push(`${a}${b}.de`)
      push(`${a}-${b}.de`)
    }
  }
  const joined = wortZuSlug(parts.join(''))
  if (parts.length >= 2 && joined.length >= 4) push(`${joined}.de`)
  return out.slice(0, 10)
}

function FaviconKette({
  hosts,
  fallback,
  title,
  imgClassName = 'h-[70%] w-[70%] object-contain',
}: {
  hosts: string[]
  fallback: ReactNode
  title?: string
  imgClassName?: string
}) {
  const [i, setI] = useState(0)
  const key = hosts.join('|')
  useEffect(() => {
    setI(0)
  }, [key])
  if (hosts.length === 0 || i >= hosts.length) return <>{fallback}</>
  const src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hosts[i])}&sz=128`
  return (
    <img
      src={src}
      alt=""
      title={title}
      width={40}
      height={40}
      className={imgClassName}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setI((x) => x + 1)}
    />
  )
}

/** Schwäbisch Hall / Bausparkasse — eigenes gelbes Markenzeichen (vereinfachte Darstellung). */
function istSchwaebischHallKategorie(kategorie: string) {
  const t = deutschLower(kategorie)
  return t.includes('schwaebisch hall') || t.includes('bausparer')
}

function LogoSchwaebischHall({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="6" fill="#1e293b" />
      <path
        fill="#FFDD00"
        d="M6.5 7h5.2v18H6.5V7Zm7.1 0h5.2v10.2h-5.2V7Zm7.1 0H26v18h-5.3V7Zm-7.1 12.8h5.2V25h-5.2v-5.2Z"
      />
      <path fill="#EEC200" d="M13.6 17.2h5.2v3.6h-5.2v-3.6Z" opacity="0.95" />
    </svg>
  )
}

function istEinnahmeName(kategorie: string) {
  const t = kategorie.trim().toLowerCase()
  return /\b(lohn|gehalt|salary|einkommen)\b/.test(t) || t === 'lohn'
}

function IconGehaelt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconKalender({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  )
}

function IconAbbuchung({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 7h16M4 12h10M4 17h14" strokeLinecap="round" />
      <path d="M18 10v8l3-2.5L18 10Z" fill="currentColor" stroke="none" opacity="0.35" />
    </svg>
  )
}

function IconPerson({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

const SIZE_MAP = {
  sm: 'h-8 w-8 [&_svg]:h-4 [&_svg]:w-4',
  md: 'h-10 w-10 [&_svg]:h-5 [&_svg]:w-5',
} as const

export type KategorieMarkProps = {
  kategorie: string
  /** Aus Buchung / Dauerauftrag: Einnahme */
  isEinnahme?: boolean
  /** Geplanter Dauerauftrag (noch nicht gebucht) */
  geplant?: boolean
  groesse?: keyof typeof SIZE_MAP
  className?: string
}

export function KategorieMark({ kategorie, isEinnahme, geplant, groesse = 'md', className = '' }: KategorieMarkProps) {
  const fragmentHost = useMemo(() => hostFuerKategorie(kategorie), [kategorie])
  const inferredHosts = useMemo(() => firmaZuHostKandidaten(kategorie), [kategorie])
  const faviconHosts = useMemo(
    () => (fragmentHost ? [fragmentHost] : inferredHosts),
    [fragmentHost, inferredHosts],
  )
  const income = Boolean(isEinnahme) || istEinnahmeName(kategorie)
  const personHint = /\b(maximilian|eichlseder|person)\b/i.test(kategorie)
  const shMark = istSchwaebischHallKategorie(kategorie)

  const box = `${SIZE_MAP[groesse]} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--app-surface-muted)]/90 ring-1 ring-[var(--app-border-strong)]/80 ${className}`

  if (geplant && shMark) {
    return (
      <span
        className={`${box} ring-2 ring-amber-500/55`}
        title={`${kategorie} — geplant, noch nicht gebucht`}
        aria-label={`${kategorie}, geplant`}
      >
        <LogoSchwaebischHall className="h-[88%] w-[88%]" />
      </span>
    )
  }

  if (geplant) {
    if (faviconHosts.length > 0) {
      return (
        <span
          className={`${box} ring-2 ring-amber-500/55`}
          title={`${kategorie} — geplant, noch nicht gebucht`}
        >
          <FaviconKette
            hosts={faviconHosts}
            title={kategorie}
            fallback={<IconKalender className="text-amber-300" />}
          />
        </span>
      )
    }
    return (
      <span className={`${box} text-amber-400 ring-amber-600/50`} title="Geplant — noch nicht gebucht">
        <IconKalender className="text-amber-300" />
      </span>
    )
  }

  if (personHint) {
    return (
      <span className={`${box} text-[var(--app-text-muted)]`} title={kategorie}>
        <IconPerson />
      </span>
    )
  }

  if (income) {
    const nurGenerisch = /^(gehalt|lohn|salary|einkommen)$/.test(deutschLower(kategorie).replace(/\s+/g, ' ').trim())
    if (!nurGenerisch && faviconHosts.length > 0) {
      return (
        <span className={`${box} text-emerald-400 ring-emerald-700/40`} title={kategorie}>
          <FaviconKette
            hosts={faviconHosts}
            title={kategorie}
            fallback={<IconGehaelt />}
            imgClassName="h-[70%] w-[70%] object-contain"
          />
        </span>
      )
    }
    return (
      <span className={`${box} text-emerald-400 ring-emerald-700/40`} title="Einnahme">
        <IconGehaelt />
      </span>
    )
  }

  if (shMark) {
    return (
      <span className={box} title={kategorie} aria-label={kategorie}>
        <LogoSchwaebischHall className="h-[88%] w-[88%]" />
      </span>
    )
  }

  if (faviconHosts.length > 0) {
    return (
      <span className={box} title={kategorie}>
        <FaviconKette
          hosts={faviconHosts}
          title={kategorie}
          fallback={<IconAbbuchung />}
          imgClassName="h-[70%] w-[70%] object-contain"
        />
      </span>
    )
  }

  return (
    <span className={`${box} text-rose-300/90`} title={kategorie}>
      <IconAbbuchung />
    </span>
  )
}
