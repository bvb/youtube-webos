# TV integration scripts

Manual test and debug scripts that drive the app on a real webOS TV through its
web inspector (DevTools protocol). They are not part of `lint:all`, the build or
CI, and nothing runs them automatically.

## Requirements

- TV in developer mode, configured with `pnpm exec ares-setup-device` (see the
  main README).
- The app installed and running: `pnpm run deploy`, then `pnpm run launch`. The
  inspector (port 9998) is only up while the app runs.
- Node >= 22 (uses the global `fetch` and `WebSocket`).
- `TV_INSPECT` set to the inspector address if it isn't `192.168.1.71:9998`.

## Scripts

| Script                    | What it does                                                  |
| ------------------------- | ------------------------------------------------------------- |
| `node eval.mjs <snippet>` | Runs a snippet file in the app's YouTube page, prints result  |
| `node eval.mjs -e '<js>'` | Same, for an inline expression                                |
| `node keys.mjs <key> ...` | Presses remote keys (`up down left right enter back`, colors) |
| `./press.sh <key>`        | Presses one key, then prints toasts and subtitle state        |
| `cdp.mjs`                 | Shared DevTools-protocol client used by the scripts above     |

Key presses are trusted protocol events, so they follow the real remote's path,
including YouTube's re-dispatch of color keys that `ui.js` listens for.

Snippets in `snippets/` run raw in the TV page without Babel. Keep them to
ES2015 (no optional chaining or `??`), which webOS 4 (2018) and newer support.

| Snippet                    | Prints                                                           |
| -------------------------- | ---------------------------------------------------------------- |
| `probe.js`                 | Device, page, the player's caption methods and caption state     |
| `status.js`                | Newest YTAF toasts, subtitle state, page type (used by press.sh) |
| `subtitles-state.js`       | Subtitles on/off, active track, rendered caption text            |
| `subtitles-off-then-on.js` | Calls the caption API directly: off, then YouTube's default on   |
| `audio-only.js`            | Audio-Only state (video visibility, hint) and subtitle state     |
| `key-logger.js`            | Installs a key event logger into `window.__keylog`               |

## Getting to a video

- `pnpm run launch -p '{"contentTarget":"v=VIDEO_ID"}'` opens a video. Don't
  add `--`: pnpm passes it on and `ares-launch` rejects it.
- The launch shows "Who's watching?". Use guest mode so tests don't land in an
  account's watch history: `node keys.mjs down` focuses "Войти как гость" (guest)
  on a Russian UI; check focus before `node keys.mjs enter`. Switching into guest
  mode restarts the app once.
- Setting `location.hash` to a watch URL also brings up the account selector.
- `player.loadVideoById('ID')` switches videos without navigating, but sometimes
  fails with `getVideoData().errorCode === 'auth'`. Check `probe.js` before
  trusting a result on such a video.

## Subtitles / Audio-Only checklist

With a video playing:

1. `./press.sh blue` on the home page: `Subtitles: no video playing`.
2. On a video with subtitles (e.g. `iG9CE55wbtY`), `./press.sh blue` twice:
   `Subtitles: Off` and `Subtitles: On (<language>)`, in either order. YouTube
   remembers the on/off choice between videos. `node eval.mjs snippets/subtitles-state.js`
   should show caption text within a few seconds.
3. On a video without subtitles (e.g. `aqz-KE-bpKQ`): `No subtitles available`.
4. `./press.sh yellow`, then `node eval.mjs snippets/audio-only.js`: yellow
   `Audio-Only mode` toast and `videoVisibility: "hidden"`; again to restore.
5. BLUE while Audio-Only is on changes only subtitles.
6. `node keys.mjs green` opens the settings panel, and again closes it.

Known: upstream's "Press [YELLOW] to toggle" hint doesn't appear in the player
controls on a 2018 LG, although the toggle itself works.
