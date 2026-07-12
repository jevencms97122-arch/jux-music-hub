/**
 * Reconnaissance vocale locale (Vosk/WASM) — utilisée UNIQUEMENT dans l'app
 * Electron, où le moteur intégré du navigateur (webkitSpeechRecognition)
 * échoue systématiquement avec une erreur "network" : le service de
 * reconnaissance de Google auquel il envoie l'audio n'est disponible que
 * pour les builds officiels de Chrome, pas pour Electron. Vosk tourne
 * entièrement en local (WASM), donc il fonctionne indépendamment de ça.
 *
 * Le modèle (~40 Mo) doit être hébergé sur notre propre serveur — voir
 * VITE_VOSK_MODEL_URL. Il est chargé une seule fois (mis en cache en mémoire
 * pour la durée de vie de l'onglet/fenêtre) et réutilisé à chaque activation
 * de l'assistant.
 */

type VoskModel = import('vosk-browser').Model;
type VoskRecognizer = import('vosk-browser').KaldiRecognizer;

const DEFAULT_MODEL_PATH = '/vosk/vosk-model-small-fr-0.22.tar.gz';

function getModelUrl(): string {
  const configured = (import.meta as any).env?.VITE_VOSK_MODEL_URL;
  const url = configured || (() => {
    // Par défaut, on va chercher le modèle sur le même serveur média que le
    // reste des assets (voir src/lib/mediaServer.ts) — à héberger manuellement.
    const base = (import.meta as any).env?.VITE_MEDIA_BASE_URL || '';
    return `${base.replace(/\/+$/, '')}${DEFAULT_MODEL_PATH}`;
  })();

  // Piège classique : si VITE_MEDIA_BASE_URL/VITE_VOSK_MODEL_URL n'est pas
  // configuré, l'URL retombe sur un simple chemin relatif ("/vosk/...").
  // Le fetch va alors taper sur l'app elle-même (son propre HTML via le
  // fallback SPA) au lieu d'un vrai serveur, et Vosk essaiera de décompresser
  // cette page comme si c'était le modèle → "Unrecognized archive format"
  // trompeur qui n'a rien à voir avec le contenu réel du fichier .tar.gz.
  if (!/^https?:\/\//i.test(url)) {
    console.warn(
      `[VoskEngine] URL de modèle relative détectée ("${url}") — configure VITE_VOSK_MODEL_URL ou ` +
      `VITE_MEDIA_BASE_URL dans .env avec une URL ABSOLUE (http:// ou https://) pointant vers un vrai ` +
      `serveur où le .tar.gz est hébergé. Sans ça, l'app va se fetcher elle-même et échouer.`
    );
  }
  return url;
}

let modelPromise: Promise<VoskModel> | null = null;

const MODEL_LOAD_TIMEOUT_MS = 45000;

/**
 * Charge (une seule fois, mis en cache) le modèle de reconnaissance français.
 *
 * NE PAS utiliser createModel() de vosk-browser directement : sa promesse ne
 * se résout qu'en écoutant l'événement "load" et ignore complètement
 * l'événement "error" — si le modèle est mal formé (ex. mauvais format
 * d'archive), elle ne rejette jamais et reste bloquée indéfiniment sans
 * aucun signal exploitable. On construit le Model nous-mêmes pour pouvoir
 * écouter "error" et ajouter un timeout.
 */
function loadModel(): Promise<VoskModel> {
  if (modelPromise) return modelPromise;
  const url = getModelUrl();
  console.log('[VoskEngine] Chargement du modèle depuis', url, '(~40 Mo, peut prendre un moment la première fois)');

  modelPromise = import('vosk-browser').then(({ Model }) => {
    return new Promise<VoskModel>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error(`Timeout : le modèle n'a pas fini de charger après ${MODEL_LOAD_TIMEOUT_MS / 1000}s`));
      }, MODEL_LOAD_TIMEOUT_MS);

      const model = new (Model as any)(url) as VoskModel;
      (model as any).on('load', (message: any) => {
        window.clearTimeout(timeout);
        if (message?.result) resolve(model);
        else reject(new Error('Le modèle a échoué à charger (résultat négatif)'));
      });
      (model as any).on('error', (message: any) => {
        window.clearTimeout(timeout);
        reject(new Error(`Erreur de chargement du modèle : ${message?.error ?? 'inconnue'}. Vérifie que le fichier hébergé à ${url} est bien un .tar.gz au format attendu par vosk-browser (pas le .zip standard de alphacephei.com).`));
      });
    });
  })
    .then((model) => {
      console.log('[VoskEngine] Modèle chargé');
      return model;
    })
    .catch((err) => {
      modelPromise = null; // permet de retenter plus tard
      console.error('[VoskEngine] Échec du chargement du modèle —', url, err);
      throw err;
    });
  return modelPromise;
}

export interface VoskSession {
  stop: () => void;
}

/**
 * Démarre une session de reconnaissance en continu sur le flux micro fourni.
 * onText est appelé avec le texte final de chaque énoncé détecté (équivalent
 * d'un résultat "isFinal" côté webkitSpeechRecognition).
 */
export async function startVoskSession(
  stream: MediaStream,
  onText: (text: string) => void,
  onError: (err: unknown) => void,
  onPartial?: (text: string) => void,
): Promise<VoskSession> {
  const model = await loadModel();

  const audioCtx = new AudioContext();
  const sampleRate = audioCtx.sampleRate;
  const recognizer: VoskRecognizer = new (model as any).KaldiRecognizer(sampleRate);
  recognizer.setWords(false);

  recognizer.on('result', (message: any) => {
    const text = message?.result?.text?.trim();
    if (text) onText(text);
  });
  if (onPartial) {
    recognizer.on('partialresult', (message: any) => {
      const text = message?.result?.partial?.trim();
      if (text) onPartial(text);
    });
  }
  recognizer.on('error', (message: any) => {
    onError(message?.error ?? message);
  });

  const source = audioCtx.createMediaStreamSource(stream);
  // ScriptProcessorNode est déprécié mais reste le moyen le plus simple
  // d'obtenir des échantillons bruts sans ajouter un fichier worklet séparé.
  const processor = audioCtx.createScriptProcessor(4096, 1, 1);
  // Gain à 0 : le processor doit être relié à la destination pour tourner de
  // façon fiable dans Chromium/Electron, mais on ne veut surtout pas
  // renvoyer le micro brut vers les haut-parleurs (retour/écho).
  const silentGain = audioCtx.createGain();
  silentGain.gain.value = 0;

  processor.onaudioprocess = (event) => {
    try {
      const input = event.inputBuffer.getChannelData(0);
      recognizer.acceptWaveformFloat(input, sampleRate);
    } catch (err) {
      onError(err);
    }
  };

  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(audioCtx.destination);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try { processor.disconnect(); } catch {}
    try { source.disconnect(); } catch {}
    try { silentGain.disconnect(); } catch {}
    try { recognizer.remove(); } catch {}
    audioCtx.close().catch(() => {});
  };

  return { stop };
}
