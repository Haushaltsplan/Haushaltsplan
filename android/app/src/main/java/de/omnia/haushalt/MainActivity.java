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
        notifyAppForeground();
    }

    @Override
    public void onResume() {
        super.onResume();
        notifyAppForeground();
    }

    @Override
    public void onStop() {
        if (!isChangingConfigurations() && WhoopBleForegroundService.isKeepaliveActive(this)) {
            notifyAppBackground();
        }
        super.onStop();
    }

    private void notifyAppForeground() {
        WhoopBleForegroundService.linkHolder().setAppForeground(true);
        if (!WhoopBleForegroundService.isKeepaliveActive(this)) {
            return;
        }
        Intent intent = new Intent(this, WhoopBleForegroundService.class);
        intent.putExtra("action", WhoopBleForegroundService.ACTION_APP_FOREGROUND);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent);
        } else {
            startService(intent);
        }
    }

    private void notifyAppBackground() {
        Intent intent = new Intent(this, WhoopBleForegroundService.class);
        intent.putExtra("action", WhoopBleForegroundService.ACTION_APP_BACKGROUND);
        intent.putExtra("title", getString(R.string.whoop_fg_title));
        intent.putExtra("body", getString(R.string.whoop_fg_body));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent);
        } else {
            startService(intent);
        }
    }
}
