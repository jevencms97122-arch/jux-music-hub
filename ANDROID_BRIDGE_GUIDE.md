# Guide pont Android — Lecture musicale (Now Playing + Notifications)

Ce guide explique comment faire communiquer l'app Android native avec la WebView Jux pour :
- **Récupérer la musique en cours** (titre, auteur, cover URL, durée, état play/pause)
- **Afficher une notification système** avec la cover et les boutons de contrôle
- **Envoyer les commandes** (play, pause, next, previous, seek, stop) de la notification → WebView

---

## Architecture

```
┌─────────────────────────────────────────┐
│         Notification Android            │
│  ┌──────┐  Titre - Artiste             │
│  │ Cover│  ▷  ⏸  ⏭  ⏮                 │
│  └──────┘                              │
└────────────────┬────────────────────────┘
                 │ actions (PendingIntent)
                 ▼
┌─────────────────────────────────────────┐
│      MediaSession / Service Kotlin      │
│  updateNowPlaying(json) ← WebView       │
│  window.onJuxNativeCommand(json) → WebView
└────────────────┬────────────────────────┘
                 │ evaluateJavascript()
                 ▼
┌─────────────────────────────────────────┐
│           WebView (Jux app)             │
│  sendNowPlayingToNative()               │
│  onNativeCommand() listener             │
└─────────────────────────────────────────┘
```

---

## 1. Côté Web (Déjà implémenté)

Les fichiers suivants sont déjà en place :

### `src/lib/androidMediaBridge.ts`
- **`sendNowPlayingToNative(info)`** : envoie la musique en cours vers `JuxAndroid.updateNowPlaying(json)`
- **`clearNowPlayingOnNative()`** : efface la notification quand plus de musique
- **`onNativeCommand(callback)`** : écoute les commandes venant du natif via `window.onJuxNativeCommand(json)`
- **`resolveCoverUrl(url)`** : convertit les URLs relatives en absolues

### `src/contexts/PlayerContext.tsx`
- Un `useEffect` surveille `currentSong, isPlaying, currentTime, duration` et appelle `sendNowPlayingToNative()`
- Un `useEffect` écoute les commandes natives et déclenche `togglePlay()`, `next()`, `previous()`, `seek()`, etc.

### `src/lib/platform.ts`
- Le type `JuxAndroid` contient les nouvelles méthodes `updateNowPlaying` et `clearNowPlaying`

---

## 2. Côté Android — Code Kotlin

