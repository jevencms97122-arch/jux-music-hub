package fr.nexoramusic.jux

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.widget.RemoteViews

/**
 * Widget d'écran d'accueil "now playing" — cover, titre/auteur, contrôles play/pause/
 * précédent/suivant. Les boutons envoient directement une action à MediaPlaybackService
 * (même mécanisme que les actions de la notification), donc fonctionnent même si l'app
 * n'est pas au premier plan.
 */
class JuxWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) {
            appWidgetManager.updateAppWidget(id, buildViews(context, "Nexora Music", "Aucune lecture en cours", false, null))
        }
    }

    companion object {
        private fun widgetComponent(context: Context) = ComponentName(context, JuxWidgetProvider::class.java)

        private fun serviceIntent(context: Context, action: String): PendingIntent {
            val intent = Intent(context, MediaPlaybackService::class.java).apply { this.action = action }
            return PendingIntent.getService(
                context, action.hashCode(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        private fun openAppIntent(context: Context): PendingIntent {
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
            return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }

        private fun buildViews(context: Context, title: String, author: String, isPlaying: Boolean, cover: Bitmap?): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.jux_widget)
            views.setTextViewText(R.id.widget_title, title)
            views.setTextViewText(R.id.widget_author, author)
            views.setImageViewResource(
                R.id.widget_play_pause,
                if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
            )
            if (cover != null) views.setImageViewBitmap(R.id.widget_cover, cover)
            else views.setImageViewResource(R.id.widget_cover, R.mipmap.ic_launcher)

            views.setOnClickPendingIntent(R.id.widget_root, openAppIntent(context))
            views.setOnClickPendingIntent(R.id.widget_prev, serviceIntent(context, MediaPlaybackService.ACTION_PREVIOUS))
            views.setOnClickPendingIntent(R.id.widget_play_pause, serviceIntent(context, MediaPlaybackService.ACTION_PLAY_PAUSE))
            views.setOnClickPendingIntent(R.id.widget_next, serviceIntent(context, MediaPlaybackService.ACTION_NEXT))
            return views
        }

        /** Appelé par MediaPlaybackService à chaque mise à jour des métadonnées/état. */
        fun updateAll(context: Context, title: String, author: String, isPlaying: Boolean, cover: Bitmap?) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(widgetComponent(context))
            if (ids.isEmpty()) return
            val views = buildViews(context, title, author, isPlaying, cover)
            for (id in ids) manager.updateAppWidget(id, views)
        }

        /** Appelé quand la lecture s'arrête complètement (ACTION_CLEAR). */
        fun showIdle(context: Context) {
            updateAll(context, "Nexora Music", "Aucune lecture en cours", false, null)
        }
    }
}
