package fr.nexoramusic.jux

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.webkit.JavascriptInterface
import org.json.JSONObject

/**
 * Exposé à la WebView sous window.JuxAndroid (voir src/lib/androidMediaBridge.ts).
 * Relaie les infos "now playing" au MediaPlaybackService qui gère la notification système.
 */
class JuxMediaBridge(private val context: Context) {

    @JavascriptInterface
    fun updateNowPlaying(json: String) {
        try {
            val obj = JSONObject(json)
            val intent = Intent(context, MediaPlaybackService::class.java).apply {
                action = MediaPlaybackService.ACTION_UPDATE
                putExtra("title", obj.optString("title", "Sans titre"))
                putExtra("author", obj.optString("author", ""))
                putExtra("coverUrl", obj.optString("coverUrl", ""))
                putExtra("duration", obj.optDouble("duration", 0.0))
                putExtra("currentTime", obj.optDouble("currentTime", 0.0))
                putExtra("isPlaying", obj.optBoolean("isPlaying", false))
            }
            context.startForegroundService(intent)
        } catch (_: Exception) {
            // Payload malformé : on ignore silencieusement
        }
    }

    @JavascriptInterface
    fun clearNowPlaying() {
        val intent = Intent(context, MediaPlaybackService::class.java).apply {
            action = MediaPlaybackService.ACTION_CLEAR
        }
        context.startService(intent)
    }

    /**
     * Télécharge l'APK de mise à jour via DownloadManager (notification système native,
     * pas besoin de gérer nous-mêmes la progression) puis ouvre automatiquement l'écran
     * d'installation dès que le téléchargement est terminé.
     * DownloadManager fournit sa propre URI content:// (getUriForDownloadedFile) — pas
     * besoin de FileProvider maison ni de permission de stockage supplémentaire.
     */
    @JavascriptInterface
    fun downloadAndInstallApk(url: String) {
        try {
            val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val request = DownloadManager.Request(Uri.parse(url))
                .setTitle("Nexora Music — mise à jour")
                .setDescription("Téléchargement de la mise à jour...")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, "nexora-update.apk")
                .setMimeType("application/vnd.android.package-archive")

            val downloadId = downloadManager.enqueue(request)

            val receiver = object : BroadcastReceiver() {
                override fun onReceive(ctx: Context, intent: Intent) {
                    val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
                    if (id != downloadId) return
                    try {
                        val fileUri = downloadManager.getUriForDownloadedFile(downloadId)
                        if (fileUri != null) {
                            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                                setDataAndType(fileUri, "application/vnd.android.package-archive")
                                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            context.startActivity(installIntent)
                        }
                    } catch (_: Exception) {
                        // Échec silencieux : la notification système de téléchargement reste
                        // disponible, l'utilisateur peut relancer l'installation depuis là.
                    } finally {
                        try { context.unregisterReceiver(this) } catch (_: Exception) {}
                    }
                }
            }
            val filter = IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
            } else {
                @Suppress("UnspecifiedRegisterReceiverFlag")
                context.registerReceiver(receiver, filter)
            }
        } catch (_: Exception) {
            // Payload malformé ou DownloadManager indisponible : on ignore silencieusement
        }
    }
}
