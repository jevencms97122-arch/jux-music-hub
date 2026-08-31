mod discord;

use discord::{DiscordHandle, PresenceData};
use tauri::{Emitter, Manager, State};

/// Plateforme native ("windows", "linux", "macos", "android", "ios") — utilisé
/// côté JS pour n'afficher les réglages spécifiques (mode développeur GPU,
/// rester actif en arrière-plan…) que sur les plateformes où ils ont un sens.
#[tauri::command]
fn get_platform() -> &'static str {
    std::env::consts::OS
}

/// Notification "nouveau message" cliquable — le plugin tauri-plugin-notification
/// standard ne remonte pas les clics sur Windows (seulement Android/iOS), donc on
/// construit le toast nous-mêmes via tauri-winrt-notification pour pouvoir écouter
/// l'activation et renvoyer l'app au premier plan sur la bonne conversation.
#[cfg(windows)]
#[tauri::command]
fn show_chat_notification(app: tauri::AppHandle, title: String, body: String, sender_id: String) {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use tauri_winrt_notification::Toast;
    let app_id = app.config().identifier.clone();
    // WinRT peut parfois signaler l'activation plus d'une fois pour un même clic —
    // cette garde assure qu'on ne traite (focus + navigation) qu'une seule fois.
    let handled = Arc::new(AtomicBool::new(false));
    std::thread::spawn(move || {
        let handle = app.clone();
        let sid = sender_id.clone();
        let app_id_clone = app_id.clone();
        let toast = Toast::new(&app_id)
            .title(&title)
            .text1(&body)
            // On joue déjà notre propre SFX côté JS — désactive le son système
            // de Windows pour éviter d'entendre les deux en même temps.
            .sound(None)
            .on_activated(move |_action| {
                if handled.swap(true, Ordering::SeqCst) {
                    return Ok(());
                }
                let handle_outer = handle.clone();
                let handle_inner = handle.clone();
                let sid = sid.clone();
                let app_id_for_clear = app_id_clone.clone();
                // IMPORTANT : ce callback tourne sur le thread du toast WinRT, pas
                // le thread principal de l'UI. Manipuler la fenêtre (focus, show,
                // always-on-top) depuis là cassait le rendu (fenêtre vide/figée).
                // On repasse donc sur le thread principal via run_on_main_thread.
                let _ = handle_outer.run_on_main_thread(move || {
                    if let Some(window) = handle_inner.get_webview_window("main") {
                        let _ = window.unminimize();
                        let _ = window.show();
                        // Bascule always-on-top on/off : contourne le foreground lock
                        // de Windows qui ignore sinon set_focus() depuis un process
                        // "en arrière-plan".
                        let _ = window.set_always_on_top(true);
                        let _ = window.set_always_on_top(false);
                        let _ = window.set_focus();
                    }
                    // Le bouton "Ouvrir" du toast ne referme pas la notif automatiquement —
                    // on la retire nous-mêmes de l'historique Windows dès qu'elle est cliquée,
                    // sinon elle reste affichée jusqu'à son expiration naturelle.
                    clear_toast_history(&app_id_for_clear);
                    let _ = handle_inner.emit("chat-notification-clicked", sid.clone());
                });
                Ok(())
            });
        let _ = toast.show();
        // Garde le thread (et donc le Toast + son handler d'activation) en vie :
        // WinRT ne peut plus livrer l'événement de clic une fois l'objet détruit.
        std::thread::sleep(std::time::Duration::from_secs(60 * 30));
    });
}

#[cfg(not(windows))]
#[tauri::command]
fn show_chat_notification(_app: tauri::AppHandle, _title: String, _body: String, _sender_id: String) {}

/// Retire toutes les notifications de cette app de l'historique/centre de
/// notifications Windows — utilisé quand l'utilisateur clique sur le toast
/// pour qu'il disparaisse immédiatement au lieu d'attendre son expiration.
#[cfg(windows)]
fn clear_toast_history(app_id: &str) {
    use windows::core::HSTRING;
    use windows::UI::Notifications::ToastNotificationManager;
    if let Ok(history) = ToastNotificationManager::History() {
        let _ = history.ClearWithId(&HSTRING::from(app_id));
    }
}

