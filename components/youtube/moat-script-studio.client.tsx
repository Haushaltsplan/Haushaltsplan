'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  felderLabel,
  felderZumOptimieren,
  pruefeMoatScript,
  type StudioFeldId,
  type SupervisorFund,
} from '@/lib/youtube/moat-script-supervisor'
import type { MoatShortErgebnis, MoatShortHookVariante } from '@/lib/youtube/moat-short-types'
import { hookKarteFuerUnternehmen } from '@/lib/youtube/moat-short-script'
import { heroMetricAus } from '@/lib/youtube/moat-hero-metric'
import type { MoatShortProps } from '@/remotion/moat-short-types'

const studioFeld =
  'w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-[13px] text-neutral-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] focus:border-emerald-400/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/25'

const WINKEL_LABEL: Record<string, string> = {
  number_shock: 'Zahl schockt',
  contrast: 'Kontrast',
  stakes: 'Was auf dem Spiel steht',
}

type Props = {
  props: MoatShortProps
  ergebnis: MoatShortErgebnis
  tempo: number
  geschaeft: string
  hookKarten: MoatShortHookVariante[]
  onProps: (next: MoatShortProps | ((p: MoatShortProps) => MoatShortProps)) => void
  onHookWahl: (frage: string, antwort: string, metrikId: string) => void
  onScriptKopieren: () => void
}

function stufeFarbe(stufe: SupervisorFund['stufe']): string {
  if (stufe === 'ok') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
  if (stufe === 'warn') return 'border-amber-500/40 bg-amber-500/10 text-amber-100'
  return 'border-rose-500/40 bg-rose-500/10 text-rose-100'
}

function felderFunds(funds: SupervisorFund[], feld: StudioFeldId): SupervisorFund[] {
  return funds.filter((f) => f.feld === feld)
}

function FeldKopf({
  label,
  hilfe,
  funds,
  busy,
  onOptimieren,
}: {
  label: string
  hilfe: string
  funds: SupervisorFund[]
  busy: boolean
  onOptimieren: () => void
}) {
  const schlecht = funds.find((f) => f.stufe === 'fail') ?? funds.find((f) => f.stufe === 'warn')
  return (
    <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">{label}</p>
          {schlecht ? (
            <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${stufeFarbe(schlecht.stufe)}`}>
              {schlecht.stufe === 'fail' ? 'Fix nötig' : 'Prüfen'}
            </span>
          ) : (
            <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${stufeFarbe('ok')}`}>OK</span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-neutral-500">{hilfe}</p>
        {schlecht ? <p className="mt-1 text-[11px] text-amber-200/90">{schlecht.hinweis}</p> : null}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onOptimieren}
        className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-100 hover:border-emerald-400/70 disabled:opacity-50"
      >
        {busy ? 'KI…' : 'KI optimieren'}
      </button>
    </div>
  )
}

