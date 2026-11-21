# Plan: BLUE button toggles subtitles; Audio-Only moves to YELLOW

## Context

You want the BLUE remote button to show or hide subtitles on the video that's playing. BLUE currently toggles upstream's Audio-Only mode. As you decided, Audio-Only moves to YELLOW, which this app doesn't use yet.

No subtitle code exists in the repo or its history (upstream PR #305 `force-video-and-subs` only shipped the quality part), so the caption logic is new.

All key handling lives in one capture-phase handler in [src/ui.js](src/ui.js) (`eventHandler`, ~line 191). It intercepts color keys before YouTube sees them, so YouTube's own behavior can't clash with the new bindings.

## Design

### 1. New fork-only module `src/subtitles.ts`

Putting the code in a new file means upstream rebases never conflict on it.

- It exports `toggleSubtitles(): string`. The function is synchronous and returns the toast text. `ui.js` shows the toast itself, which avoids a `subtitles.ts` → `ui.js` import cycle.
- **Finding the player:**
  - It uses `document.querySelector('.html5-video-player')`, not `getPlayer()` from [src/player_api/helpers.ts](src/player_api/helpers.ts). `getPlayer()` waits forever if no player exists yet, so a key press would give no feedback.
  - Type: a local `interface CaptionsPlayer extends YTPlayer`, with the caption methods marked optional. `YTPlayer` comes from [src/player_api/yt-api.ts](src/player_api/yt-api.ts). Declaring the type locally leaves that upstream file untouched.
- **"Is a video active?" check.** Return `'Subtitles: no video playing'` unless all of these hold:
  - the body has class `WEB_PAGE_TYPE_WATCH` or `WEB_PAGE_TYPE_SHORTS` (same check style as `isWatchPage()` in [src/screensaver-fix.ts](src/screensaver-fix.ts));
  - `!player.isInline()`, which excludes home-page previews;
  - `player.getVideoData().video_id` is set.
- **Toggling.** The TV player's caption API is undocumented and I can't probe it without your TV, so the code tries known player internals in order and logs which path it took (`console.debug('[subtitles] ...')`):
  1. If the player has `isSubtitlesOn()` + `toggleSubtitles()`, read the state, toggle, and report the opposite of the old state.
  2. Otherwise use `getOption('captions', 'track')` / `getOption('captions', 'tracklist')` / `setOption('captions', 'track', …)`:
     - A track with a `languageCode` is active → set `{}` to turn it off.
     - Nothing is active → pick a track: the one whose language matches the UI language (`navigator.language` prefix), preferring human-made over auto-generated (`kind !== 'asr'`); else the first human-made track; else the first track.
     - An empty tracklist → `loadModule('captions')` if available (this turns captions on with YouTube's default track).
  3. Nothing worked → `'No subtitles available'`.
- **Toast text:** `Subtitles: On (<languageName>)` when the name is known, `Subtitles: On`, or `Subtitles: Off`.
- YouTube may remember the on/off choice for the next videos. That's YouTube's own behavior, and I won't override it.
- No top-level `await` and no config option: the button just works, like GREEN.

### 2. Edit [src/ui.js](src/ui.js)

Each change gets a `//bvb-tv:` tag, per the fork convention.

- `import { toggleSubtitles } from './subtitles';`
- In `eventHandler`:
  - The `'blue'` branch calls `showNotification(toggleSubtitles(), 2000, 'blue')` on keydown.
  - A new `'yellow'` branch takes over `initAudioOnlyToggle()`.
  - Both keep the current pattern: `preventDefault` + `stopPropagation` on every event type, and act only on `keydown`.
- In `initAudioOnlyToggle()`: the toast color becomes `'yellow'`, and the overlay text becomes `'Audio-Only Mode Enabled - Press [YELLOW] to toggle'`.

### 3. Docs

- [README.md](README.md) line 27: change to `Audio-Only Mode (🟨 Yellow button on remote)` and add a line `Subtitles on/off (🟦 Blue button on remote)`.
- [CLAUDE.md](CLAUDE.md): fix the GREEN/BLUE sentence in "Config and options panel", and add a fork-notes bullet saying BLUE = subtitles (`src/subtitles.ts`) and Audio-Only is on YELLOW.

## Verification

1. `pnpm run lint:all`, `pnpm run build`, `pnpm run test:compat` (the ES5 check matters for the new TS file), then `pnpm run package`.
2. If the TV is reachable, `pnpm run deploy`, then `pnpm run launch -- -p '{"contentTarget":"v=<video with subtitles>"}'`. You test on the TV:
   - BLUE → toast `Subtitles: On (…)` and captions appear; BLUE again → `Subtitles: Off`.
   - A video without subtitles → `No subtitles available`. On the home page or a preview → `Subtitles: no video playing`.
   - YELLOW → Audio-Only toggles, the yellow toast shows, and the overlay says `[YELLOW]`. BLUE no longer touches Audio-Only.
   - GREEN still opens the settings panel.
3. If BLUE does nothing on a video, run `pnpm run inspect`, then read the `[subtitles]` debug lines and run:
   ```js
   p = document.querySelector('.html5-video-player');
   [
     'isSubtitlesOn',
     'toggleSubtitles',
     'getOption',
     'setOption',
     'loadModule',
     'unloadModule'
   ].map((k) => k + ': ' + typeof p[k]);
   ```
   That shows which caption API the TV player has, so I can trim the fallbacks to the one that works.
4. Commit as one commit, "BLUE toggles subtitles; move Audio-Only to YELLOW". The pre-commit hook runs.
5. Push normally: `git push bvb-origin feature/bvb-tv`. This is a plain fast-forward, since the remote is already at local `5f7ed2a` after your force push.

## Outcome

Implemented in `4b386d2` and tested on the TV (2018 LG, webOS 4). Probing the player changed the design:

- The player has no `toggleSubtitles()`. `toggleSubtitlesOn()` only switches subtitles on, so off uses `setOption('captions', 'track', {})`.
- No custom track picking: `toggleSubtitlesOn()` already chooses the UI-language track (Russian out of 64).
- An empty track list doesn't mean "no subtitles", because tracks load on demand. The code switches on, then checks `isSubtitlesOn()`.
- `loadModule('captions')` wasn't needed.

The scripts used for testing are in `tests/integration/`.
