/* global document */
// Prints the Audio-Only state: video visibility, the YTAF hint in the player
// controls, and the subtitle state (to check YELLOW and BLUE stay independent).
// Runs raw in the TV page (no Babel): keep it to ES2015.
(() => {
  const video = document.querySelector('video');
  const hint = document.querySelector('.ytaf-ui-watchControl-overlayMessage');
  const player = document.querySelector('.html5-video-player');

  return {
    videoVisibility: video.style.visibility,
    hint: hint ? hint.textContent : null,
    subtitlesOn: player.isSubtitlesOn(),
    state: player.getPlayerState()
  };
})();
