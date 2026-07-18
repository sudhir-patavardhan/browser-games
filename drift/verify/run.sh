#!/usr/bin/env bash
# Drive drift/index.html in a real headless browser and assert on what the car actually does.
#
#   ./drift/verify/run.sh            # physics + behaviour suite (exits non-zero on any FAIL)
#   ./drift/verify/run.sh controls   # the touch + keyboard control scheme, both cameras
#   ./drift/verify/run.sh contracts  # the county job board: seeded draw, live progress, cash on the spot
#   ./drift/verify/run.sh garage     # wallet-bought car hardware, proven A/B on pinned roads
#   ./drift/verify/run.sh nearmiss   # the CLOSE SHAVE: choreographed passes, paid in heat only
#   ./drift/verify/run.sh daily      # today's road: one seed per day, its own best, resets at midnight
#   ./drift/verify/run.sh ghost      # the daily ghost: recorded on a best run, raced faithfully after
#   ./drift/verify/run.sh report     # chain tier names + the end-of-run report card
#   ./drift/verify/run.sh plane      # scenery build + airliner reachability
#   ./drift/verify/run.sh music      # the playlist actually loads in a browser
#
# The game exposes window.__drift (start / setInput(steer,gas,brake) / step(n) / autopilot), so a probe is
# just a <script> appended to a copy of the page. Probes write their findings into a <div id="RESULTS">,
# which we pull back out with --dump-dom. No test framework, no dependencies — same spirit as the games.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME="${GAME:-$HERE/../index.html}"
PROBE="${1:-assert}"
# the probe page must live NEXT TO the game, or relative paths (music/tracks.js, and anything
# else the game loads) resolve into a temp dir and silently vanish
WORK="$(cd "$(dirname "$GAME")" && pwd)"
PROBE_HTML="$WORK/.probe-$$.html"
trap 'rm -f "$PROBE_HTML"' EXIT

find_chrome(){
  if [ -n "${CHROME:-}" ]; then
    if command -v "$CHROME" >/dev/null 2>&1 || [ -x "$CHROME" ]; then echo "$CHROME"; return; fi
    echo "!! CHROME is set to '$CHROME' but that isn't executable" >&2; return
  fi
  for c in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    google-chrome-stable google-chrome chromium chromium-browser \
    /usr/bin/google-chrome /usr/bin/chromium /usr/bin/chromium-browser
  do
    if command -v "$c" >/dev/null 2>&1; then command -v "$c"; return; fi
    if [ -x "$c" ]; then echo "$c"; return; fi
  done
}
CHROME_BIN="$(find_chrome)"
if [ -z "$CHROME_BIN" ]; then
  echo "!! no Chrome/Chromium found. Set CHROME=/path/to/chrome, or install one." >&2
  echo "!! REFUSING to report success without actually running the game." >&2
  exit 2
fi

case "$PROBE" in
  assert) JS="$HERE/assert.js"; DIV="RESULTS" ;;
  controls) JS="$HERE/controls.js"; DIV="RESULTS" ;;
  contracts) JS="$HERE/contracts.js"; DIV="RESULTS" ;;
  garage) JS="$HERE/garage.js"; DIV="RESULTS" ;;
  nearmiss) JS="$HERE/nearmiss.js"; DIV="RESULTS" ;;
  daily) JS="$HERE/daily.js"; DIV="RESULTS" ;;
  ghost) JS="$HERE/ghost.js"; DIV="RESULTS" ;;
  report) JS="$HERE/report.js"; DIV="RESULTS" ;;
  plane)  JS="$HERE/plane.js";  DIV="PLANE" ;;
  music)  JS="$HERE/music.js";  DIV="RESULTS" ;;
  *) echo "unknown probe '$PROBE' (want: assert | controls | contracts | garage | nearmiss | daily | ghost | report | plane | music)" >&2; exit 2 ;;
esac

# splice the probe in just before </body>, after the game's own script has defined window.__drift
node -e '
const fs=require("fs");
const [game,js,out]=process.argv.slice(1);
let html=fs.readFileSync(game,"utf8");
if(!html.includes("window.__drift")) { console.error("!! "+game+" has no window.__drift test hooks"); process.exit(2); }
html=html.replace("</body>", "<script>\n"+fs.readFileSync(js,"utf8")+"\n<\/script>\n</body>");
fs.writeFileSync(out,html);
' "$GAME" "$JS" "$PROBE_HTML" || exit 2

OUT="$("$CHROME_BIN" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --allow-file-access-from-files --autoplay-policy=no-user-gesture-required \
  --virtual-time-budget=90000 --window-size=500,900 \
  --dump-dom "file://$PROBE_HTML" 2>/dev/null \
  | DIV="$DIV" node -e '
      let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
        const m=s.match(new RegExp("<div id=\""+process.env.DIV+"\">([\\s\\S]*?)</div>"));
        if(!m){ console.log("!! probe produced no output — it threw before reporting"); process.exit(1); }
        console.log(m[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,"\""));
      });')"

echo "$OUT"
FAILS="$(printf '%s\n' "$OUT" | grep -c '^FAIL' || true)"
if printf '%s\n' "$OUT" | grep -q '^!!'; then exit 1; fi
if [ "${FAILS:-0}" -gt 0 ]; then echo; echo "=== $FAILS FAILING"; exit 1; fi
echo; echo "=== all green"
