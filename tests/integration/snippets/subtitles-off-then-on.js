/* global document */
// Turns subtitles off, then on with YouTube's default track, and reports the result.
// Calls the player directly, bypassing the BLUE handler: use it to check the
// caption API itself on a new video or firmware.
// Runs raw in the TV page (no Babel): keep it to ES2015.
(() => {
  const player = document.querySelector('.html5-video-player');
  const data = player.getVideoData();

  player.setOption('captions', 'track', {});
  let error = null;
  try {
    player.toggleSubtitlesOn();
  } catch (err) {
    error = err.message;
  }

  const track = player.getOption('captions', 'track');
  const tracklist = player.getOption('captions', 'tracklist');

  return {
    videoId: data.video_id,
    videoError: data.errorCode,
    error,
    on: player.isSubtitlesOn(),
    track: track && track.languageCode,
    tracks: tracklist ? tracklist.length : null
  };
})();
