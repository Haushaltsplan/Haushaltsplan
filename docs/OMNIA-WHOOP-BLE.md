# Omnia Whoop — BLE Capture Checkliste

Ziel: maximal vom Armband abfangen, alles lokal auswerten (kein Whoop-Abo).

## Bereits aktiv

| Signal | Quelle | Status |
|--------|--------|--------|
| Live-HF | Standard HR + Gen5 r22 | OK |
| RR → HRV (RMSSD) | aus HR-Notify | OK |
| Accel / IMU | r22 Floats | OK |
| Akku | Battery Service + Event 3 | OK |
| Hauttemperatur | Gen5 Event 17 | OK |
| History-Offload | CMD 0x16 + Cursor-ACK 0x17 | OK + Refresh nach Connect / 30s / 10min |
| Device-Info | GATT Device Info | OK |

## Als Nächstes vertiefen

1. Weitere r22-/Metadata-Felder (SpO₂-Roh, Schlaf-Marker) — Captures vergleichen mit Whoopsie/Protocol-Docs
2. Sleep-Fenster aus Nacht-HF/HRV/Bewegung härten (`sleep-estimate.ts`)
3. Schritte robuster aus Accel (`steps-tracker.ts`)
4. Recovery/Strain-Baselines über mehr Nächte kalibrieren (ohne Cloud)

## App bauen

```bash
npm run whoop:bootstrap
npm run whoop:android
```

Siehe [apps/omnia-whoop/README.md](../apps/omnia-whoop/README.md).
