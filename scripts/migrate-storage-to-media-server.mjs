#!/usr/bin/env node
/**
 * Migration : déplace tous les fichiers stockés dans Supabase Storage
 * (buckets `songs`, `covers`, `avatars`) vers le serveur média externe
 * (PocketBase ou tout endpoint compatible), puis met à jour les colonnes
 * `songs.audio_url`, `songs.cover_url`, `profiles.avatar_url` avec
 * l'URL HTTPS complète du nouveau serveur.
 *
 * USAGE
 *   SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   MEDIA_BASE_URL=https://pb.tondomaine.com \
 *   MEDIA_COLLECTION=media \
 *   node scripts/migrate-storage-to-media-server.mjs [--delete-source] [--dry-run]
 *
 * - --dry-run        : n'écrit rien, montre juste ce qui serait fait
 * - --delete-source  : supprime le fichier Supabase Storage après migration OK
 *
 * Idempotent : si une URL est déjà une URL http(s), elle est ignorée.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MEDIA_BASE_URL = (process.env.MEDIA_BASE_URL || '').replace(/\/+$/, '');
const COLLECTION = process.env.MEDIA_COLLECTION || 'media';
const DRY = process.argv.includes('--dry-run');
const DELETE_SOURCE = process.argv.includes('--delete-source');

if (!SUPABASE_URL || !SERVICE_KEY || !MEDIA_BASE_URL) {
  console.error('❌ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY et MEDIA_BASE_URL requis');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

async function uploadToMediaServer(kind, ownerId, filename, blob) {
  const form = new FormData();
  form.append('file', blob, filename);
  form.append('kind', kind);
  form.append('owner_id', ownerId || 'migration');
  const res = await fetch(`${MEDIA_BASE_URL}/api/collections/${COLLECTION}/records`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`Upload [${res.status}]: ${await res.text()}`);
  const rec = await res.json();
  return `${MEDIA_BASE_URL}/api/files/${COLLECTION}/${rec.id}/${rec.file}`;
}

async function migrateOne({ bucket, kind, path, ownerId }) {
  if (!path || path.startsWith('http')) return null; // déjà migré
  console.log(`→ ${bucket}/${path}`);
  if (DRY) return 'DRY_RUN_URL';
  const { data, error } = await sb.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`Download ${bucket}/${path}: ${error?.message}`);
  const filename = path.split('/').pop() || 'file.bin';
  const url = await uploadToMediaServer(kind, ownerId, filename, data);
  if (DELETE_SOURCE) {
    await sb.storage.from(bucket).remove([path]).catch((e) => console.warn('   ⚠ delete:', e.message));
  }
  return url;
}

async function migrateSongs() {
  const { data: songs, error } = await sb
    .from('songs')
    .select('id, uploaded_by, audio_url, cover_url')
    .limit(10000);
  if (error) throw error;
  console.log(`\n🎵 ${songs.length} songs`);
  for (const s of songs) {
    try {
      const updates = {};
      const a = await migrateOne({ bucket: 'songs', kind: 'audio', path: s.audio_url, ownerId: s.uploaded_by });
      if (a) updates.audio_url = a;
      const c = await migrateOne({ bucket: 'covers', kind: 'cover', path: s.cover_url, ownerId: s.uploaded_by });
      if (c) updates.cover_url = c;
      if (Object.keys(updates).length && !DRY) {
        const { error: upErr } = await sb.from('songs').update(updates).eq('id', s.id);
        if (upErr) throw upErr;
      }
    } catch (e) {
      console.error(`  ✗ song ${s.id}:`, e.message);
    }
  }
}

async function migrateAvatars() {
  const { data: profiles, error } = await sb
    .from('profiles')
    .select('id, user_id, avatar_url')
    .not('avatar_url', 'is', null)
    .limit(10000);
  if (error) throw error;
  console.log(`\n👤 ${profiles.length} avatars`);
  for (const p of profiles) {
    try {
      const url = await migrateOne({ bucket: 'avatars', kind: 'avatar', path: p.avatar_url, ownerId: p.user_id });
      if (url && !DRY) {
        const { error: upErr } = await sb.from('profiles').update({ avatar_url: url }).eq('id', p.id);
        if (upErr) throw upErr;
      }
    } catch (e) {
      console.error(`  ✗ profile ${p.id}:`, e.message);
    }
  }
}

(async () => {
  console.log(`Cible: ${MEDIA_BASE_URL}/api/collections/${COLLECTION}`);
  console.log(`Mode : ${DRY ? 'DRY-RUN' : DELETE_SOURCE ? 'MIGRATE + DELETE SOURCE' : 'MIGRATE (keep source)'}\n`);
  await migrateSongs();
  await migrateAvatars();
  console.log('\n✅ Terminé');
})().catch((e) => { console.error(e); process.exit(1); });