struct AppState {
    discord: DiscordHandle,
    close_to_tray: std::sync::Mutex<bool>,
    #[cfg(windows)]
    smtc_player: std::sync::Mutex<Option<windows::Media::Playback::MediaPlayer>>,
}

/// Intégration native avec les contrôles multimédia système Windows (SMTC — le
/// popup qu'on obtient depuis l'icône volume). On n'utilise PAS l'intégration
/// automatique du navigateur (désactivée via additionalBrowserArgs) car elle
/// affiche "Application inconnue" pour les apps non empaquetées (MSIX). À la
/// place, comme VLC/foobar2000 sur Win32, on crée un MediaPlayer WinRT "fictif"
/// (aucun média n'y est réellement chargé) uniquement pour obtenir un
/// SystemMediaTransportControls correctement rattaché à notre process.
#[cfg(windows)]
fn ensure_smtc_player(
    app: &tauri::AppHandle,
    slot: &std::sync::Mutex<Option<windows::Media::Playback::MediaPlayer>>,
) -> windows::core::Result<()> {
    use windows::Foundation::TypedEventHandler;
    use windows::Media::Playback::MediaPlayer;
    use windows::Media::SystemMediaTransportControlsButton as Btn;
    use windows::Media::SystemMediaTransportControlsButtonPressedEventArgs as ButtonPressedArgs;

    let mut guard = slot.lock().unwrap();
    if guard.is_some() {
        return Ok(());
    }

    let player = MediaPlayer::new()?;
    player.SetAutoPlay(false)?;
    let smtc = player.SystemMediaTransportControls()?;
    smtc.SetIsEnabled(true)?;
    smtc.SetIsPlayEnabled(true)?;
    smtc.SetIsPauseEnabled(true)?;
    smtc.SetIsNextEnabled(true)?;
    smtc.SetIsPreviousEnabled(true)?;

    let handle = app.clone();
    smtc.ButtonPressed(&TypedEventHandler::new(
        move |_sender: windows::core::Ref<'_, windows::Media::SystemMediaTransportControls>,
              args: windows::core::Ref<'_, ButtonPressedArgs>| {
            if let Ok(args) = args.ok() {
                let cmd = match args.Button()? {
                    Btn::Play => Some("play"),
                    Btn::Pause => Some("pause"),
                    Btn::Next => Some("next"),
                    Btn::Previous => Some("previous"),
                    _ => None,
                };
                if let Some(cmd) = cmd {
                    let _ = handle.emit("smtc-command", cmd);
                }
            }
            Ok(())
        },
    ))?;

    *guard = Some(player);
    Ok(())
}

/// Met à jour le titre/artiste/pochette/état de lecture affichés dans le popup média Windows.
#[cfg(windows)]
#[tauri::command]
fn smtc_update(app: tauri::AppHandle, state: State<AppState>, title: String, artist: String, is_playing: bool, cover_url: Option<String>) {
    use windows::core::HSTRING;
    use windows::Foundation::Uri;
    use windows::Media::{MediaPlaybackStatus, MediaPlaybackType};
    use windows::Storage::Streams::RandomAccessStreamReference;

    if ensure_smtc_player(&app, &state.smtc_player).is_err() {
        return;
    }
    let guard = state.smtc_player.lock().unwrap();
    let Some(player) = guard.as_ref() else { return };
    let Ok(smtc) = player.SystemMediaTransportControls() else { return };
    let _ = smtc.SetPlaybackStatus(if is_playing { MediaPlaybackStatus::Playing } else { MediaPlaybackStatus::Paused });
    if let Ok(updater) = smtc.DisplayUpdater() {
        let _ = updater.SetType(MediaPlaybackType::Music);
        if let Ok(music) = updater.MusicProperties() {
            let _ = music.SetTitle(&HSTRING::from(title));
            let _ = music.SetArtist(&HSTRING::from(artist));
        }
        // La pochette est une simple URL http(s) — pas besoin de la télécharger
        // nous-mêmes, RandomAccessStreamReference peut la charger directement.
        match cover_url.filter(|u| !u.is_empty()) {
            Some(url) => {
                if let Ok(uri) = Uri::CreateUri(&HSTRING::from(url)) {
                    if let Ok(stream_ref) = RandomAccessStreamReference::CreateFromUri(&uri) {
                        let _ = updater.SetThumbnail(&stream_ref);
                    }
                }
            }
            None => {
                let _ = updater.SetThumbnail(None);
            }
        }
        let _ = updater.Update();
    }
}

