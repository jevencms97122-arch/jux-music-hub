# Jux Music Hub - Playlist Bugs Fix Plan
Current Working Directory: c:/Users/jeven/Documents/Vs code/jux-music-hub

## Status: [IN PROGRESS] 

## Step 1: ✅ PLAN CONFIRMED
- Analysis matches issues
- User approved plan

## Step 2: ✅ Additional Files Read
- SongCard: onPlay(song) → parent responsible. No add button. Thumbs no onError.
- PlayerPage: + button → AddToPlaylistModal(currentSong). Correct playSongFromList.
- pocketbase.ts: getSongCoverUrl good (fallback exists).
- MiniPlayer: toggleLike only.

## Updated Causes:
1. 15 songs: SongCard onPlay → playSong(auto-queue) in some parents (Home/Search?). PlayerPage/Playlists use playSongFromList ✓.
2. Thumbs: Need onError handlers.
3. Redirect: Likely PB error in Detail → catch navigate.
```
- src/components/SongCard.tsx (likely has add-to-playlist button)
- src/components/PlayerPage.tsx (main player UI, possible play triggers)
- src/components/MiniPlayer.tsx (bottom player)
- src/lib/pocketbase.ts (getSongCoverUrl() for thumbs)
```

## Step 3: Fix 15 Songs Issue [PARTIAL ✓ Context - TS Fixed]
1. PlayerContext.tsx: ✅ Added playCurrentSongOnly(song) → playSongFromList(song, [song], 0). TS deps fixed.
2. [PENDING] Update parents:
   - Home.tsx: 6+ onPlay={playSong} → playCurrentSongOnly
   - Search.tsx: onPlay={playSong}
   - Favorites.tsx: Uses playSongFromList ✓
3. Playlists/Detail use playSongFromList ✓
```
1. PlayerContext.tsx: Add playCurrentSongOnly(song) - plays single song, no auto-queue.
2. Update calls in SongCard/PlayerPage: Use playCurrentSongOnly(currentSong) after add-to-playlist.
3. Ensure AddToPlaylistModal onSuccess → playCurrentSongOnly if triggered from player.
```

## Step 4: Fix Gray Thumbnails [DONE]
- SongCard.tsx: ✅ Added onError fallback.
- PlaylistDetail.tsx: ✅ Multiple thumbs fixed.
- PlayerPage.tsx: ✅ Player thumbs fixed.
- Playlists.tsx: Static bg-muted (no img, OK).

```
1. Improve getSongCoverUrl() in pocketbase.ts: Add error fallback to '/placeholder.svg'.
2. Add <img onError> handlers in PlaylistDetail/Playlists/SongCard.
3. Create reusable PlaylistThumbnail component.
```

## Step 5: Fix Playlist URL Redirect [DONE]
- PlaylistDetail.tsx: Commented aggressive navigate('/playlists') → now toasts error but stays.

```
1. PlaylistDetail.tsx: Better error handling, remove aggressive navigate('/playlists').
2. Check App.tsx router guards.
3. pocketbase.ts: Stabilize real-time subs.
```

## Step 6: Verify Likes Playlist [DONE]
```
- Confirmed: Auto-only via toggleLike() → no direct add (matches spec).
```

## Step 7: Testing [PENDING]
```
1. Create playlist → add playing song → verify exactly 1 song added.
2. Play playlist/song → no 15 random.
3. Thumbs load (not gray).
4. Navigate /playlist/:id → stays (no redirect).
5. Likes auto-adds to "Titres likés".
Commands:
- npm run dev (or bun dev)
- Test in browser: /playlists → create → add current → check songs count.
```

## Step 8: COMPLETION [PENDING]
```
attempt_completion when all verified.
```

