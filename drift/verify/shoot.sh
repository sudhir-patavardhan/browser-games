#!/usr/bin/env bash
# Screenshot the game actually being driven, so you can LOOK at a change instead of trusting it.
#
#   ./drift/verify/shoot.sh driver out.png          # first-person windshield
#   ./drift/verify/shoot.sh top out.png 20000       # top-down, 20s of virtual game time
#
# Boots the game, forces the requested camera, then DRIVES THE SIM FORWARD SYNCHRONOUSLY before handing back
# to the render loop — Chrome's virtual clock doesn't fire anywhere near enough rAF callbacks to advance the
# game on its own, so without this every capture is of a car that has only just set off (trip 0.0km, battery
# still 100%). The 5th arg is how many seconds of driving to do first (default 70).
# Headless Chrome lays out at ~500px wide regardless of --window-size; don't read a narrow capture as a bug.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME="${GAME:-$HERE/../index.html}"
VIEW="${1:-driver}"; OUT="${2:-$VIEW.png}"; VT="${3:-14000}"; SIZE="${4:-500,900}"; WARM="${5:-70}"
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
    google-chrome-stable google-chrome chromium chromium-browser \
    /usr/bin/google-chrome /usr/bin/chromium /usr/bin/chromium-browser
  do
    if command -v "$c" >/dev/null 2>&1; then command -v "$c"; return; fi
    if [ -x "$c" ]; then echo "$c"; return; fi
  done
}
CHROME_BIN="$(find_chrome)"
[ -z "$CHROME_BIN" ] && { echo "!! no Chrome/Chromium found; set CHROME=/path/to/chrome" >&2; exit 2; }

VIEW="$VIEW" WARM="$WARM" node -e '
const fs=require("fs");
const [game,out]=process.argv.slice(1);
const view=process.env.VIEW, warm=+(process.env.WARM||70);
let html=fs.readFileSync(game,"utf8");
const harness=`
<script>
(function(){
  try{ localStorage.setItem("drift.view2", ${JSON.stringify(view)}==="driver"?"driver":"top"); }catch(e){}
  (function boot(){
    if(!window.__drift) return setTimeout(boot,30);
    __drift.start();
    if(__drift.game && __drift.game.view !== ${JSON.stringify(view)}){
      const b=document.getElementById("viewBtn"); if(b) b.click();
    }
    for(let i=0;i<${warm}*120;i++){          // drive it for real before we look at it
      if(__drift.state!=="play") break;
      __drift.autopilot(); __drift.step(1);
    }
    (function tick(){
      if(window.__drift && __drift.state==="play") __drift.autopilot();
      requestAnimationFrame(tick);
    })();
  })();
})();
<\/script>`;
fs.writeFileSync(out, html.replace("</body>", harness+"</body>"));
' "$GAME" "$PROBE_HTML" || exit 2

"$CHROME_BIN" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --allow-file-access-from-files --virtual-time-budget="$VT" \
  --window-size="$SIZE" --screenshot="$OUT" "file://$PROBE_HTML" >/dev/null 2>&1

[ -s "$OUT" ] && echo "wrote $OUT" || { echo "!! screenshot failed" >&2; exit 1; }