export function MoatScriptStudio({
  props,
  ergebnis,
  tempo,
  geschaeft,
  hookKarten,
  onProps,
  onHookWahl,
  onScriptKopieren,
}: Props) {
  const [busyFeld, setBusyFeld] = useState<StudioFeldId | null>(null)
  const [batchLaedt, setBatchLaedt] = useState(false)
  const [orientierung, setOrientierung] = useState('')

  const bericht = useMemo(() => pruefeMoatScript(props, ergebnis.metriken, tempo), [props, ergebnis.metriken, tempo])

  function setze<K extends keyof MoatShortProps>(key: K, wert: MoatShortProps[K]) {
    onProps((p) => ({ ...p, [key]: wert }))
  }

  async function optimiere(
    feld: StudioFeldId,
    hinweis?: string,
    stand?: MoatShortProps,
    opts?: { still?: boolean },
  ): Promise<MoatShortProps | null> {
    const basis = stand ?? props
    setBusyFeld(feld)
    try {
      const res = await fetch('/api/youtube/script-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          props: basis,
          feld,
          hinweis,
          orientierung: orientierung.trim() || undefined,
          geschaeft,
        }),
      })
      const j = (await res.json()) as {
        ok?: boolean
        text?: string
        props?: MoatShortProps
        quelle?: string
        fehler?: string
        error?: string
      }
      if (!res.ok || !j.ok || !j.props) {
        toast.error(j.fehler || j.error || 'Optimierung fehlgeschlagen.')
        return null
      }
      onProps(j.props)
      if (!opts?.still) {
        toast.success(
          j.quelle === 'lokal'
            ? `${felderLabel(feld)} lokal korrigiert (KI nicht erreichbar).`
            : `${felderLabel(feld)} per KI geschärft.`,
        )
      }
      return j.props
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Optimierung fehlgeschlagen.')
      return null
    } finally {
      setBusyFeld(null)
    }
  }

  async function kritischeFixen() {
    const liste = felderZumOptimieren(bericht).filter((f) =>
      bericht.funds.some((x) => x.feld === f && x.stufe === 'fail' && x.optimierbar),
    )
    if (!liste.length) {
      toast.success('Keine kritischen Punkte.')
      return
    }
    setBatchLaedt(true)
    let aktuell = props
    let ok = 0
    try {
      for (const feld of liste) {
        const hinweis = bericht.funds.find((f) => f.feld === feld && f.stufe === 'fail')?.hinweis
        const next = await optimiere(feld, hinweis, aktuell, { still: true })
        if (!next) break
        aktuell = next
        ok += 1
      }
      if (ok === liste.length) toast.success(`${ok} kritische Punkte nachgezogen.`)
      else if (ok > 0) toast.error(`${ok}/${liste.length} Felder geschafft — Rest abgebrochen.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Batch fehlgeschlagen.')
    } finally {
      setBusyFeld(null)
      setBatchLaedt(false)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-950/90 p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">Script studio</p>
          <button
            type="button"
            onClick={onScriptKopieren}
            className="rounded-full border border-neutral-800 bg-neutral-950 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-200 hover:border-neutral-600"
          >
            Script kopieren
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
              bericht.bereit ? 'border-emerald-500/40 text-emerald-200' : 'border-amber-500/40 text-amber-200'
            }`}
          >
            Shorts-Score {bericht.score}/100
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
              bericht.dauerOk ? 'border-emerald-500/40 text-emerald-200' : 'border-amber-500/40 text-amber-200'
            }`}
          >
            ~{bericht.sekunden.toFixed(0)}s · Ziel 27–32s
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
        <label htmlFor="moat-ki-orientierung" className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-200/80">
          KI-Hinweis
        </label>
        <p className="mt-1 text-[11px] text-neutral-400">
          Orientiert jeden „KI optimieren“- und Fix-Aufruf — z.&nbsp;B. Ton, Fokus, was falsch ist, woran sie sich halten soll.
        </p>
        <textarea
          id="moat-ki-orientierung"
          value={orientierung}
          onChange={(e) => setOrientierung(e.target.value)}
          rows={2}
          maxLength={800}
          placeholder="z. B. Mehr Lager-Netz und Wholesale, weniger Abstraktion. Crack = stagnante Renewal-Rates, nicht Image."
          className={`${studioFeld} mt-2 border-emerald-500/25`}
        />
        <p className="mt-1 text-right font-mono text-[10px] text-neutral-600">{orientierung.length}/800</p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-black/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">YouTube Shorts Überwacher</p>
            <p className="mt-1 text-sm text-neutral-200">
              {bericht.bereit
                ? 'Bereit für Stimme und Render.'
                : `${bericht.fail} kritisch · ${bericht.warn} Hinweise`}
            </p>
          </div>
          <button
            type="button"
            disabled={batchLaedt || busyFeld != null || bericht.fail === 0}
            onClick={() => void kritischeFixen()}
            className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-rose-100 hover:border-rose-400/70 disabled:opacity-50"
          >
            {batchLaedt ? 'Fixe…' : 'Kritische Punkte fixen'}
          </button>
        </div>
        {bericht.funds.length ? (
          <ul className="mt-3 max-h-40 space-y-1.5 overflow-y-auto pr-1">
            {bericht.funds.slice(0, 10).map((f) => (
              <li key={f.id} className="flex flex-wrap items-start justify-between gap-2 text-[11px]">
                <span className={`mt-0.5 rounded-full border px-1.5 py-0.5 font-mono text-[9px] uppercase ${stufeFarbe(f.stufe)}`}>
                  {felderLabel(f.feld)}
                </span>
                <span className="min-w-0 flex-1 text-neutral-300">{f.hinweis}</span>
                {f.optimierbar && f.feld !== 'gesamt' ? (
                  <button
                    type="button"
                    disabled={busyFeld != null || batchLaedt}
                    onClick={() => void optimiere(f.feld, f.hinweis)}
                    className="shrink-0 font-mono text-[10px] text-emerald-300 underline disabled:opacity-50"
                  >
                    Fix
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11px] text-emerald-200/90">Keine Beanstandungen.</p>
        )}
      </div>

      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">Hook wählen</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {hookKarten.map((h) => {
            const m = ergebnis.metriken.find((x) => x.id === h.metrikId)
            const karte = hookKarteFuerUnternehmen({
              winkel: h.winkel,
              claim: h.claim,
              proof: h.proof,
              firma: props.firmenname,
              wert: m?.value ?? props.metricValue,
              label: m?.label ?? props.metricLabel,
              id: m?.id ?? h.metrikId,
              kontext: geschaeft,
            })
            const aktiv = props.hook === karte.frage && props.proof === karte.antwort
            return (
              <button
                key={`${h.winkel}-${h.metrikId}`}
                type="button"
                aria-pressed={aktiv}
                onClick={() => onHookWahl(karte.frage, karte.antwort, h.metrikId)}
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  aktiv
                    ? 'border-emerald-400/70 bg-emerald-400/10 shadow-[0_0_24px_rgba(52,211,153,0.16)]'
                    : 'border-neutral-800 bg-neutral-950 hover:border-neutral-600'
                }`}
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-300/80">
                  {WINKEL_LABEL[h.winkel] ?? h.winkel}
                </span>
                <span className="mt-2 block text-sm font-medium text-neutral-100">{karte.frage}</span>
                <span className="mt-1 block font-mono text-[11px] leading-relaxed text-neutral-400">{karte.antwort}</span>
              </button>
            )
          })}
        </div>
      </div>

      <section className="space-y-3 rounded-xl border border-neutral-800 bg-black/30 p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">1 · Intro (Sekunde 0–6)</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <FeldKopf
              label="Blickfang"
              hilfe="Nur Bild. Ideal: vs. N% industry avg."
              funds={felderFunds(bericht.funds, 'kicker')}
              busy={busyFeld === 'kicker'}
              onOptimieren={() => void optimiere('kicker', felderFunds(bericht.funds, 'kicker')[0]?.hinweis)}
            />
            <input value={props.kicker} onChange={(e) => setze('kicker', e.target.value)} className={studioFeld} />
          </div>
          <div>
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">Große Zahl</p>
            <p className="mb-1 text-[11px] text-neutral-500">Ab Satz 2 im Bild. Muss zur Antwort passen.</p>
            <select
              value={ergebnis.metriken.find((m) => m.value === props.metricValue && m.label === props.metricLabel)?.id ?? ''}
              onChange={(e) => {
                const m = ergebnis.metriken.find((x) => x.id === e.target.value)
                if (!m) return
                onProps((p) => ({
                  ...p,
                  metricValue: m.value,
                  metricLabel: m.label,
                  proof: heroMetricAus(m.value, m.label, p.proof).spoken_reference,
                  heroMetric: heroMetricAus(m.value, m.label, p.proof),
                }))
              }}
              className={studioFeld}
            >
              {ergebnis.metriken
                .filter((m) => m.hook)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} · {m.value}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div>
          <FeldKopf
            label="Frage"
            hilfe="Gesprochen ab Sekunde 0. Ohne die Zahl."
            funds={felderFunds(bericht.funds, 'hook')}
            busy={busyFeld === 'hook'}
            onOptimieren={() => void optimiere('hook', felderFunds(bericht.funds, 'hook')[0]?.hinweis)}
          />
          <textarea value={props.hook} onChange={(e) => setze('hook', e.target.value)} rows={2} className={studioFeld} />
        </div>
        <div>
          <FeldKopf
            label="Antwort"
            hilfe="Branchenvergleich + Hero-Zahl + and it starts with"
            funds={felderFunds(bericht.funds, 'proof')}
            busy={busyFeld === 'proof'}
            onOptimieren={() => void optimiere('proof', felderFunds(bericht.funds, 'proof')[0]?.hinweis)}
          />
          <textarea value={props.proof} onChange={(e) => setze('proof', e.target.value)} rows={2} className={studioFeld} />
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-neutral-800 bg-black/30 p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">2 · Moat-Karten</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {props.pillars.map((p, i) => {
            const feld = `pillar${i}` as StudioFeldId
            return (
              <div key={p.id} className="rounded-lg border border-neutral-800 bg-neutral-950 p-2.5">
                <FeldKopf
                  label={`${p.label} · ${p.score}/10`}
                  hilfe="Vollständiger Satz mit Objekt und Punkt."
                  funds={felderFunds(bericht.funds, feld)}
                  busy={busyFeld === feld}
                  onOptimieren={() => void optimiere(feld, felderFunds(bericht.funds, feld)[0]?.hinweis)}
                />
                <input
                  value={p.line}
                  onChange={(e) =>
                    setze(
                      'pillars',
                      props.pillars.map((x, j) => (j === i ? { ...x, line: e.target.value } : x)),
                    )
                  }
                  className={studioFeld}
                />
                <select
                  value={ergebnis.metriken.find((m) => m.value === p.stat?.value && m.label === p.stat?.label)?.id ?? ''}
                  onChange={(e) => {
                    const m = ergebnis.metriken.find((x) => x.id === e.target.value)
                    setze(
                      'pillars',
                      props.pillars.map((x, j) => (j === i ? { ...x, stat: m ? { value: m.value, label: m.label } : null } : x)),
                    )
                  }}
                  className={`${studioFeld} mt-2 text-xs`}
                >
                  <option value="">Kein Zahlen-Schild</option>
                  {ergebnis.metriken.map((m) => (
                    <option key={m.id} value={m.id}>
                      Schild: {m.label} · {m.value}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-neutral-800 bg-black/30 p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">3 · Crack & Loop</p>
        <div>
          <FeldKopf
            label="The Crack"
            hilfe="Ein konkretes Finanzrisiko. Präzise Begriffe."
            funds={felderFunds(bericht.funds, 'crack')}
            busy={busyFeld === 'crack'}
            onOptimieren={() => void optimiere('crack', felderFunds(bericht.funds, 'crack')[0]?.hinweis)}
          />
          <textarea value={props.crack} onChange={(e) => setze('crack', e.target.value)} rows={2} className={studioFeld} />
        </div>
        <div>
          <FeldKopf
            label="Landung"
            hilfe="Offene Brücke, endet mit so the question is"
            funds={felderFunds(bericht.funds, 'closing')}
            busy={busyFeld === 'closing'}
            onOptimieren={() => void optimiere('closing', felderFunds(bericht.funds, 'closing')[0]?.hinweis)}
          />
          <textarea value={props.closing} onChange={(e) => setze('closing', e.target.value)} rows={2} className={studioFeld} />
          <p className="mt-2 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-[11px] leading-relaxed text-neutral-400">
            <span className="text-neutral-100">{props.closing}</span>
            {' → '}
            {props.hook}
          </p>
        </div>
      </section>
    </div>
  )
}
