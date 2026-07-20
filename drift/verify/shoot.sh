#!/usr/bin/env bash
# Screenshot the game actually being driven, so you can LOOK at a change instead of trusting it.
#
#   ./drift/verify/shoot.sh driver out.png          # first-person windshield
#   ./drift/verify/shoot.sh top out.png 20000       # top-down, 20s of virtual game time
#   ./drift/verify/shoot.sh driver b.png 14000 500,900 70 bridge   # ...and drive until a bridge is ahead
#   ./drift/verify/shoot.sh driver s.png 14000 500,900 70 span     # ...or until you are out over the water
#   ./drift/verify/shoot.sh driver z.png 14000 500,900 70 zombie   # ...or until a shambler is dead ahead
#
# Boots the game, forces the requested camera, then DRIVES THE SIM FORWARD SYNCHRONOUSLY before handing back
# to the render loop — Chrome's virtual clock doesn't fire anywhere near enough rAF callbacks to advance the
# game on its own, so without this every capture is of a car that has only just set off (trip 0.0km, battery
# still 100%). The 5th arg is how many seconds of driving to do first (default 70).
# Headless Chrome lays out at ~500px wide regardless of --window-size; don't read a narrow capture as a bug.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME="${GAME:-$HERE/../index.html}"
VIEW="${1:-driver}"; OUT="${2:-$VIEW.png}"; VT="${3:-14000}"; SIZE="${4:-500,900}"; WARM="${5:-70}"; UNTIL="${6:-}"
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

VIEW="$VIEW" WARM="$WARM" UNTIL="$UNTIL" node -e '
const fs=require("fs");
const [game,out]=process.argv.slice(1);
const view=process.env.VIEW, warm=+(process.env.WARM||70), until=process.env.UNTIL||"";
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
    // The road seed is random per run, so warming for N seconds cannot land you on a rare feature — you have
    // to drive until you find one. And once you have, HOLD it there: the virtual clock keeps firing rAF right
    // up to the shutter, and an autopilot left running will cheerfully drive over the bridge and out the far
    // side before the picture is taken. So pin the car and let the world keep rendering around it.
    const AT={
      bridge: gg=> !bridgeAt(gg.car.idx,gg.seed) && !!bridgeAt(gg.car.idx+22,gg.seed),  // the span, dead ahead
      span:   gg=>{ const b=bridgeAt(gg.car.idx,gg.seed); return !!b && b.t>0.6; },     // out over the water
      zombie: gg=> gg.zombies.some(z=>z.fi-gg.car.idx>3 && z.fi-gg.car.idx<9),           // one dead ahead, close up
      rest:   gg=>{ const a=apronAt(gg.car.idx+9,gg.seed); return !!(a && a.d===0); },   // the charger right ahead
      gore:   gg=>{ const s=signAt(gg.car.idx+18,gg.seed); return !!(s && s.km===0); }   // the exit sign coming up
    }[${JSON.stringify(until)}];
    let pinned=null;
    if(AT){
      for(let i=0;i<300*120;i++){
        if(__drift.state!=="play" || AT(__drift.game)) break;
        __drift.autopilot(); __drift.step(1);
      }
      const c=__drift.game.car;
      pinned={ x:c.x, y:c.y, angle:c.angle, vx:c.vx, vy:c.vy, idx:c.idx };
    }
    (function tick(){
      if(window.__drift && __drift.state==="play"){
        if(pinned) Object.assign(__drift.game.car, pinned);   // hold it where we drove it to
        else __drift.autopilot();
      }
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
