package de.omnia.haushalt;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(OmniaBleKeepalivePlugin.class);
        super.onCreate(savedInstanceState);
        notifyKeepProcess(WhoopBleForegroundService.ACTION_APP_FOREGROUND);
    }

    @Override
    public void onResume() {
        super.onResume();
        // UI wieder da: nativen GATT freigeben, Capgo übernimmt
        notifyKeepProcess(WhoopBleForegroundService.ACTION_APP_FOREGROUND);
    }

    @Override
    public void onPause() {
        // Display aus / andere App: Prozess + Capgo-GATT halten (kein Disconnect!)
        if (WhoopBleForegroundService.isKeepaliveActive(this)) {
            notifyKeepProcess(WhoopBleForegroundService.ACTION_APP_BACKGROUND);
        }
        super.onPause();
    }

    @Override
    public void onStop() {
        if (!isChangingConfigurations() && WhoopBleForegroundService.isKeepaliveActive(this)) {
            notifyKeepProcess(WhoopBleForegroundService.ACTION_KEEP_PROCESS);
        }
        super.onStop();
    }

    private void notifyKeepProcess(String action) {
        if (!WhoopBleForegroundService.isKeepaliveActive(this)) {
            return;
        }
        Intent intent = new Intent(this, WhoopBleForegroundService.class);
        intent.putExtra("action", action);
        intent.putExtra("title", getString(R.string.whoop_fg_title));
        intent.putExtra("body", getString(R.string.whoop_fg_body));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent);
        } else {
            startService(intent);
        }
    }
}
