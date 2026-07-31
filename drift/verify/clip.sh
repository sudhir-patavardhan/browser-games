#!/usr/bin/env bash
# Record the loop that plays on the start card — REAL gameplay, not an animation of it.
#
#   ./drift/verify/clip.sh                      # rewrites drift/clip.webm (9 s, 640×400)
#   ./drift/verify/clip.sh out.webm 12 640 400  # somewhere else, longer, another shape
#
# The game already knows how to drive itself (window.__drift.autopilot), and Chrome already knows how to
# encode a canvas (captureStream + MediaRecorder). So the clip is just: boot the game, warm it up to speed,
# hold the wheel for nine seconds and record what the windshield saw. No ffmpeg, no capture card, no
# hand-drawn "impression" of the game that drifts out of date the moment the game changes — re-run this
# after a visual change and the card is telling the truth again.
#
# Chrome is driven over the DevTools protocol rather than with --screenshot/--virtual-time-budget, because a
# recording needs REAL time: virtual time fast-forwards the clock past the encoder and hands back an empty
# file. That means a headless Chrome with --remote-debugging-port and a WebSocket — node 22+ has one built
# in, so this still costs the repo no dependencies.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME="${GAME:-$HERE/../index.html}"
OUT="${1:-$HERE/../clip.webm}"; SECS="${2:-9}"; VW="${3:-640}"; VH="${4:-400}"

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
[ -z "$CHROME_BIN" ] && { echo "!! no Chrome/Chromium found; set CHROME=/path/to/chrome" >&2; exit 2; }

DRIVER="$(mktemp -t driftclip).js"
trap 'rm -f "$DRIVER"' EXIT
cat >"$DRIVER" <<'NODE'
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const [chromeBin, url, out, secsArg, wArg, hArg] = process.argv.slice(2);
const secs = +secsArg, W = +wArg, H = +hArg;
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'driftclip-'));
const chrome = spawn(chromeBin, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required', '--mute-audio',
  '--remote-debugging-port=0', '--user-data-dir=' + prof, url], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let port = '';
  for (let i = 0; i < 150 && !port; i++) {
    await sleep(100);
    try { port = fs.readFileSync(path.join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); } catch (e) {}
  }
  if (!port) throw new Error('Chrome never opened a DevTools port');
  await sleep(800);
  const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  const page = targets.find(t => t.type === 'page');
  if (!page) throw new Error('no page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const waits = new Map();
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } });
  const send = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression, awaitPromise) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: !!awaitPromise, returnByValue: true });
    const det = r.result && r.result.exceptionDetails;
    if (det) throw new Error((det.exception && det.exception.description || det.text || '').split('\n')[0]);
    return r.result && r.result.result && r.result.result.value;
  };

  // the canvas is sized off the viewport, so the viewport IS the frame size
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await sleep(400);
  if (await ev('typeof window.__drift') !== 'object') throw new Error(url + ' has no window.__drift hooks');

  // Warm up OFF the clock: __drift.step runs the sim synchronously, so 50 s of road happens instantly and
  // the recording opens on a car at speed with scenery around it, not one pulling away from a standing start.
  const dist = await ev(`(function(){
    try{ localStorage.setItem('drift.view2','driver'); }catch(e){}
    __drift.start(); __drift.game.view='driver';
    for(let i=0;i<50*120 && __drift.state==='play';i++){ __drift.autopilot(); __drift.step(1); }
    (function tick(){ if(window.__drift && __drift.state==='play') __drift.autopilot(); requestAnimationFrame(tick); })();
    return __drift.game.dist;
  })()`);
  console.log('warmed to ' + (dist / 1000).toFixed(1) + ' km');

  // A random nine seconds of road can be a quiet nine seconds of road. Top the horde up so the clip always
  // has something coming — same spawner the game uses, same seeded mix of walkers, runners and brutes.
  await ev(`setInterval(function(){ const g=__drift.game;
    if(g && g.zombies.length<7) __drift.horde.spawn(g.car.idx+64+((g.zrng()*46)|0));
  }, 420)`);

  const b64 = await ev(`(function(){
    const mr=new MediaRecorder(document.getElementById('c').captureStream(30),
      {mimeType:'video/webm;codecs=vp9', videoBitsPerSecond:700000});
    const parts=[]; mr.ondataavailable=e=>parts.push(e.data);
    return new Promise(res=>{
      mr.onstop=()=>{ const fr=new FileReader();
        fr.onload=()=>res(fr.result.split(',')[1]);
        fr.readAsDataURL(new Blob(parts,{type:'video/webm'})); };
      mr.start(); setTimeout(()=>mr.stop(), ${secs} * 1000);
    });
  })()`, true);
  if (!b64) throw new Error('recorder produced nothing');
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log('wrote ' + out + ' — ' + (fs.statSync(out).size / 1024).toFixed(0) + ' KB, ' + secs + ' s, ' + W + '×' + H);
  chrome.kill(); process.exit(0);
})().catch(e => { console.error('!! ' + e.message); chrome.kill(); process.exit(1); });
NODE

node "$DRIVER" "$CHROME_BIN" "file://$GAME" "$OUT" "$SECS" "$VW" "$VH"
