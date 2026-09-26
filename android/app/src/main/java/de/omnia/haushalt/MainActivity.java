package de.omnia.haushalt;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(OmniaBleKeepalivePlugin.class);
        super.onCreate(savedInstanceState);
        // Nur Prozess halten — GATT-Arm läuft über JS-Handoff / Service.onTaskRemoved
        ensureFgAlive(false);
    }

    @Override
    public void onResume() {
        super.onResume();
        // Nach Rückkehr: falls Keepalive, native Link erneut anstupsen
        ensureFgAlive(true);
    }

    @Override
    public void onPause() {
        // Wichtig: NICHT armen — Capgo könnte noch halten / Handoff läuft
        ensureFgAlive(false);
        super.onPause();
    }

    @Override
    public void onStop() {
        if (!isChangingConfigurations()) {
            ensureFgAlive(false);
        }
        super.onStop();
    }

    /**
     * @param armNative true = GATT verbinden (nur wenn Activity wieder sichtbar)
     */
    private void ensureFgAlive(boolean armNative) {
        if (!WhoopBleForegroundService.isKeepaliveActive(this)) {
            return;
        }
        handler.postDelayed(
            () -> {
                Intent intent = new Intent(this, WhoopBleForegroundService.class);
                intent.putExtra(
                    "action",
                    armNative
                        ? WhoopBleForegroundService.ACTION_ARM_NATIVE
                        : WhoopBleForegroundService.ACTION_KEEP_PROCESS
                );
                String id = WhoopBleForegroundService.loadDeviceId(this);
                if (id != null) {
                    intent.putExtra("deviceId", id);
                }
                intent.putExtra("title", getString(R.string.whoop_fg_title));
                intent.putExtra("body", getString(R.string.whoop_fg_body));
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        startForegroundService(intent);
                    } else {
                        startService(intent);
                    }
                } catch (Exception ignored) {}
            },
            armNative ? 400 : 80
        );
    }
}
