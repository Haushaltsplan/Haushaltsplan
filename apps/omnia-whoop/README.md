# Omnia Whoop — native Android-App (BLE-first)

Separate Capacitor-App mit `appId: de.omnia.whoop`. Lädt `/fitnessdaten` und hält das WHOOP-Band per Foreground Service.

## Voraussetzung

- Omnia-Web deployed oder lokal (`npm run dev`)
- In `.env.local`:

```env
OMNIA_WHOOP_CAPACITOR_SERVER_URL=https://deine-domain.de
# oder lokal:
# OMNIA_WHOOP_CAPACITOR_SERVER_URL=http://192.168.x.x:3000
```

## Einmalig bootstrap + Studio

```bash
npm run whoop:bootstrap
npm run whoop:android
```

Das kopiert/adaptierte Android-Projekt nach `apps/omnia-whoop/android` (`de.omnia.whoop`) und öffnet Android Studio.

## APK bauen (ohne Android Studio UI)

Wie bei Omnia — fertige Datei zum Sideloaden:

```bash
npm run whoop:apk
```

Erzeugt im Projektroot: **`Omnia-Whoop-debug.apk`**

Aufs Handy kopieren (USB / Drive / Telegram an dich selbst) und installieren.  
„Unbekannte Apps / Quellen“ einmal erlauben.

Optional per USB + adb (wenn `adb` im PATH):

```bash
npm run whoop:install
```

## Server-URL

In `.env.local`:

```env
OMNIA_WHOOP_CAPACITOR_SERVER_URL=https://haushaltsplan-blue.vercel.app
```

Ohne eigenen Eintrag wird `OMNIA_CAPACITOR_SERVER_URL` genutzt. Die App öffnet automatisch `/fitnessdaten`.

## Abgrenzung zu Omnia

| | Omnia (`de.omnia.haushalt`) | Omnia Whoop (`de.omnia.whoop`) |
|--|--|--|
| Zweck | Haushalt + Rennrad | Band + Scores |
| Start | `/` | `/fitnessdaten` |
| Whoop-Cloud | nein | nein (BLE only) |

Config: [`capacitor.whoop.config.ts`](../../capacitor.whoop.config.ts)
