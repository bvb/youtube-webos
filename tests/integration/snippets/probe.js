/* global document, location */
// Lists the player's caption-related methods and its current caption state.
// Runs raw in the TV page (no Babel): keep it to ES2015.
(() => {
  const player = document.querySelector('.html5-video-player');
  const result = {
    url: location.href,
    userAgent: navigator.userAgent,
    language: navigator.language,
    page: document.body.className,
    player: !!player
  };
  if (!player) return result;

  const safe = (fn) => {
    try {
      return fn();
    } catch (err) {
      return `ERR ${err.message}`;
    }
  };

  result.captionMethods = [];
  for (const key in player) {
    if (
      /capt|subt|option|module|track|lang/i.test(key) &&
      typeof safe(() => player[key]) === 'function'
    ) {
      result.captionMethods.push(key);
    }
  }

  return Object.assign(result, {
    videoId: safe(() => player.getVideoData().video_id),
    errorCode: safe(() => player.getVideoData().errorCode),
    inline: safe(() => player.isInline()),
    state: safe(() => player.getPlayerState()),
    subtitlesOn: safe(() => player.isSubtitlesOn()),
    modules: safe(() => player.getOptions()),
    captionOptions: safe(() => player.getOptions('captions')),
    track: safe(() => player.getOption('captions', 'track')),
    tracklist: safe(() => player.getOption('captions', 'tracklist'))
  });
})();
