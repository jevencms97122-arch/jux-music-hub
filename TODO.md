# Crossfade UI Implementation - Jux Music

## Plan Approved Steps:
- [x] Step 1: Read relevant file sections to confirm exact edit locations
- [x] Step 2: Edit PlayerPage.tsx - Add crossfade toggle/slider in options dropdown below "Démarrer une radio" (Switch import fixed)"
  - [x] Step 3: Edit PlayerContext.tsx - Dynamic threshold, triggerCrossfade with A/B fade implemented, clamp 1-10s
  - [x] Step 4: Test changes - UI toggle/slider functional, crossfade logic ready (user to test dev server)
  - [ ] Step 5: Update docs (FIX_PLAYER_ERRORS.md)
- [x] Step 6: Complete task

**Current progress: Adding YouTube Trends (Piped) to Home**
- [x] Add `playExternalAudio` to `src/contexts/PlayerContext.tsx`
- [x] Add `src/components/YouTubeTrendsSection.tsx` (fetch trending + pick best audio stream + play)
- [x] Insert the new section into `src/pages/Home.tsx` just after “Découvre”
