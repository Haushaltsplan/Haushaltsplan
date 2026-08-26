import { NextResponse } from 'next/server'
import { bauePortfolioBeraterKontext } from '@/lib/portfolio-analyse/portfolio-berater-kontext-server'
import {
  coachProviderSchluesselDiagnose,
  geminiApiKeyFreeConfigured,
  portfolioBeraterGeminiModelKandidaten,
  prepareCoachMessages,
  resolveGeminiFreeTierProvider,
  runCoachCompletion,
} from '@/lib/ki-coach-backend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180

function buildSystemPrompt(context: unknown): string {
  const contextBlock =
    context != null
      ? `\n\n--- Portfolio-Kontext (live aus der App, Stand siehe \`stand\`) ---\n${JSON.stringify(context)}\n---`
      : ''

  return `Du bist ein erfahrener Portfolio-Berater für einen privaten Qualitätsinvestor in Deutschland.
Du erhältst bei jeder Anfrage einen vollständigen JSON-Kontext aus der Portfolioanalyse-App:

- **depot:** Live-Positionen, Gewichte, G/V, Sektoren, Assetklassen, Klumpenrisiko, Monatsverlauf
- **nachkaufRadar.alleScanErgebnisse:** kompletter Scan (Ampel, Score, Score-Detail, Trim, Insider, Notizen, Kaufhistorie)
- **nachkaufRadar.monatsEmpfehlung:** regelbasierte Monats-Empfehlung des Radars
- **kaufempfehlung:** gespeicherte KI-Kaufempfehlung inkl. Allokation (falls vorhanden)
- **kiCache.earnings / kiCache.sec:** KI-Zusammenfassungen von Earnings Calls und SEC/IR-Berichten
- **quartalsDiff:** Veränderungen letzter vs. vorletzter SEC-/Earnings-Bericht (KI-Diff oder Cache-Gegenüberstellung)
- **deepResearch:** Deep-Research-Memos (Pro-Analysen)
- **watchlist / kandidatenWhitelist:** Watchlist + Whitelist-Kandidaten
- **marktRegime:** SPY vs. 20-Tage-MA, VIX
- **fundamentaldaten:** Cloud-Cache (GuV, Key Metrics, Mantra, historische Multiples, **roiic** = Incremental ROIC 3J). Fokus-Titel kann frisch gescraped werden. Ohne Cache: Scan-Fallback. **historie5j** enthält Umsatz/Gewinn/FCF plus KGV/KUV/KBV/Kurs-FCF/EV.
- **performance:** Nachkauf-Empfehlungs-Tracking (Rendite vs. SPY)

Bis zu 40 Titel aus dem Cache (Fokus am ausführlichsten). Nutze **roiic** und historische Multiples, nicht nur den Scan-Score.
- **Struktur & Risiko:** Klumpenrisiko, Sektor-/Asset-Konzentration, Diversifikation
- **Qualität & Bewertung:** Mantra, Premium/Discount, Drawdown, Kauftrigger, Gates G1–G3
- **Nachkauf-Radar & Trim:** Ampeln, Scores, Verkaufs-Signale, Disziplin-Hinweise
- **Quartalslage:** Earnings, SEC, Quartals-Diffs, Deep Research
- **Watchlist vs. Bestand:** Neukäufe haben höhere Hürde

Regeln:
- Antworte auf Deutsch, klar strukturiert (## Überschriften, Aufzählungen, **Kernzahlen** fett).
- Nutze NUR die mitgelieferten Daten; erfinde keine Kurse, Gewichte oder Scores.
- Wenn Daten fehlen, sage offen was fehlt und wo in der App es nachgeladen werden kann.
- Keine Garantien, keine absoluten Kauf-/Verkaufsanweisungen — Analyse-Assistent, keine lizenzierte Anlageberatung.
- Maximal ca. 15–20 Sätze, außer der Nutzer bittet ausdrücklich um mehr Detail.
- Wenn \`focus\` gesetzt ist, priorisiere diese Position.${contextBlock}`
}

function resolvePortfolioBeraterProvider() {
  return resolveGeminiFreeTierProvider()
}

export async function GET() {
  // Nur Key-Check. Der volle Kontext (8× Fundamentaldaten inkl. Kapitalbasis) gehört
  // ausschließlich in POST — sonst läuft genau dieser Status-Call in den Timeout, und
  // das Panel zeigt fälschlich „KI ist noch nicht eingerichtet“.
  const resolved = resolvePortfolioBeraterProvider()
  const diag = coachProviderSchluesselDiagnose()
  const isVercel = Boolean(process.env.VERCEL)

  return NextResponse.json({
    configured: Boolean(resolved),
    provider: resolved?.provider ?? 'gemini',
    freeTierKey: geminiApiKeyFreeConfigured(),
    schluessel: diag,
    depotKurz: null,
    ...(!resolved && isVercel
      ? {
          hostedNote:
            'Auf Vercel: GEMINI_API_KEY_FREE (kostenloses Google-AI-Studio-Kontingent) in Environment Variables setzen, Deployment neu bauen.',
        }
      : {}),
  })
}

export async function POST(req: Request) {
  const resolved = resolvePortfolioBeraterProvider()
  if (!resolved) {
    return NextResponse.json(
      {
        error:
          'KI ist nicht konfiguriert. Setze GEMINI_API_KEY_FREE (kostenloses Google-AI-Studio-Kontingent, Projekt ohne Billing) in .env.local, Dev-Server neu starten.',
      },
      { status: 501 },
    )
  }

  let body: {
    messages?: unknown[]
    focusIsin?: string
    focusTicker?: string
    seite?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const userMessages = prepareCoachMessages(Array.isArray(body.messages) ? body.messages : [])
  const last = userMessages[userMessages.length - 1]
  const lastHasText = last?.role === 'user' && typeof last.content === 'string' && last.content.trim().length > 0
  if (!userMessages.length || last?.role !== 'user' || !lastHasText) {
    return NextResponse.json(
      { error: 'Bitte eine Frage oder einen kurzen Text eingeben.' },
      { status: 400 },
    )
  }

  let context: unknown
  const t0 = Date.now()
  try {
    context = await bauePortfolioBeraterKontext({
      focusIsin: body.focusIsin,
      focusTicker: body.focusTicker,
      seite: body.seite,
    })
  } catch (e) {
    console.error('portfolio-berater kontext', e)
    return NextResponse.json({ error: 'Portfolio-Kontext konnte nicht geladen werden.' }, { status: 500 })
  }

  const systemText = buildSystemPrompt(context)
  console.info(
    `[portfolio-berater] kontext ${Date.now() - t0}ms, prompt ${systemText.length} Zeichen`,
  )

  try {
    const result = await runCoachCompletion(resolved.provider, resolved.apiKey, systemText, userMessages, {
      temperature: 0.45,
      geminiModels: portfolioBeraterGeminiModelKandidaten(),
      /** Nur Free-Tier — niemals GEMINI_API_KEY (Billing). Nachkauf-Radar bleibt separat auf Paid. */
      geminiForceFreeApiKey: true,
      timeoutMs: 85_000,
      geminiTotalBudgetMs: 125_000,
      maxOutputTokens: 2048,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: `KI-Dienst antwortete mit ${result.status}. ${result.hint}` },
        { status: 502 },
      )
    }
    return NextResponse.json({ reply: result.reply })
  } catch (e) {
    console.error('portfolio-berater', e)
    return NextResponse.json({ error: 'Verbindung zum KI-Dienst fehlgeschlagen.' }, { status: 502 })
  }
}
