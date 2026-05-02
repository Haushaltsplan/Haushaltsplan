import type { WetterTagPrognose } from '@/lib/region-haarbach'
import { windHimmelsrichtungAusGrad, windHimmelsrichtungKurz } from '@/lib/region-haarbach'

export function iconKategorie(
  code: number,
): 'sonne' | 'halb' | 'wolke' | 'nebel' | 'niesel' | 'regen' | 'schnee' | 'gewitter' {
  if (code === 0 || code === 1) return 'sonne'
  if (code === 2) return 'halb'
  if (code === 3) return 'wolke'
  if (code === 45 || code === 48) return 'nebel'
  if (code >= 51 && code <= 57) return 'niesel'
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'regen'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'schnee'
  if (code >= 95) return 'gewitter'
  return 'wolke'
}

export type HimmelKategorie = ReturnType<typeof iconKategorie> | 'mond' | 'halb_nacht'

/** Tags/Wettercodes mit klarem Himmel zeigen bei Nacht Mond statt Sonne (API-Codes sind tagesneutral). */
export function iconKategorieAnzeige(code: number, nacht: boolean): HimmelKategorie {
  if (nacht) {
    if (code === 0 || code === 1) return 'mond'
    if (code === 2) return 'halb_nacht'
  }
  return iconKategorie(code)
}

export function WetterHimmelIcon({
  kategorie,
  className,
  pixel = 140,
}: {
  kategorie: HimmelKategorie
  className?: string
  pixel?: number
}) {
  const cn = `shrink-0 ${className ?? ''}`
  switch (kategorie) {
    case 'sonne':
      return (
        <svg className={cn} viewBox="0 0 128 128" width={pixel} height={pixel} aria-hidden>
          <circle cx="64" cy="64" r="24" className="fill-amber-300" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const rad = (deg * Math.PI) / 180
            const x1 = 64 + Math.cos(rad) * 36
            const y1 = 64 + Math.sin(rad) * 36
            const x2 = 64 + Math.cos(rad) * 50
            const y2 = 64 + Math.sin(rad) * 50
            return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-amber-200/90" strokeWidth="5" strokeLinecap="round" />
          })}
        </svg>
      )
    case 'halb':
      return (
        <svg className={cn} viewBox="0 0 128 128" width={pixel} height={pixel} aria-hidden>
          <circle cx="46" cy="58" r="22" className="fill-amber-300" />
          <path
            d="M 70 40 Q 100 50 100 80 Q 100 102 80 110 Q 40 100 50 64"
            className="fill-slate-500/80"
          />
        </svg>
      )
    case 'mond':
      return (
        <svg className={cn} viewBox="0 0 128 128" width={pixel} height={pixel} aria-hidden>
          <circle cx="62" cy="58" r="24" className="fill-slate-200/95" />
          <circle cx="78" cy="48" r="19" className="fill-zinc-950" />
        </svg>
      )
    case 'halb_nacht':
      return (
        <svg className={cn} viewBox="0 0 128 128" width={pixel} height={pixel} aria-hidden>
          <circle cx="42" cy="56" r="20" className="fill-slate-200/95" />
          <circle cx="54" cy="48" r="15" className="fill-zinc-950" />
          <path
            d="M 70 40 Q 100 50 100 80 Q 100 102 80 110 Q 40 100 50 64"
            className="fill-slate-500/78"
          />
        </svg>
      )
    case 'wolke':
      return (
        <svg className={cn} viewBox="0 0 128 128" width={pixel} height={pixel} aria-hidden>
          <path
            d="M 40 90 Q 25 80 32 64 Q 28 48 50 50 Q 60 30 80 40 Q 100 32 100 55 Q 115 60 110 80 Q 108 100 80 100 L 40 90 Z"
            className="fill-slate-500"
          />
        </svg>
      )
    case 'nebel':
      return (
        <svg className={cn} viewBox="0 0 128 128" width={pixel} height={pixel} aria-hidden>
          <rect x="20" y="50" width="88" height="6" rx="3" className="fill-slate-500/50" />
          <rect x="12" y="64" width="96" height="6" rx="3" className="fill-slate-500/40" />
          <rect x="24" y="78" width="80" height="6" rx="3" className="fill-slate-500/35" />
        </svg>
      )
    case 'niesel':
    case 'regen':
      return (
        <svg className={cn} viewBox="0 0 128 128" width={pixel} height={pixel} aria-hidden>
          <path
            d="M 36 78 Q 22 70 30 55 Q 26 40 50 44 Q 58 24 80 32 Q 98 28 100 50 Q 112 55 108 70 Q 100 90 70 90 Z"
            className="fill-slate-500"
          />
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1={40 + i * 14}
              y1={88}
              x2={32 + i * 14}
              y2={110}
              className="stroke-sky-400/90"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}
        </svg>
      )
    case 'schnee':
      return (
        <svg className={cn} viewBox="0 0 128 128" width={pixel} height={pixel} aria-hidden>
          <path
            d="M 36 78 Q 22 70 30 55 Q 26 40 50 44 Q 58 24 80 32 Q 98 28 100 50 Q 112 55 108 70 Q 100 90 70 90 Z"
            className="fill-slate-500"
          />
          {[
            [48, 96],
            [64, 104],
            [80, 96],
            [56, 110],
            [72, 112],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2.5" className="fill-slate-200" />
          ))}
        </svg>
      )
    case 'gewitter':
      return (
        <svg className={cn} viewBox="0 0 128 128" width={pixel} height={pixel} aria-hidden>
          <path
            d="M 36 78 Q 22 70 30 55 Q 26 40 50 44 Q 58 24 80 32 Q 98 28 100 50 Q 112 55 108 70 Q 100 90 70 90 Z"
            className="fill-slate-600"
          />
          <path d="M 68 50 L 52 84 H 64 L 56 120 L 84 70 H 70 L 78 50 Z" className="fill-amber-300" />
        </svg>
      )
  }
}

