/* Drift's playlist.
 *
 * Each entry is either a `file` sitting in this folder, or a `url` streamed from anywhere you're entitled to
 * stream from. The player treats them identically. `title` and `artist` are optional.
 *
 *   { file: 'neon-ridge.mp3', title: 'Neon Ridge', artist: 'ASTRA' },
 *   { url:  'https://your-bucket.example.com/neon-ridge.mp3', title: 'Neon Ridge' },
 *
 * These stream from S3 rather than living in the repo. A stock-music licence covers USING a track inside an
 * end product like this game; it does not cover redistributing the raw audio on its own, which is exactly
 * what committing the .mp3s to a public repo would do. So the audio is hosted, and .gitignore keeps the
 * local copies out of git.
 *
 * Nothing here, or nothing reachable? Nothing breaks — the dash reads NO MEDIA, the game is untouched, and
 * you can still load music straight off your device with "Load music" on the start screen.
 */
const S3 = 'https://browser-games-music.s3.us-west-2.amazonaws.com/';

window.DRIFT_TRACKS = [
  { url: S3+'adrenaline-soundroll-main-version-1818-02-20.mp3',            title: 'Adrenaline',           artist: 'Soundroll' },
  { url: S3+'southern-speed-demon-airstream-main-version-41961-01-24.mp3', title: 'Southern Speed Demon', artist: 'Airstream' },
  { url: S3+'limitless-vince-mcgill-main-version-30229-01-30.mp3',         title: 'Limitless',            artist: 'Vince McGill' },
];
