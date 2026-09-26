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
        ensureBleArmed();
    }

    @Override
    public void onResume() {
        super.onResume();
        ensureBleArmed();
    }

    @Override
    public void onPause() {
        ensureBleArmed();
        super.onPause();
    }

    @Override
    public void onStop() {
        if (!isChangingConfigurations()) {
            ensureBleArmed();
        }
        super.onStop();
    }

    private void ensureBleArmed() {
        if (!WhoopBleForegroundService.isKeepaliveActive(this)) {
            return;
        }
        handler.postDelayed(
            () -> {
                Intent intent = new Intent(this, WhoopBleForegroundService.class);
                intent.putExtra("action", WhoopBleForegroundService.ACTION_ARM_NATIVE);
                String id = WhoopBleForegroundService.loadDeviceId(this);
                if (id != null) {
                    intent.putExtra("deviceId", id);
                }
                intent.putExtra("title", getString(R.string.whoop_fg_title));
                intent.putExtra("body", getString(R.string.whoop_fg_body));
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(intent);
                } else {
                    startService(intent);
                }
            },
            150
        );
    }
}