export function prognoseKopfzeile(index: number, datumIso: string): string {
  if (index === 0) return 'Morgen'
  if (index === 1) return 'Übermorgen'
  try {
    return new Date(`${datumIso}T12:00:00`).toLocaleDateString('de-DE', {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
    })
  } catch {
    return datumIso
  }
}

export function WindIkon({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'h-5 w-5 text-sky-300/90'} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 9h9a2.5 2.5 0 0 0 0-5M3 12h12a2.5 2.5 0 0 1 0 5M3 15h5.5a2 2 0 0 0 0 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

const kachelKlasse =
  'flex min-w-[4.75rem] snap-center w-full flex-col items-center gap-1.5 rounded-xl border border-slate-800/70 bg-slate-900/50 px-2 py-3 sm:min-w-0'

type KachelProps = {
  tag: WetterTagPrognose
  index: number
  onClick?: () => void
  /** bei Klick-Modus: ausgewählter Tag */
  selected?: boolean
}

export function PrognoseTagKachel({ tag, index, onClick, selected }: KachelProps) {
  const kat = iconKategorie(tag.wmoCode)
  const g = tag.windRichtungGrad
  const teile: string[] = []
  if (tag.windKmh != null) teile.push(`max. ${tag.windKmh} km/h`)
  if (g != null) teile.push(windHimmelsrichtungAusGrad(g))
  if (tag.windBoeenKmh != null && tag.windBoeenKmh > (tag.windKmh ?? 0)) {
    teile.push(`Böen bis ${tag.windBoeenKmh} km/h`)
  }
  const windTitel = teile.length ? `Wind: ${teile.join(' · ')}` : ''

  const inhalt = (
    <>
      <p className="text-center text-[10px] font-bold uppercase leading-tight tracking-tight text-slate-500">
        {prognoseKopfzeile(index, tag.datumIso)}
      </p>
      <WetterHimmelIcon kategorie={kat} pixel={52} className="opacity-95" />
      <p className="text-center text-[9px] leading-tight text-slate-500 line-clamp-2">{tag.zustandDe}</p>
      <p className="text-sm font-black tabular-nums text-slate-100">
        {tag.tMin}° / {tag.tMax}°
      </p>
      {tag.windKmh != null || tag.windBoeenKmh != null || g != null ? (
        <div className="mt-0.5 w-full space-y-0.5 border-t border-slate-800/60 pt-1.5 text-center">
          <p className="flex min-h-[1em] items-center justify-center gap-0.5 text-[8px] leading-tight text-slate-500">
            {tag.windKmh != null ? (
              <>
                <WindIkon className="h-3 w-3 shrink-0 text-sky-400/80" />
                <span className="tabular-nums">max. {tag.windKmh}</span>
                {g != null ? (
                  <span>
                    <span className="text-slate-600">·</span> {windHimmelsrichtungKurz(g)}
                  </span>
                ) : null}
              </>
            ) : g != null ? (
              <span>
                <WindIkon className="h-3 w-3 shrink-0 text-sky-400/80" />
                {windHimmelsrichtungKurz(g)}
              </span>
            ) : tag.windBoeenKmh != null ? (
              <span>
                <WindIkon className="h-3 w-3 shrink-0 text-sky-400/80" />
                <span className="tabular-nums">Böen {tag.windBoeenKmh}</span>
              </span>
            ) : null}
          </p>
          {tag.windBoeenKmh != null && tag.windBoeenKmh > (tag.windKmh ?? 0) && tag.windKmh != null ? (
            <p className="text-[8px] leading-tight text-amber-200/70">Böen {tag.windBoeenKmh}</p>
          ) : null}
        </div>
      ) : null}
    </>
  )

  const title = [tag.zustandDe, windTitel || undefined].filter(Boolean).join(' — ')
  const klickCls = onClick
    ? `${kachelKlasse} transition hover:border-cyan-700/50 hover:bg-slate-900/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500/60 ${
        selected ? 'border-cyan-600/60 ring-2 ring-cyan-500/50' : ''
      }`
    : kachelKlasse

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={klickCls}
        title={title}
        aria-pressed={selected}
        aria-label={`Tageszeiten für ${prognoseKopfzeile(index, tag.datumIso)} anzeigen`}
      >
        {inhalt}
      </button>
    )
  }
  return (
    <div className={kachelKlasse} title={title}>
      {inhalt}
    </div>
  )
}
