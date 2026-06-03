/**
 * Script de configuration des collections PocketBase pour Jux Music.
 * 
 * Usage: node scripts/setup-pocketbase.js
 * 
 * Connecte le serveur PocketBase et crée toutes les collections
 * nécessaires avec leurs champs et règles d'accès.
 */

const PB_URL = process.env.VITE_PB_URL || 'http://188.115.125.74:8090';
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || 'julo.even97122@gmail.com';
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || 'D4RZCMVZPHQ3';

async function setup() {
  // Use fetch directly since we might not have pocketbase SDK installed locally
  const BASE = PB_URL.replace(/\/+$/, '');
  
  // Login as admin
  const loginRes = await fetch(`${BASE}/api/admins/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  
  if (!loginRes.ok) {
    const text = await loginRes.text();
    console.error('Login failed:', text);
    process.exit(1);
  }
  
  const { token } = await loginRes.json();
  const headers = { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}` 
  };

  const collections = [
    {
      name: 'profiles',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      schema: [
        { name: 'user_id', type: 'text', required: true },
        { name: 'pseudo', type: 'text' },
        { name: 'first_name', type: 'text' },
        { name: 'last_name', type: 'text' },
        { name: 'avatar', type: 'file', options: { maxSelect: 1, maxSize: 5242880 } },
        { name: 'bio', type: 'text' },
        { name: 'profile_completed', type: 'bool' },
      ]
    },
    {
      name: 'songs',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      schema: [
        { name: 'title', type: 'text', required: true },
        { name: 'author', type: 'text', required: true },
        { name: 'audio_url', type: 'text' },
        { name: 'cover_url', type: 'text' },
        { name: 'video_url', type: 'text' },
        { name: 'genre', type: 'text' },
        { name: 'uploaded_by', type: 'text', required: true },
        { name: 'duration', type: 'number' },
        { name: 'play_count', type: 'number' },
        { name: 'weekly_play_count', type: 'number' },
        { name: 'likes_count', type: 'number' },
        { name: 'weekly_reset_at', type: 'text' },
        { name: 'youtube_id', type: 'text' },
      ]
    },
    {
      name: 'playlists',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      schema: [
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'is_public', type: 'bool' },
        { name: 'owner_id', type: 'text', required: true },
        { name: 'view_count', type: 'number' },
        { name: 'play_count', type: 'number' },
        { name: 'likes_count', type: 'number' },
        { name: 'thumbnail_mode', type: 'text' },
      ]
    },
    {
      name: 'playlist_songs',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      schema: [
        { name: 'playlist_id', type: 'text', required: true },
        { name: 'song_id', type: 'text', required: true },
        { name: 'added_by', type: 'text', required: true },
        { name: 'position', type: 'number' },
      ]
    },
    {
      name: 'playlist_collaborators',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      schema: [
        { name: 'playlist_id', type: 'text', required: true },
        { name: 'user_id', type: 'text', required: true },
        { name: 'role', type: 'text' },
      ]
    },
    {
      name: 'playlist_likes',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      schema: [
        { name: 'playlist_id', type: 'text', required: true },
        { name: 'user_id', type: 'text', required: true },
      ]
    },
    {
      name: 'song_likes',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      schema: [
        { name: 'song_id', type: 'text', required: true },
        { name: 'user_id', type: 'text', required: true },
      ]
    },
    {
      name: 'song_comments',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      schema: [
        { name: 'song_id', type: 'text', required: true },
        { name: 'user_id', type: 'text', required: true },
        { name: 'content', type: 'text', required: true },
      ]
    },
    {
      name: 'listen_history',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      schema: [
        { name: 'user_id', type: 'text', required: true },
        { name: 'song_id', type: 'text', required: true },
        { name: 'listened_at', type: 'text' },
      ]
    },
    {
      name: 'user_stats',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      schema: [
        { name: 'user_id', type: 'text', required: true },
        { name: 'current_streak', type: 'number' },
        { name: 'longest_streak', type: 'number' },
        { name: 'total_listens', type: 'number' },
        { name: 'last_listen_date', type: 'text' },
      ]
    },
    {
      name: 'notifications',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      schema: [
        { name: 'recipient_id', type: 'text', required: true },
        { name: 'type', type: 'text', required: true },
        { name: 'title', type: 'text', required: true },
        { name: 'body', type: 'text' },
        { name: 'data', type: 'json' },
        { name: 'is_read', type: 'bool' },
      ]
    },
    {
      name: 'stories',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      schema: [
        { name: 'user_id', type: 'text', required: true },
        { name: 'song_id', type: 'text', required: true },
        { name: 'start_time', type: 'number' },
        { name: 'end_time', type: 'number' },
        { name: 'comment', type: 'text' },
        { name: 'expires_at', type: 'text' },
      ]
    },
    {
      name: 'story_views',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      schema: [
        { name: 'story_id', type: 'text', required: true },
        { name: 'viewer_id', type: 'text', required: true },
      ]
    },
    {
      name: 'user_presence',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      schema: [
        { name: 'user_id', type: 'text', required: true },
        { name: 'is_listening', type: 'bool' },
        { name: 'current_song_id', type: 'text' },
        { name: 'current_song_title', type: 'text' },
        { name: 'current_song_author', type: 'text' },
        { name: 'current_song_cover_url', type: 'text' },
        { name: 'last_seen_at', type: 'text' },
      ]
    },
    {
      name: 'follows',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      schema: [
        { name: 'follower_id', type: 'text', required: true },
        { name: 'following_id', type: 'text', required: true },
        { name: 'status', type: 'text' },
      ]
    },
    {
      name: 'listen_sessions',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      schema: [
        { name: 'host_id', type: 'text', required: true },
        { name: 'song_id', type: 'text' },
        { name: 'current_time_seconds', type: 'number' },
        { name: 'is_playing', type: 'bool' },
        { name: 'is_active', type: 'bool' },
        { name: 'participants', type: 'json' },
        { name: 'ready_participants', type: 'json' },
        { name: 'code', type: 'text' },
      ]
    },
    {
      name: 'app_versions',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      schema: [
        { name: 'last_version', type: 'number', required: true },
        { name: 'description', type: 'text' },
      ]
    },
    {
      name: 'media',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      schema: [
        { name: 'kind', type: 'text' },
        { name: 'owner_id', type: 'text' },
        { name: 'file', type: 'file', options: { maxSelect: 1, maxSize: 52428800 } },
      ]
    },
  ];

  for (const col of collections) {
    try {
      // Check if collection already exists
      const checkRes = await fetch(`${BASE}/api/collections?filter=name="${col.name}"`, { headers });
      const checkData = await checkRes.json();
      
      if (checkData?.items?.length > 0) {
        console.log(`Collection "${col.name}" already exists, skipping.`);
        continue;
      }
      
      const res = await fetch(`${BASE}/api/collections`, {
        method: 'POST',
        headers,
        body: JSON.stringify(col),
      });
      
      if (res.ok) {
        console.log(`✓ Created collection "${col.name}"`);
      } else {
        const err = await res.text();
        console.error(`✗ Failed to create "${col.name}":`, err);
      }
    } catch (e) {
      console.error(`✗ Error creating "${col.name}":`, e.message);
    }
  }
  
  console.log('\n✅ Setup completed!');
}

setup().catch(console.error);