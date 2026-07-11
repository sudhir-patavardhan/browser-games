/* Drift's playlist.
 *
 * Drop .mp3 (or .m4a/.ogg) files next to this file, then list them here. That's it — the car's stereo will
 * play them, and you can skip through them from the dash.
 *
 *   window.DRIFT_TRACKS = [
 *     { file: 'neon-ridge.mp3', title: 'Neon Ridge', artist: 'ASTRA' },
 *
 *     // or stream it, from anywhere you're entitled to stream from (your own bucket, a host that allows
 *     // direct playback). NOT a stock-music or streaming service's preview files — see README.md.
 *     { url: 'https://your-bucket.example.com/coastline.mp3', title: 'Coastline at Dusk' },
 *   ];
 *
 * `title` and `artist` are optional — without them the filename is used.
 *
 * No tracks here? Nothing breaks. The game runs exactly as it always has, the dash reads NO MEDIA, and you
 * can still load music straight off your device with "Load music" on the start screen (or by tapping the
 * dash screen). Those files never leave your machine.
 *
 * Nothing is committed to this repo for you: the tracks you want are yours to supply, and shipping music
 * we don't have the rights to would be someone else's problem to clean up.
 */
window.DRIFT_TRACKS = [
  // { file: 'your-track.mp3', title: 'Your Track', artist: 'You' },
];
