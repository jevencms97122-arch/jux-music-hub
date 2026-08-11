package fr.nexoramusic.jux

import android.webkit.WebView
import java.lang.ref.WeakReference

/** Garde une référence faible vers la WebView pour renvoyer les commandes natives (notification -> JS). */
object JuxWebViewHolder {
    private var ref: WeakReference<WebView>? = null

    fun set(webView: WebView) {
        ref = WeakReference(webView)
    }

    fun sendCommand(commandJson: String) {
        val webView = ref?.get() ?: return
        val escaped = commandJson.replace("\\", "\\\\").replace("'", "\\'")
        webView.post {
            webView.evaluateJavascript(
                "window.onJuxNativeCommand && window.onJuxNativeCommand('$escaped')",
                null
            )
        }
    }
}
