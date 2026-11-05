# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A webOS (LG TV) app (`youtube.leanback.v4`, "YouTube AdFree") that loads YouTube's TV web client (`https://www.youtube.com/tv`) and injects a user script into it to add ad blocking, SponsorBlock, thumbnail/quality upgrades, and other tweaks. It replaces the official YouTube app, which must be uninstalled first.

This checkout is a personal fork (see [Fork notes](#fork-notes)) of `webosbrew/youtube-webos`.

## Commands

Node >= 22 and **pnpm** (version pinned by `packageManager` in `package.json`; install it with `npm i -g pnpm@<that version>` run outside the repo, since Node 25+ no longer bundles corepack). npm is rejected: `devEngines` makes any `npm run` fail with `EBADDEVENGINES`. Scripts such as `lint:all` and `all` call `pnpm` themselves, so it must be on `PATH`.

There is no unit test suite; verification is lint + build + syntax-compat check + running on a TV.

```sh
pnpm install
pnpm run build          # webpack production build -> dist/
pnpm run build:dev      # development build (inline source maps)
pnpm run test:compat    # es-check: dist/**/*.js must be ES5 (run after a build)
pnpm run package        # ares-package dist/ -> youtube.leanback.v4_<version>_all.ipk in repo root
pnpm run deploy         # ares-install that .ipk onto the configured TV
pnpm run all            # build + package + deploy (fork addition)
pnpm run launch         # start the app on the TV
pnpm run launch -- -p '{"contentTarget":"v=VIDEO_ID"}'   # launch straight into a video
pnpm run inspect        # open remote Web Inspector for the running app

pnpm run lint:all       # runs lint:tsc, lint:eslint, lint:prettier
```

Always write `pnpm run deploy`, never `pnpm deploy`, which is a built-in pnpm command. `deploy`/`launch`/`inspect` need a TV configured with `pnpm exec ares-setup-device` (see README).

The version lives only in `package.json`. `assets/appinfo.json` has no `version`; webpack injects it into `dist/appinfo.json` at build time and also defines `__YTAF_VERSION__` (shown in the options panel).

A husky pre-commit hook runs `pnpm exec lint-staged`: prettier `--write` on everything staged, eslint on staged code, and a full `tsc -b` if any code file is staged. CI (`.github/workflows/main.yml`) runs build, `lint:all`, `test:compat`, and package.

## Architecture

### Two-stage boot

webpack has two entries ([webpack.config.js](webpack.config.js)):

1. **`src/index.js`** → `dist/index.js`, loaded by `dist/index.html` (the app's `main` in `appinfo.json`). It runs in the local app page only: it parses `window.launchParams` (deep links, DIAL, voice intents) in [src/utils.js](src/utils.js) `handleLaunch()`, builds a `youtube.com/tv#/...` URL, and navigates there.
2. **`src/userScript.ts`** → `dist/webOSUserScripts/userScript.js`. webOS injects this into the YouTube TV page after navigation. **All feature code runs here, inside YouTube's page**, not in our own page. It also handles `webOSRelaunch` events by calling `handleLaunch()` again.

`userScript.ts` is just an ordered list of side-effect imports, one per feature module. Import order matters: `whatwg-fetch` must load before `hooks` wraps `window.fetch`, and the `JSON.parse` wrappers compose in import order.

### How features hook into YouTube

Modules don't call into YouTube's code directly; they intercept it:

- **`JSON.parse` wrapping**: [adblock.js](src/adblock.js), [shorts.js](src/shorts.js), [remove-endscreen.ts](src/remove-endscreen.ts) each save the current `JSON.parse` and replace it, mutating API responses (deleting `adPlacements`/`adSlots`/`playerAds`, `adSlotRenderer` tiles, shorts shelves, `endscreen`). Each checks its config flag on every call, so toggles apply on the next response without reload.
- **`JSON.stringify` wrapping**: [hooks/json-stringify.ts](src/hooks/json-stringify.ts) clones outgoing request bodies (YouTube freezes some objects) and sets `playbackContext.contentPlaybackContext.isInlinePlaybackNoAd`.
- **`fetch` hooks**: [hooks/fetch.ts](src/hooks/fetch.ts) `FetchRegistry` (singleton) replaces `window.fetch` and emits cancelable `request`/`response` events; `evt.preventDefault()` makes the fetch reject. Used by [block-webos-cast.ts](src/block-webos-cast.ts). Set `window.__ytaf_debug__ = true` in the inspector to log every request/response with bodies.
- **`resolveCommand` hooks**: [app_api/index.ts](src/app_api/index.ts) `ResolveCommandRegistry` polls for YouTube's internal object in `window._yttv` that exposes `instance.resolveCommand`, wraps it, and dispatches by command key, e.g. `setClientSettingEndpoint` in [lang-settings-fix.ts](src/lang-settings-fix.ts) and `startAccountSelectorCommand` in [auto-account-select.ts](src/auto-account-select.ts). `dispatchCommand()` calls the original.
- **DOM observation**: most UI tweaks use `MutationObserver` against YouTube's DOM (`ytlr-*` tags, `[idomkey=...]` attributes, `.html5-video-player`, body classes like `WEB_PAGE_TYPE_WATCH`). These selectors are the most fragile part of the app; YouTube changes them and breakages usually show up here first.

### Player API

[src/player_api/](src/player_api/) wraps YouTube's player element:

- `requireElement(selector, Class)` ([helpers.ts](src/player_api/helpers.ts)): `querySelector` that waits for the element to appear. Use this rather than polling.
- `getPlayer()` returns the `.html5-video-player` element typed as `YTPlayer` ([yt-api.ts](src/player_api/yt-api.ts) documents the undocumented player methods used).
- `getPlayerManager()` ([manager.ts](src/player_api/manager.ts)) is a singleton emitting `newVideo` and `playbackStart` from `onStateChange` diffs, and exposes `playerMode` (`PREVIEW` / `SHORTS` / `NORMAL`). See [video-quality.ts](src/video-quality.ts) for usage.

[custom-event-target.ts](src/custom-event-target.ts) provides the typed `CustomEventTarget<EventMap>` / `TypedCustomEvent` used by these registries; use it for new event emitters.

### Config and options panel

- [src/config.js](src/config.js) is the single registry of options (`configOptions` map: key → `{ default, desc }`), persisted as JSON in `localStorage['ytaf-configuration']`. API: `configRead`, `configWrite`, `configAddChangeListener` / `configRemoveChangeListener`. Reading or writing an unknown key throws.
- Change listeners receive a `CustomEvent`; the value is `evt.detail.newValue` (also `oldValue`, `key`).
- [src/ui.js](src/ui.js) builds the options panel (GREEN remote button toggles it; BLUE toggles audio-only mode) with handwritten arrow-key navigation via the vendored spatial-navigation polyfill. Checkboxes are listed explicitly in `createOptionsPanel()`.
- `showNotification(text, ms, color)` from `ui.js` is the toast helper other modules import.

**Adding an option:** add it to `configOptions` in `config.js`, add a `createConfigCheckbox('<key>')` line in `createOptionsPanel()`, then read it with `configRead` and react to `configAddChangeListener` in the feature module. New modules are wired in by importing them from `userScript.ts`.

## Platform constraints

The bundle has to run on very old engines: `.browserslistrc` goes back to Safari 7/8 (webOS 1–2 WebKit) and Chrome 38 (webOS 3). Consequences:

- Babel ([babel.config.js](babel.config.js), with `preset-typescript`) transpiles everything; tsc only type-checks, and its output goes to `node_modules/.cache`. Terser runs with `ecma: 5`, and `test:compat` (es-check, `.escheckrc`) fails if any ES2015+ syntax reaches `dist/`.
- core-js polyfills use `usage-pure`, so they're imported per use and don't patch globals. That matters because we share YouTube's page. `es.json.parse` is deliberately excluded because pure polyfills break the `JSON.parse` wrapper chain; keep that exclusion.
- Top-level `await` is allowed (used in `video-quality.ts`, `lang-settings-fix.ts`, `auto-account-select.ts`); webpack turns those into async modules and `TransformAsyncModulesPlugin` strips the leftover `async`.
- Don't switch `devtool` to an `eval` variant; large eval chunks segfault old webOS runtimes.
- CSS is imported from JS (`style-loader`) and run through `postcss-preset-env`.
- Vendored `*-polyfill.js` files are excluded from eslint and prettier; don't reformat them.

## Code conventions

- Prettier: single quotes, no trailing commas, 2-space indent. ESLint additionally enforces single quotes, `no-var`, `no-await-in-loop`, and unused args prefixed `_`.
- TypeScript is strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, so use `import type` for type-only imports). Newer modules are `.ts`; the older `.js` files in `src/` are included via `allowJs` but not type-checked.
- Imports are extensionless (`'./config'`); webpack resolves `.js`/`.ts`.
- Log with `console.debug/info/warn` and a `[module-name]` prefix where the surrounding code does.

## Fork notes

- Work happens on branch `feature/bvb-tv`, pushed to remote `bvb-origin` (`github.com/bvb/youtube-webos`). `origin` is upstream `webosbrew/youtube-webos`; local `main` mirrors `origin/main`. The fork is kept as a small stack of commits rebased onto `origin/main`.
- Fork-specific edits to upstream code are tagged with a `//bvb-tv:` comment (see the end of `ui.js`). Keep doing this so upstream rebases stay easy to reconcile.
- Differences from upstream:
  - `upgradeThumbnails` defaults to `true` and `enableSponsorBlock` to `false` (`config.js`).
  - The "Press [GREEN]" startup toast is disabled (`ui.js`).
  - `imageForRecents` in `appinfo.json` points at the fork's `icon_splash_480x480.png` instead of upstream's `imageForRecents.png`; `icon.svg` is enlarged; `splash.png` is added but unreferenced. `appinfo.json` is the usual rebase conflict.
  - The `all` script; `release/` and IDE files ignored (`.gitignore`, eslint ignores).
