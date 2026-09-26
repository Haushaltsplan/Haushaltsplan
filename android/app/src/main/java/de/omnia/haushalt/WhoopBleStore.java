package de.omnia.haushalt;

import android.content.Context;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;

/**
 * Zuverlässiger Speicher für Geräte-ID / Keepalive (Datei im App-Files-Dir).
 * SharedPreferences sind über Prozesse hinweg unzuverlässig.
 */
public final class WhoopBleStore {

    private static final String FILE = "omnia_whoop_ble_v1.txt";

    private WhoopBleStore() {}

    private static File file(Context ctx) {
        return new File(ctx.getApplicationContext().getFilesDir(), FILE);
    }

    public static synchronized void save(Context ctx, String deviceId, boolean keepalive) {
        try (FileWriter w = new FileWriter(file(ctx), false)) {
            w.write(keepalive ? "1" : "0");
            w.write('\n');
            w.write(deviceId != null ? deviceId.trim() : "");
            w.write('\n');
            w.flush();
        } catch (Exception ignored) {}
    }

    public static synchronized void setKeepalive(Context ctx, boolean keepalive) {
        save(ctx, loadDeviceId(ctx), keepalive);
    }

    public static synchronized void setDeviceId(Context ctx, String deviceId) {
        save(ctx, deviceId, isKeepaliveActive(ctx));
    }

    public static synchronized boolean isKeepaliveActive(Context ctx) {
        String[] lines = readLines(ctx);
        return lines.length > 0 && "1".equals(lines[0].trim());
    }

    public static synchronized String loadDeviceId(Context ctx) {
        String[] lines = readLines(ctx);
        if (lines.length < 2) {
            return null;
        }
        String id = lines[1].trim();
        return id.isEmpty() ? null : id;
    }

    private static String[] readLines(Context ctx) {
        File f = file(ctx);
        if (!f.exists()) {
            return new String[0];
        }
        try (BufferedReader r = new BufferedReader(new FileReader(f))) {
            String a = r.readLine();
            String b = r.readLine();
            if (a == null) {
                return new String[0];
            }
            return new String[] { a, b != null ? b : "" };
        } catch (Exception e) {
            return new String[0];
        }
    }
}
