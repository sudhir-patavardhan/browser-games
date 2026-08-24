#!/usr/bin/env bash
# Serve the repo over http on localhost and drive analytics.js in a real headless browser.
#
#   ./verify/analytics.sh            # both pages: a game folder, and the hub at the root
#   ./verify/analytics.sh drift      # just the game-folder page
#   ./verify/analytics.sh home       # just the root page
#
# Why a server at all, when every other suite in this repo runs from file://? Because analytics.js is
# deliberately dead on file:// (no cookie, no client_id, no honest numbers — see the file's header), so
# file:// can only ever pin what it does NOT do. That half is pinned by ./drift/verify/run.sh analytics.
# This is the other half: on a real origin, does it say which game, and how long the visitor played it.
#
# Nothing here touches the network: www.googletagmanager.com is resolved into a closed port, so the tag
# never loads and every assertion reads window.dataLayer — the queue gtag writes whether or not Google is
# reachable — instead of depending on a third party being up.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
WHICH="${1:-both}"
case "$WHICH" in both|drift|home) ;; *) echo "unknown page '$WHICH' (want: both | drift | home)" >&2; exit 2 ;; esac

find_chrome(){
  if [ -n "${CHROME:-}" ]; then
    if command -v "$CHROME" >/dev/null 2>&1 || [ -x "$CHROME" ]; then echo "$CHROME"; return; fi
    echo "!! CHROME is set to '$CHROME' but that isn't executable" >&2; return
  fi
  for c in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    google-chrome-stable google-chrome chromium chromium-browser \
    /usr/bin/google-chrome /usr/bin/chromium /usr/bin/chromium-browser /opt/pw-browsers/chromium
  do
    if command -v "$c" >/dev/null 2>&1; then command -v "$c"; return; fi
    if [ -x "$c" ]; then echo "$c"; return; fi
  done
}
CHROME_BIN="$(find_chrome)"
if [ -z "$CHROME_BIN" ]; then
  echo "!! no Chrome/Chromium found. Set CHROME=/path/to/chrome, or install one." >&2
  echo "!! REFUSING to report success without actually running it." >&2
  exit 2
fi

PAGE=".probe-analytics-$$.html"                       # written into the repo (and .gitignored), because analytics.js is loaded relatively
ROOT_PAGE="$ROOT/$PAGE"
GAME_PAGE="$ROOT/drift/$PAGE"
SERVER_LOG="$(mktemp)"
SERVER_PID=""
cleanup(){ [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null; rm -f "$ROOT_PAGE" "$GAME_PAGE" "$SERVER_LOG"; }
trap cleanup EXIT

# the probe page is the thinnest possible host for the file under test: a title to derive a name from, a
# folder to derive an id from, and the shared file itself, loaded exactly the way a game loads it
write_page(){  # $1=path  $2=src  $3=title  $4=expected game_id
  cat > "$1" <<HTML
<!doctype html><html lang="en" data-want-game="$4"><head><meta charset="utf-8"><title>$3</title></head>
<body><script src="$2"></script><script src="/verify/analytics.js"></script></body></html>
HTML
}
write_page "$ROOT_PAGE" "analytics.js"    "Kreeda — 12 free games that start the second you tap" "home"
write_page "$GAME_PAGE" "../analytics.js" "Drift — Kreeda"                                       "drift"

# a static server on an ephemeral port: no dependency, no fixed port to collide with
node -e '
const http=require("http"), fs=require("fs"), path=require("path");
const root=process.argv[1];
const TYPE={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",
            ".png":"image/png",".svg":"image/svg+xml",".ico":"image/x-icon",".webmanifest":"application/manifest+json"};
http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split("?")[0]);
  let f=path.normalize(path.join(root,p));
  if(!f.startsWith(root)){ res.writeHead(403).end(); return; }
  try{ if(fs.statSync(f).isDirectory()) f=path.join(f,"index.html"); }catch(e){}
  fs.readFile(f,(err,buf)=>{
    if(err){ res.writeHead(404).end("no"); return; }
    res.writeHead(200,{"content-type":TYPE[path.extname(f)]||"application/octet-stream"}).end(buf);
  });
}).listen(0,"127.0.0.1",function(){ console.log(this.address().port); });
' "$ROOT" > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!

PORT=""
for _ in $(seq 1 50); do
  PORT="$(head -1 "$SERVER_LOG" 2>/dev/null | tr -dc '0-9')"
  [ -n "$PORT" ] && break
  sleep 0.1
done
if [ -z "$PORT" ]; then echo "!! the local server never came up: $(cat "$SERVER_LOG")" >&2; exit 2; fi

FAILS=0
run_page(){  # $1=url path  $2=label
  echo "=== $2  (http://127.0.0.1:$PORT$1)"
  OUT="$("$CHROME_BIN" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
    --host-resolver-rules="MAP www.googletagmanager.com 127.0.0.1:1" \
    --virtual-time-budget=400000 --window-size=500,900 \
    --dump-dom "http://127.0.0.1:$PORT$1" 2>/dev/null \
    | node -e '
        let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
          const m=s.match(/<div id="RESULTS">([\s\S]*?)<\/div>/);
          if(!m){ console.log("!! probe produced no output — it threw before reporting"); process.exit(1); }
          console.log(m[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,"\""));
        });')"
  echo "$OUT"
  echo
  if printf '%s\n' "$OUT" | grep -q '^!!'; then FAILS=$((FAILS+1)); fi
  FAILS=$((FAILS + $(printf '%s\n' "$OUT" | grep -c '^FAIL' || true)))
}

[ "$WHICH" = both ] || [ "$WHICH" = drift ] && run_page "/drift/$PAGE" "a game page"
[ "$WHICH" = both ] || [ "$WHICH" = home  ] && run_page "/$PAGE"       "the hub at the root"

if [ "$FAILS" -gt 0 ]; then echo "=== $FAILS FAILING"; exit 1; fi
echo "=== all green"
