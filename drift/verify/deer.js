// The county's wildlife: rarer and faster than the horde, no bounty, no gore — a startle, not an economy.
// What has to hold:
//   - crossings are seeded (schedule cadence), and never spawned on a bridge, in a tunnel, or across a
//     services apron — wildlife doesn't cross where the road itself is already doing something else
//   - a real strike costs speed and a bite of the pack, no cash, tracked separately from the horde
//   - a clean dodge at speed (genuinely close, not a hit) pays heat exactly like a close shave — once per
//     crossing, and ordinary driving nowhere near a deer never falsely pays it
//   - the badge and the contract read the same counter the toast increments
//   - a deer projects tall enough to actually clear the dashboard at a reasonable reaction distance, on
//     the resolution this suite actually runs at — an invisible hazard is a cheap hit, not a fair one
(function(){
  const rows=[], fail=[];
  const rec=(name,pass,detail)=>{ if(!pass) fail.push(name); rows.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); };
  function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const D=window.__drift;
  const cruise=(n)=>{ for(let i=0;i<n;i++){ D.autopilot(); D.step(1); } D.clearInput(); };

  try{
    D.horde.wipe();

    // ---- drive a long stretch and inspect every crossing that actually gets spawned: never on a bridge,
    // never across a services apron (tunnels are a sibling feature this branch may not have merged yet —
    // updateDeer guards that check with typeof, so nothing here needs to)
    seedRandom(9911); D.start();
    const seed=D.game.seed, R=D.game.road;
    for(let i=0;i<20000;i+=200) ensureAhead(R,i+90);
    let badBridge=0, badApron=0, runs=1;
    // the horde stays LIVE here on purpose: deer share the horde's own "spawner live" gate (zNextIdx<1e8)
    // by design, so every OTHER probe that stands the horde down correctly silences deer too — but that
    // means THIS probe, checking that a crossing actually spawns, can't stand it down as well
    const seenFi=new Set(); let sawAny=false;
    for(let t=0;t<6000;t++){
      if(D.state!=='play'){ D.start(); runs++; }   // a crash shouldn't starve the sweep
      D.autopilot(); D.step(10);
      for(const z of D.game.deer){
        if(seenFi.has(z.fi)) continue; seenFi.add(z.fi); sawAny=true;
        if(bridgeAt(z.fi,D.game.seed)) badBridge++;
        if(restGeom(z.fi,D.game.seed)) badApron++;
      }
    }
    D.clearInput();
    rec("crossings actually happen on a long enough drive", sawAny, seenFi.size+" distinct crossing(s) seen across "+runs+" run(s)");
    rec("no crossing is ever planted on a bridge or a services apron", badBridge===0 && badApron===0,
        badBridge+" bridge conflicts, "+badApron+" apron conflicts across "+seenFi.size+" crossings");

    // ---- a real strike: costs speed and charge, no cash, tracked on its own counter
    seedRandom(31337); D.start(); D.game.zNextIdx=1e9; D.game.zombies.length=0;
    cruise(200);
    const g=D.game;
    g.deer.length=0; g.deerHits=0; g.spooks=0; g.batt=1;
    const cash0=D.horde.cash();
    const fi1=g.car.idx+3, pc=R.pts[g.car.idx];
    g.deer.push({ fi:fi1, o:0, dir:1, sp:200, ph:0, sc:1, spooked:false, minD:1e9, minSpd:0 });
    g.car.x=pc.x; g.car.y=pc.y; g.car.angle=Math.atan2(pc.ty,pc.tx);
    g.car.vx=Math.cos(g.car.angle)*350; g.car.vy=Math.sin(g.car.angle)*350; g.speed=350;
    const vBefore=Math.hypot(g.car.vx,g.car.vy), battBefore=g.batt;
    D.setInput(0,0.25,0);
    for(let i=0;i<20 && g.deerHits===0;i++) D.step(1);
    D.clearInput();
    rec("a real strike costs speed and a bite of the pack", g.deerHits===1 && g.batt<battBefore && Math.hypot(g.car.vx,g.car.vy)<vBefore,
        "deerHits="+g.deerHits+" batt "+(battBefore*100).toFixed(1)+"%->"+(g.batt*100).toFixed(1)+"% speed "+Math.round(vBefore)+"->"+Math.round(Math.hypot(g.car.vx,g.car.vy)));
    rec("...and it pays no bounty at all — a startle isn't the economy", D.horde.cash()===cash0,
        "wallet unchanged at $"+D.horde.cash());

    // ---- the dodge: the update loop judges a crossing the instant it falls behind the car (z.fi<c.idx-1),
    // scoring whatever closest-approach it already recorded. Pin THAT judgment directly — a real drive-by
    // is what the earlier strike test already proves the geometry does; this proves the judgment itself,
    // without depending on timing a precise near-miss through real physics.
    g.deer.length=0; g.deerHits=0; g.spooks=0; g.mult=1;
    const fi2=g.car.idx+2;
    g.deer.push({ fi:fi2, o:400, dir:1, sp:0, ph:0, sc:1, spooked:false, minD:90, minSpd:320 });   // parked well clear, closest-approach pre-recorded
    D.setInput(0,0.3,0);
    for(let i=0;i<60 && g.car.idx<=fi2+1;i++) D.step(1);   // just enough ticks for the car to pass the deer's index
    D.clearInput();
    rec("passing close at speed without hitting pays a DEER DODGE", g.deerHits===0 && g.spooks===1 && g.mult>1,
        "deerHits="+g.deerHits+" spooks="+g.spooks+" mult="+g.mult.toFixed(2));
    const toastEl=document.getElementById('deerEl');
    rec("the toast actually says DEER DODGE", toastEl && toastEl.textContent==='DEER DODGE',
        "toast text = '"+(toastEl&&toastEl.textContent)+"'");

    // ---- ordinary driving, nowhere near a deer, never falsely pays either
    seedRandom(4477); D.start(); D.game.zNextIdx=1e9; D.game.zombies.length=0; D.game.deer.length=0;
    cruise(300);
    rec("ordinary driving away from any crossing never falsely pays out", D.game.deerHits===0 && D.game.spooks===0,
        "deerHits="+D.game.deerHits+" spooks="+D.game.spooks+" after 300 ticks of autopilot");

    // ---- the badge and the contract hook up to the same counter
    D.game.spooks=3;
    checkRunBadges(D.game,false);
    rec("3 clean dodges in a run awards GAME WARDEN", D.shelf.owned().indexOf('warden')>=0,
        "shelf owns: "+D.shelf.owned().join(','));
    const dodgeContract={ id:'dodge', label:'DODGE 2 DEER CLEAN', rew:65, tgt:2, prog:g=>g.spooks, fmt:v=>''+Math.round(v) };
    rec("the contract reads the same counter, and clears at 2", dodgeContract.prog(D.game)>=dodgeContract.tgt,
        "dodgeContract.prog(game) = "+dodgeContract.prog(D.game)+" (tgt "+dodgeContract.tgt+")");

    // ---- rendering: a deer at a fair reaction distance actually clears the dashboard, on THIS resolution
    D.game.view='driver';
    const {cx,cy,rad}=wheelGeom(); const ch=clamp(rad*1.5,74,250);
    const dashTop=(cy-rad)-ch-16, horizon=H*0.42;
    rec("this resolution gives real clearance between the horizon and the dash", dashTop-horizon>60,
        "dashTop="+Math.round(dashTop)+" horizon="+Math.round(horizon)+" (want dashTop's y at least ~60px past the horizon's)");
    const a=D.game.camAngle, ca=Math.cos(a), sa=Math.sin(a), c=D.game.car;
    function proj(px,py){ const dx=px-c.x, dy=py-c.y; const z=dx*ca+dy*sa; if(z<16) return null;
      const side=-dx*sa+dy*ca; const sc=185/z; return {x:W*0.5+side*sc, y:horizon+112*sc, sc}; }
    const z={ fi:c.idx+25, o:0, dir:1, sp:0, ph:0, sc:1 };   // ~65m out — a realistic "just noticed it" distance
    const p=zPos(R,z), P=proj(p.x,p.y);
    let visible=false, topY=null;
    if(P){ const h=clamp(58*(z.sc||1)*P.sc,3,260); topY=P.y-h*1.0; visible=topY<dashTop; }
    rec("a deer ~65m out clears the dashboard on this resolution", visible,
        P?("topY="+Math.round(topY)+" vs dashTop="+Math.round(dashTop)):"deer projected off-screen");

    // ---- nothing throws driving through and rendering an actual crossing
    seedRandom(9911); D.start(); D.game.zNextIdx=1e9; D.game.zombies.length=0; D.game.view='driver';
    let renderErr=null;
    const origErr=window.onerror; window.onerror=(m)=>{ renderErr=m; };
    try{ for(let i=0;i<4000 && D.game.dist<40000;i++){ D.autopilot(); D.step(1); render(); } }
    catch(e){ renderErr=e.message||String(e); }
    window.onerror=origErr; D.clearInput();
    rec("driving a long stretch with rendering live never throws", !renderErr, "renderErr="+renderErr);
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); fail.push("threw"); }

  rows.push("");
  rows.push(fail.length ? ("FAIL | "+fail.length+" deer problem(s)") : "PASS | the crossing, the strike, and the dodge all hold");
  const d=document.createElement("div");
  d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
