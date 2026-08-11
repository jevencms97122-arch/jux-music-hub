package fr.nexoramusic.jux

import android.content.Context
import android.content.Intent
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
}
