# Drift — music

The car's stereo plays real audio files. There are none in the repo, and that's deliberate: we don't have
the rights to any music worth listening to, so the tracks are yours to bring.

## Add your own

1. Drop audio files (`.mp3`, `.m4a`, `.ogg` — anything the browser can play) into this folder.
2. List them in [`tracks.js`](tracks.js):

```js
window.DRIFT_TRACKS = [
  { file: 'neon-ridge.mp3', title: 'Neon Ridge', artist: 'ASTRA' },
  { file: 'coastline.mp3',  title: 'Coastline at Dusk', artist: 'Vela Ninety' },
];
```

`title` and `artist` are optional; without them the filename is used.

## Or just load them at runtime

Hit **"Load music from this device"** on the start screen (or tap the dash screen when it reads `NO MEDIA`)
and pick files off your machine. They're played from a local blob URL — nothing is uploaded anywhere, and
nothing is written to this repo.

## Controls

| | Dash (touch) | Keyboard |
|---|---|---|
| Play / pause | tap the album art | `K` |
| Next track | tap the middle of the strip | `N` |
| Previous track | — | `P` |
| Mute | tap the level meter | `M` |

## Nothing here? Nothing breaks

`drift/index.html` remains the whole game on its own. With no tracks and no `tracks.js`, the dash simply
reads `NO MEDIA` and everything else — physics, scenery, scoring — is untouched.