#[cfg(not(windows))]
#[tauri::command]
fn smtc_update(_app: tauri::AppHandle, _title: String, _artist: String, _is_playing: bool, _cover_url: Option<String>) {}

#[cfg(windows)]
#[tauri::command]
fn smtc_clear(state: State<AppState>) {
    use windows::Media::MediaPlaybackStatus;
    let guard = state.smtc_player.lock().unwrap();
    if let Some(player) = guard.as_ref() {
        if let Ok(smtc) = player.SystemMediaTransportControls() {
            let _ = smtc.SetPlaybackStatus(MediaPlaybackStatus::Closed);
        }
    }
}

#[cfg(not(windows))]
#[tauri::command]
fn smtc_clear() {}

fn get_downloads_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("Failed to get cache dir: {e}"))?;
    Ok(cache_dir.join("downloads"))
}

/// Devine une extension audio plausible à partir de l'URL du fichier source.
/// Important : ne PAS renvoyer une extension arbitraire (ex: toujours ".m4a")
/// — le lecteur média d'Android (contrairement à WebView2 sur Windows, plus
/// tolérant) se fie à l'extension pour déterminer le conteneur/codec, et une
/// extension incorrecte (ex: un vrai fichier .mp3 sauvegardé en .m4a) fait
/// planter le décodage en cours de lecture au lieu de la refuser d'emblée.
fn guess_audio_extension(audio_url: &str) -> &'static str {
    let lower = audio_url.to_lowercase();
    if lower.contains(".m4a") || lower.contains(".mp4") || lower.contains(".aac") {
        "m4a"
    } else if lower.contains(".wav") {
        "wav"
    } else if lower.contains(".opus") {
        "opus"
    } else if lower.contains(".ogg") {
        "ogg"
    } else {
        // Format le plus courant accepté à l'upload (voir Upload.tsx) — valeur
        // par défaut si l'URL ne porte pas d'extension explicite reconnue.
        "mp3"
    }
}