Ajoute ce code dans ton projet Android (dans l'Activity ou Fragment qui contient la WebView).

### 2.1. Dépendances (build.gradle)

```gradle
// app/build.gradle
dependencies {
    implementation 'androidx.media:media:1.7.0'
    implementation 'androidx.media3:media3-session:1.3.0'
    implementation 'androidx.media3:media3-exoplayer:1.3.0'
    implementation 'androidx.media3:media3-ui:1.3.0'
}
```

### 2.2. Pont JavaScript (ajouter aux méthodes existantes)

Ajoute ces deux méthodes à ta classe `JuxAndroidBridge` existante :

```kotlin
class JuxAndroidBridge(private val context: Context, private val webView: WebView) {
    
    // ... tes méthodes existantes (getAppVersion, downloadSong, etc.)
    
    /**
     * Appelé par la WebView quand la musique en cours change.
     * Reçoit un JSON avec les infos : songId, title, author, coverUrl, duration, etc.
     */
    @JavascriptInterface
    fun updateNowPlaying(json: String) {
        try {
            val song = JSONObject(json)
            val title = song.optString("title", "Sans titre")
            val author = song.optString("author", "Inconnu")
            val coverUrl = song.optString("coverUrl", "")
            val isPlaying = song.optBoolean("isPlaying", false)
            val duration = song.optLong("duration", 0L)
            val currentTime = song.optLong("currentTime", 0L)
            val songId = song.optString("songId", "")
            
            // Met à jour le service de notification
            MediaNotificationService.updateNowPlaying(
                context,
                title,
                author,
                coverUrl,
                songId,
                isPlaying,
                duration,
                currentTime
            )
        } catch (e: Exception) {
            Log.e("JuxBridge", "updateNowPlaying error", e)
        }
    }
    
    /**
     * Appelé par la WebView quand la lecture s'arrête (plus de musique).
     */
    @JavascriptInterface
    fun clearNowPlaying() {
        MediaNotificationService.stopNotification(context)
    }
}
```

**Important :** N'oublie pas de passer la WebView en paramètre dans le constructeur :

```kotlin
// Dans ton Activity/Fragment :
webView.addJavascriptInterface(
    JuxAndroidBridge(this, webView), 
    "JuxAndroid"
)
```

### 2.3. Service de notification (MediaNotificationService.kt)

Crée ce fichier dans ton projet Android :

```kotlin
package com.jux.music

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.media3.common.util.Log
import java.net.URL
import java.util.concurrent.Executors

object MediaNotificationService {
    private const val CHANNEL_ID = "jux_music_playback"
    private const val NOTIFICATION_ID = 1001
    private var currentSongId: String? = null
    
    /**
     * Crée le canal de notification (nécessaire pour Android 8+).
     * À appeler une fois dans le Application.onCreate() ou dans la première Activity.
     */
    fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Lecture musicale",
                NotificationManager.IMPORTANCE_LOW  // LOW = pas de son système
            ).apply {
                description = "Contrôle de la musique en cours"
                setShowBadge(false)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            }
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }
    
    /**
     * Met à jour la notification avec les infos de la musique en cours.
     */
    fun updateNowPlaying(
        context: Context,
        title: String,
        author: String,
        coverUrl: String,
        songId: String,
        isPlaying: Boolean,
        duration: Long,
        currentTime: Long
    ) {
        currentSongId = songId
        
        // Intent pour ouvrir l'app quand on clique sur la notification
        val openIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("open_player", true)
        }
        val openPendingIntent = PendingIntent.getActivity(
            context, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        // Construire les actions de la notification
        val playPauseAction = if (isPlaying) {
            buildAction(context, "⏸", "pause", "Pause")
        } else {
            buildAction(context, "▶", "play", "Play")
        }
        
        val prevAction = buildAction(context, "⏮", "previous", "Précédent")
        val nextAction = buildAction(context, "⏭", "next", "Suivant")
        
        // Construire la notification (sans cover d'abord, on mettra à jour après chargement)
        val notificationBuilder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)  // Remplace par ton propre icône
            .setContentTitle(title)
            .setContentText(author)
            .setSubText("Jux")
            .setContentIntent(openPendingIntent)
            .setOngoing(isPlaying)  // Pas swipeable quand en lecture
            .setShowWhen(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setStyle(
                NotificationCompat.MediaStyle()
                    .setShowActionsInCompactView(0, 1, 2)  // prev, play/pause, next
                    .setShowCancelButton(!isPlaying)
            )
            .addAction(prevAction)
            .addAction(playPauseAction)
            .addAction(nextAction)
        
        // Afficher immédiatement (sans cover)
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, notificationBuilder.build())
        
        // Charger la cover en arrière-plan et mettre à jour
        if (coverUrl.isNotEmpty()) {
            loadCoverAsync(context, coverUrl) { bitmap ->
                if (bitmap != null && currentSongId == songId) {
                    val updatedNotification = NotificationCompat.Builder(context, CHANNEL_ID)
                        .setSmallIcon(android.R.drawable.ic_media_play)
                        .setContentTitle(title)
                        .setContentText(author)
                        .setSubText("Jux")
                        .setContentIntent(openPendingIntent)
                        .setOngoing(isPlaying)
                        .setShowWhen(false)
                        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                        .setLargeIcon(bitmap)
                        .setStyle(
                            NotificationCompat.MediaStyle()
                                .setShowActionsInCompactView(0, 1, 2)
                                .setShowCancelButton(!isPlaying)
                        )
                        .addAction(prevAction)
                        .addAction(playPauseAction)
                        .addAction(nextAction)
                        .build()
                    
                    manager.notify(NOTIFICATION_ID, updatedNotification)
                }
            }
        }
    }
    
    /**
     * Arrête la notification.
     */
    fun stopNotification(context: Context) {
        currentSongId = null
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(NOTIFICATION_ID)
    }
    
    // ── Méthodes privées ────────────────────────────────────────
    
    private fun buildAction(
        context: Context,
        iconText: String,  // fallback texte
        command: String,
        title: String
    ): NotificationCompat.Action {
        val intent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = "com.jux.music.NOTIFICATION_ACTION"
            putExtra("command", command)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            command.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        // Utilise un icône par défaut (remplace par tes propres drawables)
        val icon = when (command) {
            "play" -> android.R.drawable.ic_media_play
            "pause" -> android.R.drawable.ic_media_pause
            "previous" -> android.R.drawable.ic_media_previous
            "next" -> android.R.drawable.ic_media_next
            else -> android.R.drawable.ic_media_play
        }
        return NotificationCompat.Action.Builder(icon, title, pendingIntent).build()
    }
    
    private fun loadCoverAsync(context: Context, coverUrl: String, callback: (Bitmap?) -> Unit) {
        Executors.newSingleThreadExecutor().execute {
            try {
                val url = URL(coverUrl)
                val connection = url.openConnection()
                connection.connectTimeout = 5000
                connection.readTimeout = 5000
                val inputStream = connection.getInputStream()
                val bitmap = BitmapFactory.decodeStream(inputStream)
                inputStream.close()
                
                Handler(Looper.getMainLooper()).post {
                    callback(bitmap)
                }
            } catch (e: Exception) {
                Log.e("JuxNotif", "Failed to load cover", e)
                Handler(Looper.getMainLooper()).post {
                    callback(null)
                }
            }
        }
    }
}
```

### 2.4. BroadcastReceiver pour les actions (NotificationActionReceiver.kt)

Crée ce fichier pour recevoir les clics sur les boutons de la notification :

```kotlin
package com.jux.music

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.webkit.WebView
import org.json.JSONObject

class NotificationActionReceiver : BroadcastReceiver() {
    
    companion object {
        var webViewRef: WebView? = null
    }
    
    override fun onReceive(context: Context, intent: Intent) {
        val command = intent.getStringExtra("command") ?: return
        
        when (command) {
            "play" -> sendCommand("play")
            "pause" -> sendCommand("pause")
            "play" -> sendCommand("play")  // Pour play quand en pause
            "previous" -> sendCommand("previous")
            "next" -> sendCommand("next")
            "stop" -> sendCommand("stop")
        }
    }
    
    private fun sendCommand(command: String) {
        val webView = webViewRef ?: return
        val json = JSONObject().apply {
            put("command", command)
        }
        webView.post {
            webView.evaluateJavascript(
                "window.onJuxNativeCommand('${json.toString().replace("'", "\\'")}');",
                null
            )
        }
    }
}
```

### 2.5. Enregistrer le Receiver dans AndroidManifest.xml

```xml
<application ...>
    <!-- ... autres déclarations ... -->
    
    <receiver android:name=".NotificationActionReceiver" android:exported="false" />
</application>
```

### 2.6. Initialisation dans ton Activity/Fragment

```kotlin
class MainActivity : AppCompatActivity() {
    
    private lateinit var webView: WebView
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // 1. Créer le canal de notification
        MediaNotificationService.createChannel(this)
        
        // 2. Configurer la WebView
        webView = findViewById(R.id.webview)
        webView.settings.javaScriptEnabled = true
        
        // 3. Ajouter le pont JavaScript (AVEC la référence à la WebView)
        webView.addJavascriptInterface(
            JuxAndroidBridge(this, webView),
            "JuxAndroid"
        )
        
        // 4. Donner la référence de la WebView au NotificationActionReceiver
        NotificationActionReceiver.webViewRef = webView
        
        // 5. Charger l'app
        webView.loadUrl("https://ton-site-jux.com")
    }
}
```

**Important :** Si l'Activity est détruite et recréée (rotation, etc.), mets à jour `NotificationActionReceiver.webViewRef` dans `onResume()`.

---

## 3. Test

### 3.1. Tester le pont depuis la WebView

Ouvre la console de débogage distante (Chrome DevTools) et tape :

```javascript
// Vérifier que le pont existe
window.JuxAndroid.updateNowPlaying(JSON.stringify({
  songId: "test",
  title: "Test Song",
  author: "Test Artist",
  coverUrl: "https://example.com/cover.jpg",
  duration: 200,
  currentTime: 0,
  isPlaying: true,
  playbackRate: 1,
  volume: 1,
  repeatMode: "off",
  isShuffled: false
}));

// La notification devrait apparaître avec le titre et l'artiste

// Tester le clear
window.JuxAndroid.clearNowPlaying();
```

### 3.2. Tester les commandes depuis la notification

Quand la notification est affichée :
1. Appuie sur **⏭ (next)** → la musique doit passer à la suivante
2. Appuie sur **⏸ (pause)** → la musique doit se mettre en pause
3. Appuie sur **▶ (play)** → la musique doit reprendre
4. Appuie sur **⏮ (previous)** → la musique doit revenir à la précédente

---

## 4. Dépannage

### La notification n'apparaît pas
- Vérifie que `createChannel()` est appelée avant la première notification
- Vérifie que les permissions de notification sont accordées (Android 13+)
- Vérifie que l'app n'est pas en mode "Ne pas déranger"

### La cover ne se charge pas
- Vérifie que l'URL de cover est absolue (commence par `https://`)
- Vérifie que tu as la permission Internet dans `AndroidManifest.xml`
- Teste l'URL de cover dans un navigateur

### Les boutons de la notification ne fonctionnent pas
- Vérifie que `NotificationActionReceiver.webViewRef` pointe bien vers la WebView
- Vérifie que `webView.evaluateJavascript()` est appelé sur le thread principal (`webView.post {}`)
- Vérifie dans la console JS si `window.onJuxNativeCommand` est défini