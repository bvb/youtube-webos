/**
 * bvb-tv: BLUE remote button shows or hides subtitles on the playing video.
 */

import type { YTPlayer } from './player_api';

interface CaptionTrack {
  languageCode?: string;
  languageName?: string;
}

/**
 * Undocumented caption methods of the TV player (verified on webOS 4 / 2018).
 * Optional because they are not part of any public API and may disappear.
 */
interface CaptionsPlayer extends YTPlayer {
  isSubtitlesOn?(): boolean;
  /**
   * Only switches subtitles on (calling it again does not turn them off).
   * Loads the track list if needed and picks YouTube's default track, which
   * prefers the UI language.
   */
  toggleSubtitlesOn?(): void;
  getOption?(module: 'captions', option: 'track'): CaptionTrack | null;
  /** An empty track turns subtitles off. */
  setOption?(module: 'captions', option: 'track', value: CaptionTrack): void;
}

function getActivePlayer(): CaptionsPlayer | null {
  const bodyClasses = document.body.classList;
  if (
    !bodyClasses.contains('WEB_PAGE_TYPE_WATCH') &&
    !bodyClasses.contains('WEB_PAGE_TYPE_SHORTS')
  )
    return null;

  const player = document.querySelector<CaptionsPlayer>('.html5-video-player');

  // Previews on the home page are inline.
  if (!player || player.isInline() || !player.getVideoData().video_id)
    return null;

  return player;
}

/**
 * Toggles subtitles on the playing video.
 * @returns Message describing the result, for a notification.
 */
export function toggleSubtitles(): string {
  const player = getActivePlayer();
  if (!player) return 'Subtitles: no video playing';

  if (
    !player.isSubtitlesOn ||
    !player.toggleSubtitlesOn ||
    !player.getOption ||
    !player.setOption
  ) {
    console.warn('[subtitles] Caption API not found on player');
    return 'Subtitles are not supported';
  }

  if (player.isSubtitlesOn()) {
    player.setOption('captions', 'track', {});
    console.info('[subtitles] Turned off');
    return 'Subtitles: Off';
  }

  player.toggleSubtitlesOn();

  if (!player.isSubtitlesOn()) {
    console.info(
      '[subtitles] No subtitles for',
      player.getVideoData().video_id
    );
    return 'No subtitles available';
  }

  const track = player.getOption('captions', 'track');
  console.info('[subtitles] Turned on', track);

  return track?.languageName
    ? `Subtitles: On (${track.languageName})`
    : 'Subtitles: On';
}
