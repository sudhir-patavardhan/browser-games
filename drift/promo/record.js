// Same driver as record.js, but captures the FULL PAGE (canvas + DOM HUD: score, multiplier,
// CLOSE SHAVE banners, toasts) via CDP Page.startScreencast. Frames land on disk as they
// arrive with timestamps, so ffmpeg can rebuild true timing afterwards.
//
//   node record2.js <chrome> <gameUrl> <framesDir> <log.json> <secs> <W> <H>
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const [chromeBin, url, framesDir, logOut, secsArg, wArg, hArg] = process.argv.slice(2);
const secs = +secsArg, W = +wArg, H = +hArg;
fs.mkdirSync(framesDir, { recursive: true });
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'driftpromo-'));
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
  let frameN = 0, recording = false, meta = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); return; }
    if (m.method === 'Page.screencastFrame') {
      const p = m.params;
      if (recording) {
        fs.writeFileSync(path.join(framesDir, 'f' + String(frameN).padStart(6, '0') + '.jpg'),
          Buffer.from(p.data, 'base64'));
        meta.push(p.metadata.timestamp);
        frameN++;
      }
      ws.send(JSON.stringify({ id: ++id, method: 'Page.screencastFrameAck', params: { sessionId: p.sessionId } }));
    }
  });
  const send = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression, awaitPromise) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: !!awaitPromise, returnByValue: true });
    const det = r.result && r.result.exceptionDetails;
    if (det) throw new Error((det.exception && det.exception.description || det.text || '').split('\n')[0]);
    return r.result && r.result.result && r.result.result.value;
  };

  await send('Page.enable', {});
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: true });
  await sleep(500);
  if (await ev('typeof window.__drift') !== 'object') throw new Error(url + ' has no window.__drift hooks');

  const dist = await ev(`(function(){
    try{ localStorage.setItem('drift.view2','driver'); }catch(e){}
    (function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
      let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; })(31337);
    window.__promoDrive = (function(aggr, opts){
      opts=opts||{};
      return function(g){
        const R=g.road, c=g.car;
        const p=R.pts[c.idx];
        const lead=Math.round(Math.min(Math.max(5+g.speed/70,6),15));
        const look=R.pts[Math.min(R.pts.length-1,c.idx+lead)];
        const desired=Math.atan2(look.y-c.y, look.x-c.x);
        const nx=-p.ty, ny=p.tx, off=(c.x-p.x)*nx+(c.y-p.y)*ny;
        let err=desired-c.angle; while(err>Math.PI)err-=6.283185307; while(err<-Math.PI)err+=6.283185307;
        err += Math.max(-0.35,Math.min(0.35,-off/280));
        const over=Math.max(0,Math.abs(g.slip)-0.22)*Math.sign(g.slip);
        const steer=Math.max(-1,Math.min(1, err*2.6 - over*1.8));
        let k=0.00012;
        for(let i=c.idx+2;i<Math.min(R.pts.length-1,c.idx+30);i++){
          const a=R.pts[i], b=R.pts[i+1];
          let d=Math.atan2(b.ty,b.tx)-Math.atan2(a.ty,a.tx);
          while(d>Math.PI)d-=6.283185307; while(d<-Math.PI)d+=6.283185307;
          const kk=Math.abs(d)/26; if(kk>k) k=kk;
        }
        const grip=290*0.8;
        const vT=Math.max(260, Math.min(790, Math.sqrt(grip/k)*aggr));
        const tight = k>0.0016;
        let gas=0, brake=0;
        if(g.speed < vT-15) gas=1;
        else if(g.speed > vT+15) brake=1;
        if(opts.stab && tight && g.speed>380 && Math.abs(err)>0.06){ brake=1; gas=0; }
        return [steer,gas,brake];
      };
    })(1.15, {stab:true});
    __drift.start(); __drift.game.view='driver';
    for(let i=0;i<40*120 && __drift.state==='play';i++){
      const inp=__promoDrive(__drift.game);
      __drift.setInput(inp[0],inp[1],inp[2]); __drift.step(1);
    }
    window.__promoLog=[]; window.__promoT0=performance.now();
    (function tick(){
      if(window.__drift){
        if(__drift.state==='play'){
          const inp=__promoDrive(__drift.game);
          __drift.setInput(inp[0],inp[1],inp[2]);
        } else {
          __promoLog.push({t:(performance.now()-__promoT0)/1000, ev:'restart'});
          __drift.start(); __drift.game.view='driver';
          for(let i=0;i<15*120 && __drift.state==='play';i++){
            const inp=__promoDrive(__drift.game);
            __drift.setInput(inp[0],inp[1],inp[2]); __drift.step(1);
          }
        }
      }
      requestAnimationFrame(tick);
    })();
    return __drift.game.dist;
  })()`);
  console.log('warmed to ' + (dist / 10000).toFixed(1) + ' km');

  await ev(`setInterval(function(){ const g=__drift.game;
    if(g && __drift.state==='play' && g.zombies.length<7) __drift.horde.spawn(g.car.idx+64+((g.zrng()*46)|0));
  }, 420)`);
  await ev(`setInterval(function(){ const g=__drift.game; if(!g||__drift.state!=='play') return;
    __promoLog.push({ t:(performance.now()-__promoT0)/1000,
      kmh:Math.round(g.speed*0.36), mult:+(g.mult||1).toFixed(1), chain:Math.round(g.chain||0),
      slip:+(Math.abs(g.slip)||0).toFixed(2), buzz:g.buzzes|0, calls:g.calls|0, spooks:g.spooks|0,
      kills:(g.zCarKills|0)+(g.gunKills|0), cash:Math.round(g.cashRun||0),
      best:Math.round(g.bestChain||0), z:g.zombies.length, tr:(g.traffic||[]).length });
  }, 100)`);

  // mark the recording origin on the same clock the sampler uses
  await ev('window.__recT0=(performance.now()-window.__promoT0)/1000');
  recording = true;
  await send('Page.startScreencast', { format: 'jpeg', quality: 85, everyNthFrame: 1 });
  console.log('screencasting ' + secs + ' s of real time...');
  await sleep(secs * 1000);
  recording = false;
  await send('Page.stopScreencast', {});
  const recT0 = await ev('window.__recT0');
  const log = await ev('JSON.stringify(window.__promoLog)');
  fs.writeFileSync(logOut, JSON.stringify({ recT0, frames: meta, log: JSON.parse(log) }));
  console.log('wrote ' + frameN + ' frames (' + (frameN / secs).toFixed(1) + ' fps) to ' + framesDir +
    ', log to ' + logOut);
  chrome.kill(); process.exit(0);
})().catch(e => { console.error('!! ' + e.message); chrome.kill(); process.exit(1); });
