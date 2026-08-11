#!/usr/bin/env bash
# Build the 20 s Instagram promo reel from REAL gameplay — record, pick highlights, cut, brand.
#
#   ./drift/promo/make.sh                # writes drift/promo/drift-promo-20s.mp4
#   SECS=240 ./drift/promo/make.sh       # record a longer session to pick from
#
# Pipeline:
#   1. record.js  — boots the game headless in portrait (720x1280), warms it 40 s off-clock,
#      then drives ~3 min in REAL time with the verify suite's aggressive follower model
#      (drifts for real), topping the horde up, while screencasting the full page (canvas +
#      DOM HUD: score, xN multiplier, CLOSE SHAVE banners) and sampling game state at 10 Hz.
#   2. analyze.js — scores 4.5 s sliding windows on shaves, threaded oncoming, deer dodges,
#      kills, multiplier and time-spent-sideways; picks the 4 best non-overlapping windows.
#   3. makeclips.js — maps each window to screencast frames with true per-frame durations.
#   4. ffmpeg — 1080x1920 @30fps, kreeda.games watermark top-right on every gameplay second,
#      then a 2.4 s branded end card (endcard.html) with the PLAY FREE NOW / kreeda.games CTA.
#
# Needs: node 22+, Chrome/Chromium, a full ffmpeg (with libx264 + drawtext), DejaVu fonts.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME="${GAME:-$HERE/../index.html}"
SECS="${SECS:-180}"
WORK="${WORK:-$(mktemp -d -t driftpromo-XXXX)}"
FONT="${FONT:-/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf}"

find_chrome(){
  if [ -n "${CHROME:-}" ]; then echo "$CHROME"; return; fi
  for c in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    /opt/pw-browsers/chromium google-chrome-stable google-chrome chromium chromium-browser
  do
    if command -v "$c" >/dev/null 2>&1; then command -v "$c"; return; fi
    if [ -x "$c" ]; then echo "$c"; return; fi
  done
}
CHROME_BIN="$(find_chrome)"
[ -z "$CHROME_BIN" ] && { echo "!! no Chrome/Chromium found; set CHROME=/path/to/chrome" >&2; exit 2; }

echo "== working in $WORK"
node "$HERE/record.js" "$CHROME_BIN" "file://$GAME" "$WORK/frames" "$WORK/session.json" "$SECS" 720 1280
( cd "$WORK" && node "$HERE/analyze.js" session.json 4.5 4 \
             && node "$HERE/makeclips.js" session.json picks.json 4.4 )

"$CHROME_BIN" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --window-size=1080,1920 --screenshot="$WORK/endcard.png" "file://$HERE/endcard.html" 2>/dev/null

cd "$WORK"
for i in 0 1 2 3; do
  EXTRA=""; [ "$i" = 0 ] && EXTRA=",fade=t=in:st=0:d=0.35"
  ffmpeg -y -v error -f concat -safe 0 -i "clip$i.ffconcat" \
    -vf "scale=1080:1920:flags=lanczos,fps=30,drawtext=fontfile=$FONT:text='kreeda.games':fontsize=44:fontcolor=white@0.65:shadowcolor=black@0.4:shadowx=2:shadowy=2:x=w-tw-40:y=58$EXTRA" \
    -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -r 30 "c$i.mp4"
done
ffmpeg -y -v error -loop 1 -t 2.4 -i endcard.png -vf "fps=30,fade=t=in:st=0:d=0.4,scale=1080:1920" \
  -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -r 30 c4.mp4
printf "file 'c0.mp4'\nfile 'c1.mp4'\nfile 'c2.mp4'\nfile 'c3.mp4'\nfile 'c4.mp4'\n" > final.txt
ffmpeg -y -v error -f concat -safe 0 -i final.txt -f lavfi -i anullsrc=r=44100:cl=stereo -shortest \
  -c:v copy -c:a aac -b:a 96k -movflags +faststart "$HERE/drift-promo-20s.mp4"
echo "== wrote $HERE/drift-promo-20s.mp4"
