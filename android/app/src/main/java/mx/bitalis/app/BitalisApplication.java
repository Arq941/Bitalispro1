package mx.bitalis.app;

import android.app.Activity;
import android.app.Application;
import android.content.Intent;
import android.os.Bundle;
import android.os.SystemClock;
import android.webkit.WebView;

/**
 * Mantiene cookies, localStorage, tokens y datos WebView, pero descarta en cada
 * arranque en frío los recursos HTTP que pueden pertenecer a un deploy anterior
 * de Next.js. Además coordina el bloqueo biométrico nativo cuando BITALIS vuelve
 * al primer plano después de permanecer fuera de la app.
 */
public class BitalisApplication extends Application implements Application.ActivityLifecycleCallbacks {
    private static final long LOCK_AFTER_BACKGROUND_MS = 30_000L;

    private int startedActivities = 0;
    private long lastBackgroundAt = 0L;
    private boolean biometricGateLaunching = false;

    @Override
    public void onCreate() {
        super.onCreate();
        registerActivityLifecycleCallbacks(this);
        refreshWebDeliveryCacheOnProcessStart();
    }

    public synchronized void markBiometricUnlocked() {
        lastBackgroundAt = 0L;
        biometricGateLaunching = false;
    }

    private void refreshWebDeliveryCacheOnProcessStart() {
        try {
            // clearCache(true) elimina únicamente recursos HTTP/WebView.
            // No borra cookies, localStorage, tokens, permisos ni datos de negocio.
            WebView deliveryCleaner = new WebView(this);
            deliveryCleaner.clearCache(true);
            deliveryCleaner.destroy();
        } catch (Throwable ignored) {
            // No bloquear el arranque si el proveedor WebView del dispositivo falla.
        }
    }

    @Override
    public synchronized void onActivityStarted(Activity activity) {
        boolean returningFromBackground = startedActivities == 0 && lastBackgroundAt > 0L;
        startedActivities++;

        if (!returningFromBackground || activity instanceof BiometricLockActivity) return;
        long backgroundDuration = SystemClock.elapsedRealtime() - lastBackgroundAt;
        if (backgroundDuration < LOCK_AFTER_BACKGROUND_MS || biometricGateLaunching) return;

        biometricGateLaunching = true;
        Intent lockIntent = new Intent(activity, BiometricLockActivity.class);
        lockIntent.putExtra(BiometricLockActivity.EXTRA_RETURN_TO_EXISTING, true);
        activity.startActivity(lockIntent);
    }

    @Override
    public synchronized void onActivityStopped(Activity activity) {
        startedActivities = Math.max(0, startedActivities - 1);
        if (startedActivities == 0 && !activity.isChangingConfigurations()) {
            lastBackgroundAt = SystemClock.elapsedRealtime();
        }
    }

    @Override public void onActivityCreated(Activity activity, Bundle savedInstanceState) {}
    @Override public void onActivityResumed(Activity activity) {}
    @Override public void onActivityPaused(Activity activity) {}
    @Override public void onActivitySaveInstanceState(Activity activity, Bundle outState) {}
    @Override public void onActivityDestroyed(Activity activity) {}
}
