package fr.nexoramusic.jux

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle
import java.net.URL

/** Notification "now playing" (style lecteur média) + MediaSession pour les contrôles Android/écran verrouillé. */
class MediaPlaybackService : Service() {

    companion object {
        const val ACTION_UPDATE = "fr.nexoramusic.jux.action.UPDATE_NOW_PLAYING"
        const val ACTION_UPDATE_POSITION = "fr.nexoramusic.jux.action.UPDATE_POSITION"
        const val ACTION_CLEAR = "fr.nexoramusic.jux.action.CLEAR_NOW_PLAYING"
        const val ACTION_PLAY_PAUSE = "fr.nexoramusic.jux.action.PLAY_PAUSE"
        const val ACTION_NEXT = "fr.nexoramusic.jux.action.NEXT"
        const val ACTION_PREVIOUS = "fr.nexoramusic.jux.action.PREVIOUS"
        private const val CHANNEL_ID = "jux_now_playing"
        private const val NOTIFICATION_ID = 4242
        /** Fréquence du réveil forcé de la logique JS pendant la lecture (voir startHeartbeat). */
        private const val HEARTBEAT_INTERVAL_MS = 3000L
    }

    private lateinit var mediaSession: MediaSessionCompat
    private var lastCoverUrl: String? = null
    private var lastCoverBitmap: Bitmap? = null
    private var lastDuration: Double = 0.0
    private val mainHandler = Handler(Looper.getMainLooper())
    private var wakeLock: PowerManager.WakeLock? = null
    private var heartbeatRunning = false

    /**
     * Quand l'app passe en arrière-plan, la WebView Android gèle sa page (comportement
     * Chromium standard) : les timers JS ('timeupdate', 'setInterval'...) s'arrêtent, mais
     * l'audio natif continue de jouer jusqu'au bout — la logique JS qui enchaînerait sur le
     * morceau suivant ne s'exécute alors plus tant que l'app n'est pas raffichée. Un appel
     * natif evaluateJavascript passe généralement là où un timer interne resterait bloqué :
     * ce heartbeat réveille donc périodiquement window.__juxBackgroundTick (voir
     * PlayerContext.tsx) pour vérifier la progression et forcer l'enchaînement si besoin,
     * tant que la lecture est active (wake lock tenu en parallèle pour garder le CPU éveillé).
     */
    private val heartbeatRunnable = object : Runnable {
        override fun run() {
            JuxWebViewHolder.evaluate("window.__juxBackgroundTick && window.__juxBackgroundTick()")
            if (heartbeatRunning) mainHandler.postDelayed(this, HEARTBEAT_INTERVAL_MS)
        }
    }

    private fun startHeartbeat() {
        if (heartbeatRunning) return
        heartbeatRunning = true
        mainHandler.postDelayed(heartbeatRunnable, HEARTBEAT_INTERVAL_MS)
    }

