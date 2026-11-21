/* global document */
// Prints whether subtitles are on, the active track and the rendered caption text.
// Runs raw in the TV page (no Babel): keep it to ES2015.
(() => {
  const player = document.querySelector('.html5-video-player');
  const captionWindow = document.getElementById(
    player.getCaptionWindowContainerId()
  );

  return {
    time: Math.round(document.querySelector('video').currentTime),
    state: player.getPlayerState(),
    on: player.isSubtitlesOn(),
    track: player.getOption('captions', 'track'),
    shown: captionWindow
      ? (captionWindow.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80)
      : null
  };
})();
