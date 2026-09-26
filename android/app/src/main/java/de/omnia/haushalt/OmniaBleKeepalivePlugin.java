package de.omnia.haushalt;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "OmniaBleKeepalive",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class OmniaBleKeepalivePlugin extends Plugin {

    private PluginCall pendingStartCall;
    private BroadcastReceiver hrReceiver;

    @Override
    public void load() {
        super.load();
        hrReceiver =
            new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    if (intent == null) {
                        return;
                    }
                    String action = intent.getAction();
                    JSObject data = new JSObject();
                    if (WhoopBleLinkHolder.ACTION_HR.equals(action)) {
                        data.put("bpm", intent.getIntExtra("bpm", 0));
                        data.put("connected", true);
                        notifyListeners("hrUpdate", data);
                    } else if (WhoopBleLinkHolder.ACTION_STATE.equals(action)) {
                        data.put("connected", intent.getBooleanExtra("connected", false));
                        data.put("label", intent.getStringExtra("label"));
                        notifyListeners("connectionState", data);
                    }
                }
            };
        IntentFilter filter = new IntentFilter();
        filter.addAction(WhoopBleLinkHolder.ACTION_HR);
        filter.addAction(WhoopBleLinkHolder.ACTION_STATE);
        ContextCompat.registerReceiver(
            getContext(),
            hrReceiver,
            filter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        );
    }

    @Override
    protected void handleOnDestroy() {
        if (hrReceiver != null) {
            try {
                getContext().unregisterReceiver(hrReceiver);
            } catch (Exception ignored) {}
            hrReceiver = null;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (
                ActivityCompat.checkSelfPermission(
                    getContext(),
                    Manifest.permission.POST_NOTIFICATIONS
                ) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                pendingStartCall = call;
                requestPermissionForAlias("notifications", call, "notificationStartCallback");
                return;
            }
        }
        launchService(call);
    }

    @PermissionCallback
    private void notificationStartCallback(PluginCall call) {
        PluginCall next = pendingStartCall != null ? pendingStartCall : call;
        pendingStartCall = null;
        if (next == null) {
            return;
        }
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ActivityCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.POST_NOTIFICATIONS
            ) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            next.reject("Benachrichtigungs-Berechtigung nötig für Hintergrund-BLE.");
            return;
        }
        launchService(next);
    }

    private void launchService(PluginCall call) {
        String title = call.getString("title", "Omnia");
        String body = call.getString("body", "WHOOP bleibt verbunden");
        String deviceId = call.getString("deviceId");
        if (deviceId != null && !deviceId.isEmpty()) {
            WhoopBleForegroundService.saveDeviceId(getContext(), deviceId);
        }
        WhoopBleForegroundService.setKeepaliveActive(getContext(), true);

        Intent intent = new Intent(getContext(), WhoopBleForegroundService.class);
        intent.putExtra("action", WhoopBleForegroundService.ACTION_ARM_NATIVE);
        intent.putExtra("title", title);
        intent.putExtra("body", body);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }

        tryPromptIgnoreBatteryOptimizations();
        call.resolve();
    }

    private void tryPromptIgnoreBatteryOptimizations() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return;
        }
        try {
            PowerManager pm =
                (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            if (pm == null || pm.isIgnoringBatteryOptimizations(getContext().getPackageName())) {
                return;
            }
            Intent request = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            request.setData(Uri.parse("package:" + getContext().getPackageName()));
            request.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(request);
        } catch (Exception ignored) {}
    }

    @PluginMethod
    public void stop(PluginCall call) {
        WhoopBleForegroundService.setKeepaliveActive(getContext(), false);
        sendServiceAction(WhoopBleForegroundService.ACTION_RELEASE_NATIVE);
        Intent intent = new Intent(getContext(), WhoopBleForegroundService.class);
        getContext().stopService(intent);
        call.resolve();
    }

    @PluginMethod
    public void armNativeLink(PluginCall call) {
        String deviceId = call.getString("deviceId");
        if (deviceId != null && !deviceId.isEmpty()) {
            WhoopBleForegroundService.saveDeviceId(getContext(), deviceId);
        }
        WhoopBleForegroundService.setKeepaliveActive(getContext(), true);
        sendServiceAction(WhoopBleForegroundService.ACTION_ARM_NATIVE);
        call.resolve();
    }

    /** No-op: natives GATT bleibt bewusst auch bei UI-Resume. */
    @PluginMethod
    public void releaseNativeLink(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm =
                    (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(getContext().getPackageName())) {
                    Intent request = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    request.setData(Uri.parse("package:" + getContext().getPackageName()));
                    request.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(request);
                    call.resolve();
                    return;
                }
            }
            Intent fallback = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(fallback);
            call.resolve();
        } catch (Exception e) {
            call.reject("Akku-Einstellungen konnten nicht geöffnet werden.");
        }
    }

    @PluginMethod
    public void isBatteryOptimized(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm =
                (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            boolean ignored =
                pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
            ret.put("ignored", ignored);
        } else {
            ret.put("ignored", true);
        }
        call.resolve(ret);
    }

    private void sendServiceAction(String action) {
        Intent intent = new Intent(getContext(), WhoopBleForegroundService.class);
        intent.putExtra("action", action);
        intent.putExtra("title", "Omnia");
        intent.putExtra("body", "WHOOP bleibt verbunden");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
    }
}
