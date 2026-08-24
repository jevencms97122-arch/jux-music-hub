package fr.nexoramusic.jux

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) {
      ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1001)
    }

    requestIgnoreBatteryOptimizations()
  }

  /**
   * Sans cette exemption, certains fabricants (Xiaomi/MIUI en tête) gèlent l'app dès
   * qu'elle passe en arrière-plan — même avec un service au premier plan et un wake lock
   * actifs — ce qui coupe la lecture en enchaînement automatique. Demande le dialogue
   * système une seule fois (no-op silencieux si déjà accordé).
   */
  private fun requestIgnoreBatteryOptimizations() {
    try {
      val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
      if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
          data = Uri.parse("package:$packageName")
        }
        startActivity(intent)
      }
    } catch (_: Exception) {
      // Certains OEM/ROM refusent cet intent (ex: sans Play Services) : on ignore.
    }
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    JuxWebViewHolder.set(webView)
    webView.addJavascriptInterface(JuxMediaBridge(this), "JuxAndroid")
  }

  // Le lecteur audio tourne côté JS (Web Audio API dans la WebView). Le code généré par
  // Tauri (WryActivity.onPause) appelle mWebView.onPause() quand l'app passe en
  // arrière-plan, ce qui suspend TOUT le JavaScript de la page — pas seulement les
  // timers. L'audio en cours continue nativement (pipeline média séparé), mais la
  // logique JS qui enchaîne sur le morceau suivant ne s'exécute plus, et même les
  // appels natifs evaluateJavascript restent en file sans être exécutés. On ne peut
  // pas modifier WryActivity (fichier régénéré par Tauri à chaque build), donc on
  // annule sa suspension immédiatement après coup : webView.onResume() défait
  // webView.onPause(), et resumeTimers() couvre la pause globale des timers.
  override fun onPause() {
    super.onPause()
    JuxWebViewHolder.get()?.let { webView ->
      webView.onResume()
      webView.resumeTimers()
    }
  }

  // Même contre-mesure au passage en "non visible" complet (onStop arrive après
  // onPause quand l'utilisateur retourne au launcher) : si quoi que ce soit a
  // re-suspendu la WebView entre-temps, on la réveille à nouveau.
  override fun onStop() {
    super.onStop()
    JuxWebViewHolder.get()?.let { webView ->
      webView.onResume()
      webView.resumeTimers()
    }
  }
}
