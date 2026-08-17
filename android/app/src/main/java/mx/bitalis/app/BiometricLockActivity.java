package mx.bitalis.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.provider.Settings;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.concurrent.Executor;

/**
 * Puerta de seguridad nativa de BITALIS. Usa BiometricPrompt del sistema Android,
 * por lo que la huella nunca es leída ni almacenada por BITALIS. Android valida
 * la identidad y permite credencial segura del dispositivo como respaldo.
 */
public class BiometricLockActivity extends Activity {
    public static final String EXTRA_RETURN_TO_EXISTING = "mx.bitalis.app.RETURN_TO_EXISTING";

    private TextView statusView;
    private Button unlockButton;
    private CancellationSignal cancellationSignal;
    private boolean promptActive = false;
    private boolean authenticated = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(6, 43, 36));
        window.setNavigationBarColor(Color.WHITE);

        setContentView(buildLockView());
        unlockButton.post(this::showBiometricPrompt);
    }

    private View buildLockView() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(dp(28), dp(36), dp(28), dp(36));
        root.setBackgroundColor(Color.rgb(245, 248, 247));

        TextView mark = new TextView(this);
        mark.setText("B");
        mark.setTextColor(Color.WHITE);
        mark.setTextSize(28);
        mark.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        mark.setGravity(Gravity.CENTER);
        mark.setBackgroundColor(Color.rgb(6, 43, 36));
        LinearLayout.LayoutParams markParams = new LinearLayout.LayoutParams(dp(72), dp(72));
        markParams.bottomMargin = dp(20);
        root.addView(mark, markParams);

        TextView title = new TextView(this);
        title.setText("BITALIS");
        title.setTextColor(Color.rgb(6, 43, 36));
        title.setTextSize(26);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        root.addView(title, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        TextView subtitle = new TextView(this);
        subtitle.setText("Desbloqueo seguro");
        subtitle.setTextColor(Color.rgb(71, 85, 105));
        subtitle.setTextSize(15);
        subtitle.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subtitleParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        subtitleParams.topMargin = dp(8);
        root.addView(subtitle, subtitleParams);

        statusView = new TextView(this);
        statusView.setText("Confirma tu identidad con la huella registrada en este dispositivo.");
        statusView.setTextColor(Color.rgb(100, 116, 139));
        statusView.setTextSize(13);
        statusView.setGravity(Gravity.CENTER);
        statusView.setLineSpacing(0f, 1.15f);
        LinearLayout.LayoutParams statusParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        statusParams.topMargin = dp(18);
        root.addView(statusView, statusParams);

        unlockButton = new Button(this);
        unlockButton.setText("DESBLOQUEAR CON HUELLA");
        unlockButton.setTextColor(Color.WHITE);
        unlockButton.setTextSize(14);
        unlockButton.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        unlockButton.setAllCaps(false);
        unlockButton.setBackgroundColor(Color.rgb(17, 166, 90));
        unlockButton.setOnClickListener(v -> showBiometricPrompt());
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(56));
        buttonParams.topMargin = dp(26);
        root.addView(unlockButton, buttonParams);

        TextView privacy = new TextView(this);
        privacy.setText("La huella es validada por Android. BITALIS nunca recibe ni almacena tus datos biométricos.");
        privacy.setTextColor(Color.rgb(148, 163, 184));
        privacy.setTextSize(11);
        privacy.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams privacyParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        privacyParams.topMargin = dp(18);
        root.addView(privacy, privacyParams);

        return root;
    }

    private void showBiometricPrompt() {
        if (authenticated || promptActive || isFinishing()) return;

        promptActive = true;
        statusView.setText("Esperando autenticación segura de Android…");
        unlockButton.setEnabled(false);

        cancellationSignal = new CancellationSignal();
        Executor executor = getMainExecutor();

        BiometricPrompt prompt = new BiometricPrompt.Builder(this)
                .setTitle("Desbloquear BITALIS")
                .setSubtitle("Usa tu huella o el bloqueo seguro del dispositivo")
                .setDescription("Protege clientes, cobranza, caja y datos de operación.")
                .setDeviceCredentialAllowed(true)
                .build();

        prompt.authenticate(cancellationSignal, executor, new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                super.onAuthenticationSucceeded(result);
                authenticated = true;
                promptActive = false;
                statusView.setText("Identidad confirmada.");
                ((BitalisApplication) getApplication()).markBiometricUnlocked();
                continueToBitalis();
            }

            @Override
            public void onAuthenticationFailed() {
                super.onAuthenticationFailed();
                statusView.setText("Huella no reconocida. Intenta nuevamente.");
            }

            @Override
            public void onAuthenticationError(int errorCode, CharSequence errString) {
                super.onAuthenticationError(errorCode, errString);
                promptActive = false;
                unlockButton.setEnabled(true);
                statusView.setText(errString == null || errString.length() == 0
                        ? "No fue posible validar tu identidad."
                        : errString.toString());

                if (!hasSecureDeviceLock()) {
                    showSecuritySetupDialog();
                }
            }
        });
    }

    private boolean hasSecureDeviceLock() {
        android.app.KeyguardManager manager = (android.app.KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        return manager != null && manager.isDeviceSecure();
    }

    private void showSecuritySetupDialog() {
        if (isFinishing()) return;
        new AlertDialog.Builder(this)
                .setTitle("Configura seguridad en Android")
                .setMessage("Para proteger BITALIS configura una huella y un PIN, patrón o contraseña en este dispositivo.")
                .setPositiveButton("ABRIR SEGURIDAD", (dialog, which) -> {
                    try {
                        startActivity(new Intent(Settings.ACTION_SECURITY_SETTINGS));
                    } catch (Exception ignored) {
                    }
                })
                .setNegativeButton("CERRAR", (dialog, which) -> moveTaskToBack(true))
                .show();
    }

    private void continueToBitalis() {
        boolean returnToExisting = getIntent().getBooleanExtra(EXTRA_RETURN_TO_EXISTING, false);
        if (!returnToExisting) {
            Intent appIntent = new Intent(this, MainActivity.class);
            appIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(appIntent);
        }
        finish();
    }

    @Override
    protected void onDestroy() {
        if (cancellationSignal != null && !cancellationSignal.isCanceled() && !authenticated) {
            cancellationSignal.cancel();
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (cancellationSignal != null && !cancellationSignal.isCanceled()) cancellationSignal.cancel();
        moveTaskToBack(true);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
