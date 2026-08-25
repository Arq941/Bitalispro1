package mx.bitalis.app;

import android.app.Activity;
import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.os.Build;
import android.content.Intent;
import android.content.SharedPreferences;
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
    private static final long LOCK_AFTER_BACKGROUND_MS = 2L * 60L * 1000L;
    private static final long CREDENTIAL_SESSION_MS = 8L * 60L * 60L * 1000L;
    private static final String SECURITY_PREFS = "bitalis_security";
    private static final String LAST_TRUSTED_UNLOCK_AT = "last_trusted_unlock_at";

    private int startedActivities = 0;
    private long lastBackgroundAt = 0L;
    private boolean biometricGateLaunching = false;
    private boolean sessionResetRequired = false;

    @Override
    public void onCreate() {
        super.onCreate();
        registerActivityLifecycleCallbacks(this);
        refreshWebDeliveryCacheOnProcessStart();
        createNotificationChannels();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        NotificationChannel operational = new NotificationChannel(
                "bitalis_operational", "BITALIS · Operación",
                NotificationManager.IMPORTANCE_DEFAULT);
        operational.setDescription("Avisos de clientes, ventas, cobranza y sincronización.");
        operational.enableVibration(true);
        operational.setVibrationPattern(new long[]{0, 180, 120, 180});

        NotificationChannel urgent = new NotificationChannel(
                "bitalis_urgent", "BITALIS · Alta prioridad",
                NotificationManager.IMPORTANCE_HIGH);
        urgent.setDescription("Alertas urgentes enviadas por administración.");
        urgent.enableVibration(true);
        urgent.setVibrationPattern(new long[]{0, 350, 160, 350, 160, 600});
        urgent.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
        urgent.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());

        manager.createNotificationChannel(operational);
        manager.createNotificationChannel(urgent);
    }

    public synchronized void markBiometricUnlocked() {
        getSharedPreferences(SECURITY_PREFS, MODE_PRIVATE).edit()
                .putLong(LAST_TRUSTED_UNLOCK_AT, System.currentTimeMillis())
                .apply();
        lastBackgroundAt = 0L;
        biometricGateLaunching = false;
    }

    public synchronized boolean isCredentialSessionExpired() {
        SharedPreferences preferences = getSharedPreferences(SECURITY_PREFS, MODE_PRIVATE);
        long lastUnlockAt = preferences.getLong(LAST_TRUSTED_UNLOCK_AT, 0L);
        return lastUnlockAt <= 0L || System.currentTimeMillis() - lastUnlockAt >= CREDENTIAL_SESSION_MS;
    }

    public synchronized void requireSessionReset() {
        sessionResetRequired = true;
    }

    public synchronized boolean consumeSessionResetRequired() {
        boolean required = sessionResetRequired;
        sessionResetRequired = false;
        return required;
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
