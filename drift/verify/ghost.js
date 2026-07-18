// The ghost, raced for real: today's best daily run is recorded, kept only when it takes the ledger,
// and replayed as an interpolated line the next daily start. What must hold:
//   - a daily run records its line; an endless run records NOTHING
//   - only a best run keeps its ghost — a worse run must not overwrite the line to beat
//   - the next daily start loads the ghost, and ghostAt() replays the recorded positions faithfully
//   - the HUD meter shows the signed gap, and a slower driver reads BEHIND
//   - another day's ghost is void
(function(){
  const rows=[], fail=[];
  const rec=(name,pass,detail)=>{ if(!pass) fail.push(name); rows.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); };
  function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const D=window.__drift;
  const drive=(secs,gas)=>{ for(let t=0;t<secs*120 && D.state==='play';t+=6){
    D.autopilot(); D.setInput(D.game.forceSteer, gas===undefined?D.game.forceGas:gas, gas===undefined?D.game.forceBrake:0); D.step(6); } };
  const die=()=>{ D.game.batt=0.004; for(let i=0;i<900 && D.state==='play';i++){ D.autopilot(); D.step(1); } D.clearInput(); };

  try{
    D.horde.wipe(); D.garage.wipe();
    try{ localStorage.removeItem('drift.dbest'); localStorage.removeItem('drift.dghost'); localStorage.removeItem('drift.best'); }catch(e){}

    // ---- an endless run records nothing
    seedRandom(5); D.start(); drive(6);
    rec("an endless run lays down no line", D.game.rec.length===0 && D.game.ghost===null,
        "rec="+D.game.rec.length+" ghost="+D.game.ghost);

    // ---- the first daily run records, dies, and keeps its ghost
    D.startDaily();
    rec("the first daily has no ghost to race", D.game.ghost===null, "ghost="+D.game.ghost);
    drive(12); const rec1=D.game.rec.length, dist1=D.game.dist; die();
    const score1=Math.round(D.game.score);
    let raw=''; try{ raw=localStorage.getItem('drift.dghost')||''; }catch(e){}
    rec("a best daily run keeps its line", rec1>60 && raw.indexOf(D.daily.key()+'|'+score1+'|')===0,
        rec1+" samples over "+(dist1/10000).toFixed(1)+"km, stored under "+raw.slice(0,16)+"...");

    // ---- the next daily start races it, faithfully
    D.startDaily();
    const gh=D.game.ghost;
    rec("the next daily start loads the ghost", !!gh && gh.pts.length>60 && gh.score===score1,
        gh?("pts="+gh.pts.length+" score="+gh.score):"null");
    // replay fidelity: at each recorded timestamp, ghostAt must give back the recorded point
    let worst=0;
    for(const k of [5, gh.pts.length>>1, gh.pts.length-2]){
      const s=gh.pts[k]; D.game.time=s[0]; D.game.ghostIdx=0;
      const gp=D.ghostAt();
      worst=Math.max(worst, Math.hypot(gp.x-s[1], gp.y-s[2]));
    }
    rec("ghostAt replays the recorded line", worst<2, "worst drift from recorded samples: "+worst.toFixed(2)+"px");
    D.game.time=0; D.game.ghostIdx=0;

    // ---- the meter: drive slower than the ghost drove, and read BEHIND
    drive(6,0);                                        // coasting vs its recorded full-throttle start
    const gp=D.ghostAt();
    const behind=D.game.dist-gp.dist;
    const el=document.getElementById('ghostEl');
    rec("a slower driver is behind its ghost", behind<0, "gap="+Math.round(behind*0.1)+"m after 6s of coasting");
    D.hud();   // probes step synchronously — no frame has painted the HUD for us
    rec("the HUD meter says so", el.style.display!=='none' && el.textContent.indexOf('GHOST')===0 && el.innerHTML.indexOf('beh')>=0,
        "'"+el.textContent+"'");

    // ---- a worse run must not overwrite the ghost
    die();
    let raw2=''; try{ raw2=localStorage.getItem('drift.dghost')||''; }catch(e){}
    rec("a worse daily run leaves the ghost alone", raw2===raw, "stored line unchanged (score "+score1+" still stands)");

    // ---- another day's line is void
    try{ localStorage.setItem('drift.dghost','2000-01-01'+raw.slice(raw.indexOf('|'))); }catch(e){}
    D.startDaily();
    rec("yesterday's ghost does not haunt today", D.game.ghost===null, "stale line ignored");
    die();

    try{ localStorage.removeItem('drift.dbest'); localStorage.removeItem('drift.dghost'); localStorage.removeItem('drift.best'); }catch(e){}
    D.horde.wipe();
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); fail.push("threw"); }

  rows.push("");
  rows.push(fail.length ? ("FAIL | "+fail.length+" ghost problem(s)") : "PASS | the phantom keeps the line");
  const d=document.createElement("div");
  d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