    private fun stopHeartbeat() {
        heartbeatRunning = false
        mainHandler.removeCallbacks(heartbeatRunnable)
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Jux:PlaybackWakeLock")
        mediaSession = MediaSessionCompat(this, "JuxMediaSession").apply {
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() { JuxWebViewHolder.sendCommand("""{"command":"play"}""") }
                override fun onPause() { JuxWebViewHolder.sendCommand("""{"command":"pause"}""") }
                override fun onSkipToNext() { JuxWebViewHolder.sendCommand("""{"command":"next"}""") }
                override fun onSkipToPrevious() { JuxWebViewHolder.sendCommand("""{"command":"previous"}""") }
                override fun onSeekTo(pos: Long) {
                    JuxWebViewHolder.sendCommand("""{"command":"seek","seekTime":${pos / 1000.0}}""")
                }
            })
            isActive = true
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_CLEAR -> {
                stopForeground(STOP_FOREGROUND_REMOVE)
                mediaSession.isActive = false
                updateWakeLock(false)
                stopSelf()
            }
            ACTION_UPDATE_POSITION -> {
                val currentTime = intent.getDoubleExtra("currentTime", 0.0)
                val isPlaying = intent.getBooleanExtra("isPlaying", false)
                updatePlaybackState(isPlaying, currentTime)
            }
            ACTION_PLAY_PAUSE -> JuxWebViewHolder.sendCommand("""{"command":"togglePlay"}""")
            ACTION_NEXT -> JuxWebViewHolder.sendCommand("""{"command":"next"}""")
            ACTION_PREVIOUS -> JuxWebViewHolder.sendCommand("""{"command":"previous"}""")
            else -> {
                val title = intent?.getStringExtra("title") ?: "Sans titre"
                val author = intent?.getStringExtra("author") ?: ""
                val coverUrl = intent?.getStringExtra("coverUrl") ?: ""
                val duration = intent?.getDoubleExtra("duration", 0.0) ?: 0.0
                val currentTime = intent?.getDoubleExtra("currentTime", 0.0) ?: 0.0
                val isPlaying = intent?.getBooleanExtra("isPlaying", false) ?: false

                lastDuration = duration
                updateSessionMetadata(title, author, duration)
                updatePlaybackState(isPlaying, currentTime)

                if (coverUrl.isNotEmpty() && coverUrl != lastCoverUrl) {
                    lastCoverUrl = coverUrl
                    lastCoverBitmap = null
                    loadCoverAndNotify(coverUrl, title, author, isPlaying)
                } else {
                    startForeground(NOTIFICATION_ID, buildNotification(title, author, isPlaying, lastCoverBitmap))
                }
            }
        }
        return START_NOT_STICKY
    }

    private fun updateSessionMetadata(title: String, author: String, duration: Double) {
        val builder = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, author)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, (duration * 1000).toLong())
        lastCoverBitmap?.let { builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, it) }
        mediaSession.setMetadata(builder.build())
    }

    /** Garde le CPU éveillé tant que la lecture est active, même écran éteint / app en
     * arrière-plan — sinon Android peut ralentir les timers JS de la WebView au point
     * d'empêcher l'enchaînement automatique sur le morceau suivant en fin de piste. */
    private fun updateWakeLock(isPlaying: Boolean) {
        val lock = wakeLock ?: return
        if (isPlaying) {
            if (!lock.isHeld) lock.acquire(12 * 60 * 60 * 1000L /* filet de sécurité 12h */)
            startHeartbeat()
        } else {
            if (lock.isHeld) lock.release()
            stopHeartbeat()
        }
    }

    private fun updatePlaybackState(isPlaying: Boolean, currentTime: Double) {
        updateWakeLock(isPlaying)
        val state = if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
        val playbackState = PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY or PlaybackStateCompat.ACTION_PAUSE or
                    PlaybackStateCompat.ACTION_PLAY_PAUSE or PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                    PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or PlaybackStateCompat.ACTION_SEEK_TO
            )
            .setState(state, (currentTime * 1000).toLong(), 1f)
            .build()
        mediaSession.setPlaybackState(playbackState)
        mediaSession.isActive = true
    }

    private fun loadCoverAndNotify(coverUrl: String, title: String, author: String, isPlaying: Boolean) {
        // Notification immédiate (sans cover) : startForeground doit être appelé sous 5s
        startForeground(NOTIFICATION_ID, buildNotification(title, author, isPlaying, lastCoverBitmap))
        Thread {
            val bitmap = try {
                URL(coverUrl).openStream().use { BitmapFactory.decodeStream(it) }
            } catch (_: Exception) { null }
            if (bitmap != null) {
                lastCoverBitmap = bitmap
                mainHandler.post {
                    updateSessionMetadata(title, author, lastDuration)
                    val manager = getSystemService(NotificationManager::class.java)
                    manager?.notify(NOTIFICATION_ID, buildNotification(title, author, isPlaying, bitmap))
                }
            }
        }.start()
    }

    private fun buildNotification(title: String, author: String, isPlaying: Boolean, cover: Bitmap?): Notification {
        val playPauseIcon = if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(author)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .apply { if (cover != null) setLargeIcon(cover) }
            .setOngoing(isPlaying)
            .setOnlyAlertOnce(true)
            .addAction(android.R.drawable.ic_media_previous, "Précédent", serviceIntent(ACTION_PREVIOUS))
            .addAction(playPauseIcon, "Lecture/Pause", serviceIntent(ACTION_PLAY_PAUSE))
            .addAction(android.R.drawable.ic_media_next, "Suivant", serviceIntent(ACTION_NEXT))
            .setStyle(
                MediaStyle()
                    .setMediaSession(mediaSession.sessionToken)
                    .setShowActionsInCompactView(0, 1, 2)
            )
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()
    }

    private fun serviceIntent(action: String): PendingIntent {
        val intent = Intent(this, MediaPlaybackService::class.java).apply { this.action = action }
        return PendingIntent.getService(
            this, action.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Lecture en cours", NotificationManager.IMPORTANCE_LOW
            ).apply { description = "Contrôles de lecture Jux Music" }
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        updateWakeLock(false)
        mediaSession.release()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
