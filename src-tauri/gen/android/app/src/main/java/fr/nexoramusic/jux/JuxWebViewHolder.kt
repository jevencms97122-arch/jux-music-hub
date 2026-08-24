package fr.nexoramusic.jux

import android.webkit.WebView
import java.lang.ref.WeakReference

/** Garde une référence faible vers la WebView pour renvoyer les commandes natives (notification -> JS). */
object JuxWebViewHolder {
    private var ref: WeakReference<WebView>? = null

    fun set(webView: WebView) {
        ref = WeakReference(webView)
    }

    fun get(): WebView? = ref?.get()

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

    /** Exécute du JS arbitraire dans la WebView. Utilisé pour réveiller la logique de
     * lecture (voir MediaPlaybackService) même quand la page est gelée en arrière-plan :
     * un appel natif evaluateJavascript passe généralement là où un timer JS interne
     * (setTimeout/setInterval) resterait bloqué. */
    fun evaluate(js: String) {
        val webView = ref?.get() ?: return
        webView.post { webView.evaluateJavascript(js, null) }
    }
}