/// Cherche un fichier audio téléchargé pour ce song_id, quelle que soit son extension
fn find_audio_file(downloads_dir: &std::path::Path, song_id: &str) -> Option<std::path::PathBuf> {
    for ext in ["mp3", "m4a", "wav", "ogg", "opus"] {
        let candidate = downloads_dir.join(format!("{song_id}.{ext}"));
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

/// Devine une extension d'image plausible à partir de l'URL de la cover
fn guess_cover_extension(cover_url: &str) -> &'static str {
    let lower = cover_url.to_lowercase();
    if lower.contains(".png") {
        "png"
    } else if lower.contains(".webp") {
        "webp"
    } else if lower.contains(".gif") {
        "gif"
    } else {
        "jpg"
    }
}

/// Cherche un fichier cover existant pour ce song_id, quelle que soit son extension
fn find_cover_file(downloads_dir: &std::path::Path, song_id: &str) -> Option<std::path::PathBuf> {
    for ext in ["jpg", "png", "webp", "gif"] {
        let candidate = downloads_dir.join(format!("{song_id}.cover.{ext}"));
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

/// Télécharge et sauvegarde une musique (+ sa cover) pour l'écoute hors ligne
#[tauri::command]
async fn download_song(
    app: tauri::AppHandle,
    song_id: String,
    _title: String,
    _author: String,
    audio_url: String,
    cover_url: String,
) -> Result<(), String> {
    // Créer le dossier de cache des téléchargements
    let downloads_dir = get_downloads_dir(&app)?;
    std::fs::create_dir_all(&downloads_dir)
        .map_err(|e| format!("Failed to create downloads dir: {e}"))?;

    // Retire un éventuel fichier audio précédent pour ce morceau (peut avoir
    // été sauvegardé avec une autre extension par une ancienne version de l'app).
    if let Some(old_audio) = find_audio_file(&downloads_dir, &song_id) {
        let _ = std::fs::remove_file(old_audio);
    }

    // Chemin du fichier audio — extension devinée depuis l'URL source, PAS
    // codée en dur (voir le commentaire de guess_audio_extension).
    let ext = guess_audio_extension(&audio_url);
    let audio_file = downloads_dir.join(format!("{song_id}.{ext}"));

    // Télécharger le fichier audio
    let client = reqwest::Client::new();
    let response = client
        .get(&audio_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download audio: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with status {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read audio bytes: {e}"))?;

    // Sauvegarder le fichier
    std::fs::write(&audio_file, bytes)
        .map_err(|e| format!("Failed to write audio file: {e}"))?;

    // Télécharger la cover en best-effort : un échec ici ne doit pas faire
    // échouer le téléchargement de la musique elle-même.
    if !cover_url.is_empty() {
        // Retire une éventuelle cover précédente (extension différente) avant d'écrire la nouvelle
        if let Some(old_cover) = find_cover_file(&downloads_dir, &song_id) {
            let _ = std::fs::remove_file(old_cover);
        }
        if let Ok(cover_response) = client.get(&cover_url).send().await {
            if cover_response.status().is_success() {
                if let Ok(cover_bytes) = cover_response.bytes().await {
                    let ext = guess_cover_extension(&cover_url);
                    let cover_file = downloads_dir.join(format!("{song_id}.cover.{ext}"));
                    let _ = std::fs::write(&cover_file, cover_bytes);
                }
            }
        }
    }

    Ok(())
}

/// Retourne le chemin d'un fichier audio téléchargé
#[tauri::command]
fn get_downloaded_audio_path(app: tauri::AppHandle, song_id: String) -> Result<String, String> {
    let downloads_dir = get_downloads_dir(&app)?;
    match find_audio_file(&downloads_dir, &song_id) {
        Some(path) => Ok(path.to_string_lossy().to_string()),
        None => Err("Audio file not found".to_string()),
    }
}

/// Lit et renvoie les octets bruts d'un fichier audio téléchargé.
///
/// Utilisé uniquement sur Android en remplacement de `convertFileSrc` +
/// protocole `asset://` — ce protocole coupe la lecture en cours de route sur
/// Android (durée mal détectée / pas de support fiable des requêtes de plage
/// pour ce type de ressource dans la WebView système), alors qu'il fonctionne
/// bien sur Windows (WebView2). Ici, le fichier est lu intégralement et
/// renvoyé tel quel : côté JS, il est reconstruit en Blob (voir
/// `getDownloadedAudioBlobUrl` dans offlineCacheSync.ts), ce qui garantit une
/// lecture complète et fiable quelle que soit la taille du fichier.
#[tauri::command]
fn read_downloaded_audio(app: tauri::AppHandle, song_id: String) -> Result<tauri::ipc::Response, String> {
    let downloads_dir = get_downloads_dir(&app)?;
    let path = find_audio_file(&downloads_dir, &song_id)
        .ok_or_else(|| "Audio file not found".to_string())?;
    let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read audio file: {e}"))?;
    Ok(tauri::ipc::Response::new(bytes))
}

/// Retourne le chemin de la cover téléchargée pour une musique, si elle existe
#[tauri::command]
fn get_downloaded_cover_path(app: tauri::AppHandle, song_id: String) -> Result<String, String> {
    let downloads_dir = get_downloads_dir(&app)?;
    match find_cover_file(&downloads_dir, &song_id) {
        Some(path) => Ok(path.to_string_lossy().to_string()),
        None => Err("Cover file not found".to_string()),
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CachedAudioFile {
    song_id: String,
    local_path: String,
    size_bytes: u64,
}

/// Liste tous les fichiers audio téléchargés
#[tauri::command]
fn list_downloaded_songs(app: tauri::AppHandle) -> Result<Vec<CachedAudioFile>, String> {
    let downloads_dir = get_downloads_dir(&app)?;

    if !downloads_dir.exists() {
        return Ok(Vec::new());
    }

    let mut songs = Vec::new();
    for entry in std::fs::read_dir(&downloads_dir)
        .map_err(|e| format!("Failed to read downloads dir: {e}"))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {e}"))?;
        let path = entry.path();

        // Ne compter que les fichiers audio — les covers (.cover.*) sont stockées
        // à côté (extensions image, jamais audio) et ne doivent pas apparaître
        // comme des sons distincts.
        let ext = path.extension().and_then(|e| e.to_str());
        let is_audio_ext = matches!(ext, Some("mp3") | Some("m4a") | Some("wav") | Some("ogg") | Some("opus"));
        if path.is_file() && is_audio_ext {
            if let Some(filename) = path.file_stem() {
                if let Some(song_id) = filename.to_str() {
                    let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
                    songs.push(CachedAudioFile {
                        song_id: song_id.to_string(),
                        local_path: path.to_string_lossy().to_string(),
                        size_bytes,
                    });
                }
            }
        }
    }

    Ok(songs)
}

/// Supprime un fichier audio téléchargé (et sa cover si présente)
#[tauri::command]
fn delete_downloaded_song(app: tauri::AppHandle, song_id: String) -> Result<(), String> {
    let downloads_dir = get_downloads_dir(&app)?;

    if let Some(audio_file) = find_audio_file(&downloads_dir, &song_id) {
        std::fs::remove_file(&audio_file)
            .map_err(|e| format!("Failed to delete audio file: {e}"))?;
    }

    if let Some(cover_file) = find_cover_file(&downloads_dir, &song_id) {
        let _ = std::fs::remove_file(cover_file);
    }

    Ok(())
}

/// Appelé depuis le JS au démarrage (et à chaque changement du réglage) pour que
/// le comportement de fermeture de fenêtre corresponde à la préférence utilisateur
/// (stockée côté JS en localStorage — Rust ne la connaît pas tant qu'on ne la lui dit pas).
#[tauri::command]
fn set_close_to_tray(state: State<AppState>, enabled: bool) {
    *state.close_to_tray.lock().unwrap() = enabled;
}

/// Dossier des préférences GPU — doit être lisible AVANT la création de la
/// fenêtre (donc avant que le JS ne tourne), impossible de passer par localStorage.
#[cfg(windows)]
fn gpu_pref_dir(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok()
}

#[cfg(windows)]
fn gpu_pref_file(app: &tauri::AppHandle, name: &str) -> Option<std::path::PathBuf> {
    gpu_pref_dir(app).map(|dir| dir.join(name))
}

#[cfg(windows)]
fn write_gpu_pref(app: &tauri::AppHandle, name: &str, content: &str) {
    if let Some(path) = gpu_pref_file(app, name) {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::write(path, content);
    }
}

#[cfg(windows)]
fn read_gpu_pref(app: &tauri::AppHandle, name: &str) -> Option<String> {
    gpu_pref_file(app, name)
        .and_then(|p| std::fs::read_to_string(p).ok())
        .map(|s| s.trim().to_string())
}

/// Sauvegarde la préférence d'accélération GPU. Ne prend effet qu'au prochain
/// démarrage (les arguments du navigateur WebView2 sont figés à sa création).
#[cfg(windows)]
#[tauri::command]
fn set_gpu_acceleration(app: tauri::AppHandle, enabled: bool) {
    write_gpu_pref(&app, "gpu_accel.txt", if enabled { "1" } else { "0" });
}

#[cfg(not(windows))]
#[tauri::command]
fn set_gpu_acceleration(_app: tauri::AppHandle, _enabled: bool) {}

#[cfg(windows)]
fn read_gpu_acceleration_pref(app: &tauri::AppHandle) -> bool {
    read_gpu_pref(app, "gpu_accel.txt")
        .map(|s| s == "1")
        // Par défaut activé : WebView2 utilise déjà le rendu GPU sauf si le
        // pilote est sur la liste noire de Chromium — on force ce cas-là aussi.
        .unwrap_or(true)
}

/// Backend ANGLE (traducteur Chromium → API graphique native) : "d3d11" (par
/// défaut), "d3d11on12" ou "d3d9" pour la compatibilité avec du matériel plus ancien.
#[cfg(windows)]
#[tauri::command]
fn set_gpu_backend(app: tauri::AppHandle, backend: String) {
    write_gpu_pref(&app, "gpu_backend.txt", &backend);
}

#[cfg(not(windows))]
#[tauri::command]
fn set_gpu_backend(_app: tauri::AppHandle, _backend: String) {}

/// Préférence d'adaptateur GPU sur machine à double carte (portable) : "auto",
/// "high" (dédiée) ou "low" (intégrée, économie d'énergie).
#[cfg(windows)]
#[tauri::command]
fn set_gpu_adapter(app: tauri::AppHandle, pref: String) {
    write_gpu_pref(&app, "gpu_adapter.txt", &pref);
}

#[cfg(not(windows))]
#[tauri::command]
fn set_gpu_adapter(_app: tauri::AppHandle, _pref: String) {}

/// Arme un passage en Vulkan pour le TOUT PROCHAIN démarrage uniquement — le
/// marqueur est consommé (supprimé) dès sa lecture au démarrage suivant, qu'il
/// ait servi ou non. Le support Vulkan d'ANGLE sur Windows est expérimental :
/// si ça plante en boucle, un simple relancement retombe automatiquement sur le
/// backend Direct3D habituel au lieu de rester bloqué en Vulkan pour toujours.
#[cfg(windows)]
#[tauri::command]
fn arm_vulkan_once(app: tauri::AppHandle) {
    write_gpu_pref(&app, "gpu_vulkan_once.txt", "1");
}

#[cfg(not(windows))]
#[tauri::command]
fn arm_vulkan_once(_app: tauri::AppHandle) {}

/// Lit puis consomme immédiatement le marqueur Vulkan one-shot.
#[cfg(windows)]
fn take_vulkan_once(app: &tauri::AppHandle) -> bool {
    let Some(path) = gpu_pref_file(app, "gpu_vulkan_once.txt") else { return false };
    let armed = path.exists();
    let _ = std::fs::remove_file(&path);
    armed
}

/// Construit la chaîne d'arguments navigateur WebView2 à partir de toutes les
/// préférences GPU sauvegardées. Le Vulkan one-shot est prioritaire sur le choix
/// de backend Direct3D habituel puisqu'il ne concerne que ce seul lancement.
#[cfg(windows)]
fn build_browser_args(app: &tauri::AppHandle) -> String {
    let mut args = String::from("--disable-features=HardwareMediaKeyHandling,MediaSessionService");

    if !read_gpu_acceleration_pref(app) {
        args.push_str(" --disable-gpu");
        // Le one-shot Vulkan n'a de sens que si l'accélération est activée —
        // on le consomme quand même pour ne pas le laisser traîner indéfiniment.
        take_vulkan_once(app);
        return args;
    }

    args.push_str(" --ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy");

    match read_gpu_pref(app, "gpu_adapter.txt").as_deref() {
        Some("high") => args.push_str(" --force_high_performance_gpu"),
        Some("low") => args.push_str(" --force_low_power_gpu"),
        _ => {}
    }

    if take_vulkan_once(app) {
        args.push_str(" --use-angle=vulkan");
    } else {
        match read_gpu_pref(app, "gpu_backend.txt").as_deref() {
            Some("d3d11on12") => args.push_str(" --use-angle=d3d11on12"),
            Some("d3d9") => args.push_str(" --use-angle=d3d9"),
            _ => args.push_str(" --use-angle=d3d11"),
        }
    }

    args
}

#[tauri::command]
fn discord_update_presence(
    state: State<AppState>,
    title: String,
    author: String,
    cover_url: Option<String>,
    is_playing: bool,
    start_timestamp: Option<i64>,
    duration_secs: Option<f64>,
) {
    state.discord.update(PresenceData {
        title,
        author,
        cover_url: cover_url.unwrap_or_default(),
        is_playing,
        start_timestamp,
        duration_secs,
    });
}

#[tauri::command]
fn discord_clear_presence(state: State<AppState>) {
    state.discord.clear();
}

/// Associe l'AUMID à un nom affichable + une icône dans le registre Windows.
/// SetCurrentProcessExplicitAppUserModelID seul dit juste à Windows "je suis X" —
/// sans cette clé registre, Windows ne sait pas comment afficher "X" (nom + icône)
/// dans les contrôles multimédia système (popup volume), d'où "Application inconnue".
#[cfg(windows)]
fn register_aumid_display_info(aumid: &str) {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = format!("Software\\Classes\\AppUserModelId\\{aumid}");
    if let Ok((key, _)) = hkcu.create_subkey(path) {
        let _ = key.set_value("DisplayName", &"Nexora Music");
        // IconUri exige un chemin direct vers un vrai fichier .ico — la notation
        // "exe,index" (utilisée pour les raccourcis) n'est PAS acceptée ici et fait
        // silencieusement échouer toute la résolution (nom ET icône restent "Application inconnue").
        // icon.ico est installé à côté de l'exe via bundle.resources (tauri.conf.json).
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(dir) = exe_path.parent() {
                let icon_path = dir.join("icon.ico");
                if icon_path.exists() {
                    let _ = key.set_value("IconUri", &icon_path.display().to_string());
                }
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Identifie explicitement le process auprès de Windows (AUMID) — sans ça,
    // les contrôles multimédia système (popup volume/SMTC) ne savent pas à quelle
    // app rattacher la lecture en cours et affichent "Application inconnue" avec
    // une icône générique au lieu de "Nexora Music".
    #[cfg(windows)]
    {
        use windows::core::HSTRING;
        use windows::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;
        const AUMID: &str = "fr.nexoramusic.jux";
        register_aumid_display_info(AUMID);
        unsafe {
            let _ = SetCurrentProcessExplicitAppUserModelID(&HSTRING::from(AUMID));
        }
    }

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init());

    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    builder
        .manage(AppState {
            discord: discord::spawn(),
            close_to_tray: std::sync::Mutex::new(false),
            #[cfg(windows)]
            smtc_player: std::sync::Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            get_platform,
            discord_update_presence,
            discord_clear_presence,
            show_chat_notification,
            set_close_to_tray,
            set_gpu_acceleration,
            set_gpu_backend,
            set_gpu_adapter,
            arm_vulkan_once,
            smtc_update,
            smtc_clear,
            download_song,
            get_downloaded_audio_path,
            read_downloaded_audio,
            get_downloaded_cover_path,
            list_downloaded_songs,
            delete_downloaded_song
        ])
        .setup(|app| {
            // La fenêtre "main" n'est plus déclarée dans tauri.conf.json sur Windows
            // (voir tauri.windows.conf.json : "windows": []) — on la construit ici
            // pour pouvoir choisir les additional_browser_args selon la préférence
            // GPU de l'utilisateur, décidée avant que WebView2 ne soit initialisé.
            #[cfg(windows)]
            {
                let browser_args = build_browser_args(app.handle());

                tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
                    .title("Nexora Music")
                    .inner_size(1280.0, 820.0)
                    .min_inner_size(400.0, 600.0)
                    .background_color(tauri::webview::Color(0x12, 0x12, 0x12, 255))
                    .additional_browser_args(&browser_args)
                    .build()?;
            }

            #[cfg(desktop)]
            {
                use tauri::menu::{Menu, MenuItem};
                use tauri::tray::TrayIconBuilder;

                let show_item = MenuItem::with_id(app, "show", "Ouvrir", true, None::<&str>)?;
                let quit_item = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

                TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.unminimize();
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "quit" => app.exit(0),
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let tauri::tray::TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left,
                            button_state: tauri::tray::MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.unminimize();
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    })
                    .build(app)?;

                // Fermer la fenêtre (croix) masque l'app dans la barre des tâches système
                // au lieu de quitter — uniquement si l'utilisateur a activé ce réglage.
                if let Some(window) = app.get_webview_window("main") {
                    let app_handle = app.handle().clone();
                    window.on_window_event(move |event| {
                        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                            let state = app_handle.state::<AppState>();
                            let close_to_tray = *state.close_to_tray.lock().unwrap();
                            if close_to_tray {
                                api.prevent_close();
                                if let Some(w) = app_handle.get_webview_window("main") {
                                    let _ = w.hide();
                                }
                            }
                        }
                    });
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
