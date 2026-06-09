# Omnia Native — Android-App mit Hintergrund-BLE

Die native Omnia-App ersetzt die Chrome-PWA für WHOOP: **Foreground Service** hält die Bluetooth-Verbindung auch bei gesperrtem Display — wie in der WHOOP-App.

## Architektur

```
┌─────────────────────────────────────┐
│  Omnia Android App (Capacitor)      │
│  ┌───────────────────────────────┐  │
│  │ WebView → deine Next.js-URL   │  │
│  │ (alle API-Routes, WHOOP Cloud)│  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ Capgo BLE + Foreground Service│  │
│  │ Web-Bluetooth-Shim → gleicher   │  │
│  │ WHOOP-Code wie in der PWA       │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

- **UI & Cloud:** weiterhin dein gehostetes Next.js (kein Static Export nötig).
- **BLE:** `@capgo/capacitor-bluetooth-low-energy` mit **Foreground Service** (Standby wie WHOOP-App). Der Shim macht `navigator.bluetooth` nativ — derselbe WHOOP-Code wie in der PWA.
- **Nur Omnia:** WHOOP-App kann deinstalliert/bleiben aus — Strap verbindet sich direkt mit Omnia.

## Voraussetzungen

1. **Node.js** (wie fürs Web-Projekt)
2. **Android Studio** (SDK 34+, Build-Tools)
3. **JDK 17**
4. Öffentliche **HTTPS-URL** deiner Omnia-Instanz (z. B. Vercel) **oder** lokale IP für Dev

## Einmalige Einrichtung

```bash
# Im Projektroot
npm install

# Capacitor Android-Projekt erzeugen (einmalig)
npx cap add android
```

## Server-URL setzen

Die App lädt Omnia aus dem Netz (API-Routes, WHOOP OAuth, Supabase).

**Produktion** — in `.env.local` oder CI:

```env
OMNIA_CAPACITOR_SERVER_URL=https://deine-domain.de
```

**Lokal am Handy testen** (PC und Handy im gleichen WLAN):

```env
OMNIA_CAPACITOR_SERVER_URL=http://192.168.1.42:3000
```

Dann auf dem PC: `npm run dev` (Firewall Port 3000 erlauben).

## Build & Installieren

```bash
# Native Projekt synchronisieren
npm run cap:sync

# Android Studio öffnen
npm run cap:open
```

In Android Studio: **Run** auf dein Handy (USB-Debugging an).

Oder APK bauen: **Build → Build Bundle(s) / APK(s) → APK**.

## Erste Nutzung auf dem Handy

1. Omnia-App öffnen (nicht Chrome-PWA)
2. **Whoop → WHOOP Cloud verbinden** (einmalig, für Schritte/Kalorien/Recovery)
3. **Whoop → Verbinden** — native BLE scannt WHOOP, startet Foreground-Benachrichtigung
4. Android: **Akku → Uneingeschränkt** für Omnia empfohlen
5. Bluetooth-Berechtigungen bei Aufforderung erlauben (Android 12+)

Dauer-Benachrichtigung „Omnia · WHOOP verbunden“ ist **gewollt** — der native Foreground Service (`WhoopBleForegroundService`) hält BLE aktiv. Das Capgo-Plugin liefert hierfür nur einen leeren Stub; Omnia nutzt ein eigenes Android-Plugin (`OmniaBleKeepalive`).

## WHOOP-App

Für **nur Omnia**:

- WHOOP-App muss **nicht** parallel laufen
- HR Broadcast in der WHOOP-App ist **nicht** nötig (Omnia schaltet Broadcast per BLE-Kommando)
- Alte OS-Kopplung „WHOOP“ unter Android-Bluetooth ggf. entfernen, wenn Verbindungskonflikte auftreten

## Skripte

| Befehl | Zweck |
|--------|--------|
| `npm run cap:sync` | Web + Plugins → `android/` kopieren |
| `npm run cap:open` | Android Studio öffnen |
| `npm run omnia:android` | Sync + Studio |

## Troubleshooting

| Problem | Lösung |
|---------|--------|
| Weißer Bildschirm | `OMNIA_CAPACITOR_SERVER_URL` prüfen, HTTPS-Zertifikat gültig |
| WHOOP nicht gefunden | Band am Handgelenk, Bluetooth an, 10 s warten, erneut „Verbinden“ |
| BLE bricht ab | Akku uneingeschränkt, Foreground-Notification nicht wegwischen |
| Cloud-Sync 401 | In der **App** (nicht Browser) WHOOP Cloud neu verbinden |

## Nächste Schritte (optional)

- [ ] Play Store Release (signiertes AAB)
- [ ] Gen5-Volldaten (Accel, Skin-Temp) im Native-Pfad
- [ ] iOS-Build (gleiches Capacitor-Projekt, `npx cap add ios`)
