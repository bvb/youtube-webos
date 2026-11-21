/* global document */
// Prints the newest YTAF toasts, the subtitle state and the page type.
// Used by press.sh. Runs raw in the TV page (no Babel): keep it to ES2015.
(() => {
  const toasts = Array.from(
    document.querySelectorAll('.ytaf-notification-container .message'),
    (el) => `${el.innerText} [${el.style.borderColor}]`
  );

  const player = document.querySelector('.html5-video-player');
  const hasCaptionApi = !!(player && player.getOption);
  const track = hasCaptionApi ? player.getOption('captions', 'track') : null;
  const captionWindow = player
    ? document.getElementById(player.getCaptionWindowContainerId())
    : null;
  const shown = captionWindow
    ? (captionWindow.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 50)
    : null;

  return [
    `toasts: ${JSON.stringify(toasts)}`,
    `subtitles: on=${hasCaptionApi && player.isSubtitlesOn()} track=${track && track.languageCode} shown=${JSON.stringify(shown)}`,
    `page: ${document.body.className.split(' ')[0]} inline=${player && player.isInline()}`
  ].join('\n');
})();
