#!/usr/bin/env bash
# Screenshot the game actually being driven, so you can LOOK at a change instead of trusting it.
#
#   ./drift/verify/shoot.sh driver out.png          # first-person windshield
#   ./drift/verify/shoot.sh top out.png 20000       # top-down, 20s of virtual game time
#
# Boots the game, forces the requested camera, and runs the built-in autopilot so the frame you capture is
# a car mid-drive rather than a start screen. Headless Chrome lays out at ~500px wide regardless of
# --window-size, so the default capture matches that; don't read a narrow capture as a layout bug.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME="${GAME:-$HERE/../index.html}"
VIEW="${1:-driver}"; OUT="${2:-$VIEW.png}"; VT="${3:-14000}"; SIZE="${4:-500,900}"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT

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

VIEW="$VIEW" node -e '
const fs=require("fs");
const [game,out]=process.argv.slice(1);
const view=process.env.VIEW;
let html=fs.readFileSync(game,"utf8");
const harness=`
<script>
(function(){
  try{ localStorage.setItem("drift.view", ${JSON.stringify(view)}==="driver"?"driver":"top"); }catch(e){}
  (function boot(){
    if(!window.__drift) return setTimeout(boot,30);
    __drift.start();
    if(__drift.game && __drift.game.view !== ${JSON.stringify(view)}){
      const b=document.getElementById("viewBtn"); if(b) b.click();
    }
    (function tick(){
      if(window.__drift && __drift.state==="play") __drift.autopilot();
      requestAnimationFrame(tick);
    })();
  })();
})();
<\/script>`;
fs.writeFileSync(out, html.replace("</body>", harness+"</body>"));
' "$GAME" "$WORK/shot.html" || exit 2

"$CHROME_BIN" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --allow-file-access-from-files --virtual-time-budget="$VT" \
  --window-size="$SIZE" --screenshot="$OUT" "file://$WORK/shot.html" >/dev/null 2>&1

[ -s "$OUT" ] && echo "wrote $OUT" || { echo "!! screenshot failed" >&2; exit 1; }
