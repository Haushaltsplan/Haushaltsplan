'use client'

export type HoehenprofilPunkt = { km: number; m: number }

/** SVG-Höhenprofil aus OpenTopoData-Stützpunkten (km auf X, m auf Y). */
export function RennradHoehenprofil({ profil }: { profil: HoehenprofilPunkt[] | null | undefined }) {
  const w = 560
  const h = 140
  const padL = 44
  const padR = 12
  const padT = 10
  const padB = 28

  if (!profil || profil.length < 2) {
    return (
      <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-4 text-center text-xs text-slate-500">
        Kein Höhenprofil (Höhendaten nicht verfügbar).
      </div>
    )
  }

  const kms = profil.map((p) => p.km)
  const ms = profil.map((p) => p.m)
  const minKm = Math.min(...kms)
  const maxKm = Math.max(...kms)
  const minM = Math.min(...ms)
  const maxM = Math.max(...ms)
  const spanKm = Math.max(0.001, maxKm - minKm)
  const spanM = Math.max(20, maxM - minM)
  const m0 = minM - spanM * 0.06
  const m1 = maxM + spanM * 0.06

  const xFor = (km: number) => padL + ((km - minKm) / spanKm) * (w - padL - padR)
  const yFor = (m: number) => padT + (1 - (m - m0) / (m1 - m0)) * (h - padT - padB)

  const pathD = profil
    .map((p, i) => {
      const x = xFor(p.km)
      const y = yFor(p.m)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const xt0 = xFor(minKm)
  const ytLo = yFor(m0)
  const ytHi = yFor(m1)

  let profilAufstieg = 0
  for (let i = 1; i < profil.length; i++) {
    const d = profil[i]!.m - profil[i - 1]!.m
    if (d > 0) profilAufstieg += d
  }

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 px-2 py-3 sm:px-3">
      <p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Höhenprofil (Schätzung)</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-full max-w-full" role="img" aria-label="Höhenprofil der Route">
        <rect x="0" y="0" width={w} height={h} fill="transparent" />
        <line x1={padL} y1={ytLo} x2={w - padR} y2={ytLo} stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
        <line x1={padL} y1={ytHi} x2={w - padR} y2={ytHi} stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
        <path d={pathD} fill="none" stroke="#fb7185" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <text x={padL} y={h - 6} fill="#64748b" style={{ fontSize: 10 }}>
          {minKm.toFixed(0)} km
        </text>
        <text x={w - padR - 36} y={h - 6} fill="#64748b" style={{ fontSize: 10 }} textAnchor="end">
          {maxKm.toFixed(0)} km
        </text>
        <text x={4} y={padT + 12} fill="#64748b" style={{ fontSize: 10 }}>
          {Math.round(m1)} m
        </text>
        <text x={4} y={h - padB - 4} fill="#64748b" style={{ fontSize: 10 }}>
          {Math.round(m0)} m
        </text>
        <text x={xt0} y={padT + 4} fill="#94a3b8" style={{ fontSize: 9 }}>
          Profil: +{Math.round(profilAufstieg)} hm
        </text>
      </svg>
    </div>
  )
}
