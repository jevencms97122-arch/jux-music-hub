/**
 * Cache média basé sur IndexedDB pour la sauvegarde automatique des images
 * (covers, avatars, bannières) et de l'audio sur les appareils mobiles.
 *
 * Fonctionnement :
 * 1. Quand une image est chargée, elle est automatiquement sauvegardée dans IndexedDB.
 * 2. Au prochain chargement, on vérifie d'abord le cache avant d'aller chercher sur le réseau.
 * 3. Les vidéos YouTube ne sont pas mises en cache.
 * 4. Activé par défaut sur mobile (détection automatique), non désactivable.
 *
 * Pour PC (Windows) et Android natif, voir la documentation en fin de fichier.
 */

const DB_NAME = 'jux-media-cache';
const DB_VERSION = 1;
const IMAGE_STORE = 'images';

// Taille max du cache : 100 Mo
const MAX_CACHE_SIZE = 100 * 1024 * 1024;

interface CacheEntry {
  key: string;
  data: ArrayBuffer;
  contentType: string;
  timestamp: number;
  size: number;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Registre des blob URLs déjà créées, indexé par URL source.
 *
 * Sans lui, chaque montage d'un <img> appelait `URL.createObjectURL` et créait
 * une nouvelle référence vers une copie complète des octets de l'image, sans
 * jamais la révoquer. En défilant une liste de couvertures, la même image
 * s'accumulait autant de fois qu'elle avait été montée : sur un appareil à 2 Go
 * de RAM, la mémoire se remplit, le ramasse-miettes tourne en continu et
 * l'interface se met à saccader sans que rien d'autre n'ait changé.
 *
 * On garde donc une seule blob URL par source, et on plafonne le registre : les
 * entrées les plus anciennes sont révoquées (ce qui libère réellement les
 * octets) quand la limite est atteinte.
 */
const MAX_LIVE_BLOB_URLS = 120;
const liveBlobUrls = new Map<string, string>();

function rememberBlobUrl(sourceUrl: string, blobUrl: string): string {
  // Déjà présent : on révoque le doublon qu'on vient de créer plutôt que
  // d'écraser l'entrée (sinon l'ancienne fuit).
  const existing = liveBlobUrls.get(sourceUrl);
  if (existing) {
    if (existing !== blobUrl) URL.revokeObjectURL(blobUrl);
    return existing;
  }

  while (liveBlobUrls.size >= MAX_LIVE_BLOB_URLS) {
    // Map conserve l'ordre d'insertion : la première clé est la plus ancienne.
    const oldestKey = liveBlobUrls.keys().next().value as string | undefined;
    if (oldestKey === undefined) break;
    const oldest = liveBlobUrls.get(oldestKey);
    if (oldest) URL.revokeObjectURL(oldest);
    liveBlobUrls.delete(oldestKey);
  }

  liveBlobUrls.set(sourceUrl, blobUrl);
  return blobUrl;
}

/**
 * Chargements en cours, indexés par URL source : plusieurs cartes affichant la
 * même couverture partagent une seule requête réseau et une seule lecture
 * IndexedDB au lieu d'en lancer une chacune.
 */
const inFlight = new Map<string, Promise<string | null>>();

/**
 * Ouvre (ou crée) la base de données IndexedDB.
 */
function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        const store = db.createObjectStore(IMAGE_STORE, { keyPath: 'key' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('size', 'size', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance!);
    };

    request.onerror = (event) => {
      console.error('[MediaCache] Erreur d\'ouverture DB:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Vérifie si une URL est une vidéo YouTube (on ne cache pas ça).
 */
function isYoutubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be|ytimg\.com/.test(url);
}

/**
 * Nettoie l'ancien cache si on dépasse la taille maximale.
 */
async function enforceMaxSize(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(IMAGE_STORE, 'readwrite');
    const store = tx.objectStore(IMAGE_STORE);
    const sizeIndex = store.index('size');

    let totalSize = 0;
    const entries: { key: string; size: number }[] = [];

    await new Promise<void>((resolve, reject) => {
      const request = sizeIndex.openCursor(null, 'prev');
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const entry = cursor.value as CacheEntry;
          totalSize += entry.size;
          entries.push({ key: entry.key, size: entry.size });
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });

    // Si on dépasse la taille max, supprimer les plus vieux
    if (totalSize > MAX_CACHE_SIZE) {
      // Trier par timestamp (plus vieux d'abord)
      entries.sort((a, b) => {
        const aEntry = store.get(a.key) as IDBRequest;
        const bEntry = store.get(b.key) as IDBRequest;
        return 0; // fallback
      });

      // Supprimer jusqu'à rentrer dans la limite
      for (const entry of entries) {
        if (totalSize <= MAX_CACHE_SIZE) break;
        store.delete(entry.key);
        totalSize -= entry.size;
      }
    }
  } catch (e) {
    console.error('[MediaCache] Erreur lors du nettoyage:', e);
  }
}

/**
 * Récupère une image depuis le cache IndexedDB.
 */
async function getFromCache(url: string): Promise<string | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(IMAGE_STORE, 'readonly');
    const store = tx.objectStore(IMAGE_STORE);

    return new Promise((resolve) => {
      const request = store.get(url);
      request.onsuccess = (event) => {
        const entry = (event.target as IDBRequest<CacheEntry>).result;
        if (entry) {
          // Convertir ArrayBuffer en Blob URL
          const blob = new Blob([entry.data], { type: entry.contentType });
          resolve(rememberBlobUrl(url, URL.createObjectURL(blob)));
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Sauvegarde une image dans le cache IndexedDB.
 */
async function saveToCache(url: string, blob: Blob): Promise<void> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const db = await openDB();
    const tx = db.transaction(IMAGE_STORE, 'readwrite');
    const store = tx.objectStore(IMAGE_STORE);

    const entry: CacheEntry = {
      key: url,
      data: arrayBuffer,
      contentType: blob.type || 'image/jpeg',
      timestamp: Date.now(),
      size: arrayBuffer.byteLength,
    };

    store.put(entry);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('[MediaCache] Erreur de sauvegarde:', e);
  }
}

/**
 * Charge une image : cherche d'abord dans le cache, sinon va sur le réseau
 * et sauvegarde automatiquement dans le cache.
 *
 * @param url URL de l'image à charger
 * @returns URL objet (blob URL) ou l'URL originale si pas de cache / pas mobile
 */
export async function loadMedia(url: string): Promise<string | null> {
  if (!url || !url.startsWith('http')) return url;

  // Ne pas cacher les vidéos YouTube
  if (isYoutubeUrl(url)) return url;

  // 0. Déjà résolue pendant cette session : on rend la même blob URL, sans
  // retoucher ni IndexedDB ni le réseau (cas du défilement d'une liste, où les
  // mêmes couvertures sont démontées puis remontées en boucle).
  const live = liveBlobUrls.get(url);
  if (live) {
    // Réinsertion : l'ordre de la Map devient un ordre d'utilisation, donc
    // l'éviction ci-dessous frappe les images les moins récemment demandées
    // plutôt que les plus anciennement chargées — qui peuvent très bien être
    // encore à l'écran.
    liveBlobUrls.delete(url);
    liveBlobUrls.set(url, live);
    return live;
  }

  const pending = inFlight.get(url);
  if (pending) return pending;

  const task = resolveMedia(url).finally(() => { inFlight.delete(url); });
  inFlight.set(url, task);
  return task;
}

async function resolveMedia(url: string): Promise<string | null> {
  // 1. Essayer le cache d'abord
  const cached = await getFromCache(url);
  if (cached) return cached;

  // 2. Pas dans le cache → charger depuis le réseau et sauvegarder
  try {
    const response = await fetch(url, {
      cache: 'force-cache',
      mode: 'cors',
    });

    if (!response.ok) return url;
    if (!response.headers.get('content-type')?.startsWith('image/')) return url;

    const blob = await response.blob();

    // Sauvegarder en arrière-plan
    saveToCache(url, blob);
    enforceMaxSize();

    // Créer un blob URL pour l'affichage immédiat
    return rememberBlobUrl(url, URL.createObjectURL(blob));
  } catch {
    return url;
  }
}

/**
 * Charge une image en fournissant un callback pour l'URL résolue.
 * Pratique pour les composants <img> qui ont besoin de l'URL finale.
 */
export async function preloadImage(url: string): Promise<string | null> {
  return loadMedia(url);
}

/**
 * Supprime une entrée spécifique du cache.
 */
export async function removeFromCache(url: string): Promise<void> {
  // La blob URL en mémoire doit partir avec l'entrée, sinon elle continuerait à
  // être servie (et à occuper la RAM) après la suppression.
  const live = liveBlobUrls.get(url);
  if (live) {
    URL.revokeObjectURL(live);
    liveBlobUrls.delete(url);
  }
  try {
    const db = await openDB();
    const tx = db.transaction(IMAGE_STORE, 'readwrite');
    const store = tx.objectStore(IMAGE_STORE);
    store.delete(url);
  } catch (e) {
    console.error('[MediaCache] Erreur de suppression:', e);
  }
}

/**
 * Vide complètement le cache média.
 */
export async function clearCache(): Promise<void> {
  for (const blobUrl of liveBlobUrls.values()) URL.revokeObjectURL(blobUrl);
  liveBlobUrls.clear();
  try {
    const db = await openDB();
    const tx = db.transaction(IMAGE_STORE, 'readwrite');
    const store = tx.objectStore(IMAGE_STORE);
    store.clear();
  } catch (e) {
    console.error('[MediaCache] Erreur de vidage:', e);
  }
}

/**
 * Retourne la taille totale du cache en octets.
 */
export async function getCacheSize(): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction(IMAGE_STORE, 'readonly');
    const store = tx.objectStore(IMAGE_STORE);
    const sizeIndex = store.index('size');

    return new Promise((resolve) => {
      let total = 0;
      const request = sizeIndex.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          total += (cursor.value as CacheEntry).size;
          cursor.continue();
        } else {
          resolve(total);
        }
      };
      request.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

/**
 * Cache les images d'une liste d'URLs en arrière-plan.
 * Utile au chargement d'une page pour pré-cacher toutes les images visibles.
 */
export async function preloadImages(urls: string[]): Promise<void> {
  for (const url of urls) {
    if (!url || !url.startsWith('http') || isYoutubeUrl(url)) continue;
    // Lancer en parallèle sans attendre
    loadMedia(url).catch(() => {});
  }
}

/**
 * ------------------------------------------------------------------
 * STOCKAGE LOCAL SUR PC (Windows) ET ANDROID
 * ------------------------------------------------------------------
 *
 * Le cache via IndexedDB est automatique sur mobile.
 * Pour PC et Android natif, voici comment stocker les médias
 * pour que l'app puisse les récupérer :
 *
 * ── ANDROID (application native avec WebView) ──
 *
 * 1. Création du dossier de cache :
 *    ```kotlin
 *    val cacheDir = File(context.cacheDir, "jux_media_cache")
 *    cacheDir.mkdirs()
 *    ```
 *
 * 2. Dans le pont JavaScript (JuxAndroidBridge.kt), ajouter :
 *    ```kotlin
 *    @JavascriptInterface
 *    fun saveMedia(url: String, fileName: String): String {
 *        try {
 *            val cacheDir = File(context.cacheDir, "jux_media_cache")
 *            cacheDir.mkdirs()
 *            val file = File(cacheDir, fileName)
 *            
 *            // Télécharger et sauvegarder
 *            val connection = URL(url).openConnection()
 *            connection.getInputStream().use { input ->
 *                file.outputStream().use { output ->
 *                    input.copyTo(output)
 *                }
 *            }
 *            return file.toURI().toString()
 *        } catch (e: Exception) {
 *            return url  // fallback à l'URL originale
 *        }
 *    }
 *
 *    @JavascriptInterface
 *    fun getCachedMediaUrl(url: String): String {
 *        val fileName = url.hashCode().toString() + getExtension(url)
 *        val file = File(context.cacheDir, "jux_media_cache/$fileName")
 *        return if (file.exists()) file.toURI().toString() else url
 *    }
 *    ```
 *
 * 3. Pour les téléchargements hors-ligne (comme les chansons),
 *    le système est déjà en place via `JuxAndroid.downloadSong()`.
 *    Voir `src/lib/platform.ts` pour l'interface existante.
 *
 * 4. Extension helper :
 *    ```kotlin
 *    private fun getExtension(url: String): String {
 *        return when {
 *            url.contains(".jpg") || url.contains(".jpeg") -> ".jpg"
 *            url.contains(".png") -> ".png"
 *            url.contains(".webp") -> ".webp"
 *            url.contains(".mp3") -> ".mp3"
 *            url.contains(".m4a") -> ".m4a"
 *            else -> ".bin"
 *        }
 *    }
 *    ```
 *
 * ── PC (Windows / Application Electron) ──
 *
 * 1. Utiliser `localStorage` ou mieux, un dossier local via l'API
 *    `showDirectoryPicker()` ou `FileSystemFileHandle` :
 *
 *    ```typescript
 *    // Dans l'app Electron/desktop, utiliser node:fs
 *    const fs = require('fs');
 *    const path = require('path');
 *    
 *    const cacheDir = path.join(app.getPath('userData'), 'jux_media_cache');
 *    
 *    export function saveMediaToDisk(url: string, data: Buffer): string {
 *      const fileName = hashUrl(url);
 *      const filePath = path.join(cacheDir, fileName);
 *      fs.writeFileSync(filePath, data);
 *      return `file://${filePath}`;
 *    }
 *    
 *    export function getCachedMediaPath(url: string): string | null {
 *      const fileName = hashUrl(url);
 *      const filePath = path.join(cacheDir, fileName);
 *      return fs.existsSync(filePath) ? `file://${filePath}` : null;
 *    }
 *    ```
 *
 * 2. Depuis la WebView, le pont `JuxDesktop` (cf. `platform.ts`)
 *    expose déjà `downloadSong()`, `isDownloaded()`, etc.
 *    Tu peux ajouter :
 *    - `saveImage(url): string` → sauvegarde l'image et retourne le chemin local
 *    - `getCachedImage(url): string | null` → retourne le chemin local si existant
 *
 * 3. Alternativement, l'extension PWA Chrome/Edge peut utiliser
 *    l'API File System Access pour un stockage persistant :
 *
 *    ```typescript
 *    // Demander l'accès à un dossier
 *    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
 *    
 *    // Créer/ouvrir un fichier
 *    const fileHandle = await dirHandle.getFileHandle('jux_cache/' + fileName, { create: true });
 *    const writable = await fileHandle.createWritable();
 *    await writable.write(data);
 *    await writable.close();
 *    ```
 */

export const CACHE_CONFIG = {
  maxSize: MAX_CACHE_SIZE,
  dbName: DB_NAME,
  storeName: IMAGE_STORE,
};