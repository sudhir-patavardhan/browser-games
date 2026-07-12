# Drift — music

The car's stereo plays real audio. There are no tracks in this repo, and that's deliberate: we don't hold
the rights to any, so the music is yours to bring. There are three ways to give it some.

## 1. Load it off your device (no setup)

Hit **"Load music from this device"** on the start screen, or tap the dash screen when it reads `NO MEDIA`.
The files play from a local blob URL — nothing is uploaded, nothing is written to this repo. Best for a
quick drive.

## 2. Drop files in this folder

Put audio files (`.mp3`, `.m4a`, `.ogg` — anything the browser plays) next to this README and list them in
[`tracks.js`](tracks.js):

```js
window.DRIFT_TRACKS = [
  { file: 'neon-ridge.mp3', title: 'Neon Ridge', artist: 'ASTRA' },
];
```

## 3. Stream from a URL  ← what this repo does

The three tracks here stream from S3 (`browser-games-music`, us-west-2). The `.mp3`s are **not** committed —
see the `.gitignore` next to this file, and the licence note below.

For the browser to play them, the objects must be **publicly readable**. Keep bucket *listing* denied (so the
bucket can't be enumerated) and allow `s3:GetObject` on the audio only:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadTracksOnly",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::browser-games-music/*.mp3"
  }]
}
```

You'll also need to turn off "Block all public access" for that bucket (bucket-policy access, at least), and
make sure each object's Content-Type is `audio/mpeg`. Check it works with:

```bash
curl -I https://browser-games-music.s3.us-west-2.amazonaws.com/<file>.mp3   # want 200 + audio/mpeg
```

A 403 means the browser can't fetch it either — the dash will simply read `NO MEDIA`.

## Any other URL

A track can be a `url` instead of a `file`, and it can point anywhere:

```js
window.DRIFT_TRACKS = [
  { url: 'https://your-bucket.s3.amazonaws.com/neon-ridge.mp3', title: 'Neon Ridge', artist: 'ASTRA' },
];
```

`title` and `artist` are optional in every form; without them the filename is used.

### Which URLs are fair game

Point this at audio **you are entitled to stream**: your own bucket or CDN, a self-hosted file, or a host
that explicitly permits direct playback.

Do **not** point it at a stock-music or streaming service's preview files — Envato Elements, Artlist,
Epidemic Sound, Spotify, YouTube and the like. Those previews are served for evaluation behind session URLs,
hotlinking them breaks the sites' terms (and usually just breaks, via referer blocking), and a subscription
to those services licenses you to *use tracks you've downloaded in your project* — not to use their servers
as a music backend. If you have such a subscription, the licensed path is: **download the track, then use
option 1 or 2 above.** That's what your licence is for.

If you want music that is legitimately free to redistribute, look for CC0 / Creative Commons sources
(Free Music Archive, Pixabay Music, incompetech, ccMixter, OpenGameArt) and honour whatever attribution the
licence asks for.

### Two caveats when streaming

- **It needs the network.** Every other part of Drift runs offline from the filesystem; a remote track is the
  one thing that won't. If the host is unreachable the player just skips to the next track.
- **The host must allow direct playback.** A plain `<audio>` element doesn't need CORS headers, but a server
  that blocks hotlinking by `Referer`, or that hands back an HTML page instead of audio bytes, will fail.

## Controls

| | Dash (touch) | Keyboard |
|---|---|---|
| Play / pause | tap the album art | `K` |
| Next track | tap the middle of the strip | `N` |
| Previous track | — | `P` |
| Mute | tap the level meter | `M` |

## Nothing here? Nothing breaks

`drift/index.html` remains the whole game on its own. With no tracks and no `tracks.js`, the dash reads
`NO MEDIA` and everything else — physics, scenery, scoring — is untouched.
