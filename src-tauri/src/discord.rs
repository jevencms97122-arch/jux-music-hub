//! Discord Rich Presence : équivalent Rust du bridge IPC qu'exposait
//! auparavant `electron/main.cjs` via le module Node `discord-rpc`.
//! Tourne dans un thread dédié pour ne pas bloquer l'event loop Tauri ;
//! reconnexion automatique toutes les 15s, comme côté Electron.

use discord_rich_presence::{
    activity::{self, ActivityType},
    DiscordIpc, DiscordIpcClient,
};
use std::sync::mpsc::{channel, Receiver, RecvTimeoutError, Sender};
use std::thread;
use std::time::{Duration, Instant};

const DISCORD_CLIENT_ID: &str = "1501360327122620548";
// Délai avant de retenter une connexion IPC (Discord pas encore lancé, ou pipe
// momentanément indisponible). Volontairement court : chaque seconde sans
// présence active est une seconde pendant laquelle Discord peut basculer sur
// sa détection automatique de jeu ("Playing nexora-music.exe") à la place de
// notre présence "Listening to Jux Music".
const RECONNECT_DELAY: Duration = Duration::from_secs(3);
// Discord n'autorise qu'une mise à jour de présence toutes les ~15s ; au-delà
// les appels sont silencieusement rejetés. On respecte cette limite nous-mêmes
// pour ne jamais s'y heurter (sinon la reconnexion qui s'ensuivait bloquait
// toute mise à jour pendant 15s de plus, ce qui donnait l'impression que le
// changement de musique ne faisait plus rien).
const MIN_UPDATE_INTERVAL: Duration = Duration::from_secs(15);

#[derive(Clone)]
pub struct PresenceData {
    pub title: String,
    pub author: String,
    pub cover_url: String,
    pub is_playing: bool,
    pub start_timestamp: Option<i64>,
    /// Durée du morceau en secondes — sert à calculer `timestamps.end` pour
    /// afficher la barre de progression façon Spotify.
    pub duration_secs: Option<f64>,
}

enum DiscordCmd {
    Update(PresenceData),
    Clear,
}

#[derive(Clone)]
enum Desired {
    Update(PresenceData),
    Clear,
}

#[derive(Clone)]
pub struct DiscordHandle {
    tx: Sender<DiscordCmd>,
}

impl DiscordHandle {
    pub fn update(&self, data: PresenceData) {
        let _ = self.tx.send(DiscordCmd::Update(data));
    }

    pub fn clear(&self) {
        let _ = self.tx.send(DiscordCmd::Clear);
    }
}

pub fn spawn() -> DiscordHandle {
    let (tx, rx) = channel::<DiscordCmd>();
    thread::spawn(move || run(rx));
    DiscordHandle { tx }
}

fn truncate(s: &str, max: usize) -> &str {
    match s.char_indices().nth(max) {
        None => s,
        Some((idx, _)) => &s[..idx],
    }
}

fn apply(client: &mut DiscordIpcClient, data: &PresenceData) -> Result<(), Box<dyn std::error::Error>> {
    let title = if data.title.is_empty() { "Sans titre" } else { &data.title };
    let author = if data.author.is_empty() { "Artiste inconnu" } else { &data.author };
    let state = truncate(&format!("par {author}"), 128).to_string();
    let details = truncate(title, 128);
    let large_image = if data.cover_url.is_empty() { "jux_logo" } else { &data.cover_url };
    let small_image = if data.is_playing { "play" } else { "pause" };
    let small_text = if data.is_playing { "En lecture" } else { "En pause" };

    let assets = activity::Assets::new()
        .large_image(large_image)
        .large_text("Jux Music")
        .small_image(small_image)
        .small_text(small_text);

    let mut act = activity::Activity::new()
        .activity_type(ActivityType::Listening)
        .details(details)
        .state(&state)
        .assets(assets);

    if data.is_playing {
        if let Some(start) = data.start_timestamp {
            let mut timestamps = activity::Timestamps::new().start(start);
            // Barre de progression : nécessite `start` ET `end` ensemble.
            if let Some(duration) = data.duration_secs {
                if duration > 0.0 {
                    timestamps = timestamps.end(start + (duration * 1000.0) as i64);
                }
            }
            act = act.timestamps(timestamps);
        }
    }

    Ok(client.set_activity(act)?)
}

fn send(client: &mut DiscordIpcClient, desired: &Desired) -> Result<(), Box<dyn std::error::Error>> {
    match desired {
        Desired::Update(data) => apply(client, data),
        Desired::Clear => Ok(client.clear_activity()?),
    }
}

fn run(rx: Receiver<DiscordCmd>) {
    // Dernier état voulu mais pas encore appliqué (les états intermédiaires
    // reçus pendant le délai de rate-limit sont écrasés — seul le plus récent
    // compte, comme le ferait l'intégration officielle Spotify).
    let mut pending: Option<Desired> = None;
    let mut last_sent: Option<Instant> = None;

    loop {
        let mut client = DiscordIpcClient::new(DISCORD_CLIENT_ID);
        if client.connect().is_err() {
            thread::sleep(RECONNECT_DELAY);
            continue;
        }

        // Réappliquer immédiatement le dernier état voulu après une (re)connexion —
        // sinon Discord reste sans présence (et peut retomber sur la détection de
        // jeu) jusqu'au prochain changement de musique, ce qui peut prendre longtemps.
        if let Some(desired) = pending.clone() {
            if send(&mut client, &desired).is_ok() {
                last_sent = Some(Instant::now());
                pending = None;
            }
        }

        let mut connected = true;
        while connected {
            match rx.recv_timeout(Duration::from_millis(250)) {
                Ok(DiscordCmd::Update(data)) => pending = Some(Desired::Update(data)),
                Ok(DiscordCmd::Clear) => pending = Some(Desired::Clear),
                Err(RecvTimeoutError::Timeout) => {}
                Err(RecvTimeoutError::Disconnected) => return,
            }

            let ready = last_sent.is_none_or(|t| t.elapsed() >= MIN_UPDATE_INTERVAL);
            if ready {
                if let Some(desired) = pending.clone() {
                    if send(&mut client, &desired).is_ok() {
                        last_sent = Some(Instant::now());
                        pending = None;
                    } else {
                        connected = false;
                    }
                }
            }
        }

        let _ = client.close();
        thread::sleep(RECONNECT_DELAY);
    }
}
