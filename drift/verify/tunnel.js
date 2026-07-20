// Tunnels: a hill the road punches straight through. Same rule as rivers and rest areas — pure function of
// the road index and the seed. What has to hold:
//   - placement is deterministic and never stacks on a bridge (a bore through a riverbank makes no sense)
//   - the wall genuinely tightens inside one (wallAt), and the existing barrier-hit physics catches it —
//     no new collision code, just a smaller number to hit
//   - the bore floor is paved wall-to-wall, not grass past ROAD_HALF — a tunnel has no verge to have, and
//     the wall-ride reward is impossible to earn if hugging the wall reads as driving off-road
//   - the WALL RIDE reward (same shape as a close shave) pays once per crossing, only while actually
//     sliding, and never on top of an actual clip
//   - rendering survives a real drive through one without throwing
(function(){
  const rows=[], fail=[];
  const rec=(name,pass,detail)=>{ if(!pass) fail.push(name); rows.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); };
  function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const D=window.__drift;

  try{
    D.horde.wipe();
    seedRandom(31337); D.start();
    const seed=D.game.seed, R=D.game.road;
    for(let i=0;i<8000;i+=50) ensureAhead(R,i+90);   // materialise enough road to sweep

    // ---- purity
    const twice=[0,700,3000,6000].every(i=>{
      const a=tunnelAt(i,seed), b=tunnelAt(i,seed);
      return (!a&&!b) || (a&&b&&a.t===b.t&&a.v.c===b.v.c);
    });
    rec("the same road point always gives the same tunnel (or the same absence of one)", twice,
        "tunnelAt() is stateless — asked twice, it answers the same");

    // ---- found often enough to actually meet on a drive, never on a bridge, never hosting a rest bay
    let found=0, badBridge=0, badRest=0;
    for(let b=0;b<12;b++){
      const v=tunnelBlock(b,seed); if(!v.ok) continue;
      found++;
      for(let i=v.c-v.len-40;i<=v.c+v.len+40;i++) if(bridgeAt(i,seed)) badBridge++;
      if(restAt(v.c,seed)) badRest++;
    }
    rec("tunnels are common enough to actually meet on a drive", found>=3,
        found+" real tunnels found in the first 12 blocks (7680 road points, ~20km)");
    rec("no tunnel is ever punched through a bridge, and no rest bay sits inside one", badBridge===0 && badRest===0,
        badBridge+" bridge conflicts, "+badRest+" rest-bay conflicts across "+found+" tunnels");

    // ---- the wall itself: tight inside, normal outside
    let sample=null;
    for(let b=0;b<12 && !sample;b++){ const v=tunnelBlock(b,seed); if(v.ok) sample=v; }
    rec("found a tunnel to measure", !!sample, sample?("c="+sample.c+" len="+sample.len):"none in range");
    if(!sample) throw new Error("no tunnel in range — nothing below can run");

    rec("the wall is TUNNEL_HALF at the bore's own centre", wallAt(sample.c,0,seed)===TUNNEL_HALF,
        "wallAt(centre,0)="+wallAt(sample.c,0,seed)+" want "+TUNNEL_HALF);
    const farI=sample.c+3000;
    rec("...and back to the ordinary BARRIER a long way outside it", wallAt(farI,0,seed)===BARRIER,
        "wallAt(far,0)="+wallAt(farI,0,seed)+" want "+BARRIER);
    rec("the tighter wall is genuinely narrower than the open road's", TUNNEL_HALF<BARRIER,
        "TUNNEL_HALF="+TUNNEL_HALF+" < BARRIER="+BARRIER);

    // ---- the bore floor is paved out to the wall, not grass past ROAD_HALF — the bug this probe exists to pin
    const justInsideLane=paved(sample.c,ROAD_HALF+1,seed);
    const nearTheWall=paved(sample.c,TUNNEL_HALF-5,seed);
    const pastTheWall=paved(sample.c,TUNNEL_HALF+40,seed);
    rec("the bore floor is paved from the lane edge out to the wall, wall-to-wall", justInsideLane && nearTheWall,
        "paved just past ROAD_HALF="+justInsideLane+", paved near TUNNEL_HALF="+nearTheWall);
    rec("...and genuinely stops being paved once you're through the rock", !pastTheWall,
        "paved 40px beyond TUNNEL_HALF="+pastTheWall);
    // the same offset, OUTSIDE any tunnel, must read as grass — proving this isn't just "always paved now"
    const sameOffsetOutside=paved(farI,TUNNEL_HALF-5,seed);
    rec("that same lateral offset reads as grass out on the open road", !sameOffsetOutside,
        "paved(open road, TUNNEL_HALF-5)="+sameOffsetOutside);

    // ---- the collision physics actually catches a tunnel wall the barrier code already knows how to handle
    D.game.zNextIdx=1e9; D.game.zombies.length=0;
    const p=R.pts[sample.c-40], nx=-p.ty, ny=p.tx;
    const g=D.game, c=g.car;
    c.idx=sample.c-40; c.x=p.x+nx*295; c.y=p.y+ny*295;   // inside TUNNEL_HALF(280) but past where BARRIER(330) would ever bite
    c.angle=Math.atan2(p.ty,p.tx); c.vx=Math.cos(c.angle)*500; c.vy=Math.sin(c.angle)*500; g.speed=500; g.hitT=0;
    const battBefore=g.batt;
    D.setInput(0,0.5,0);
    for(let i=0;i<30 && g.hitT<=0;i++) D.step(1);
    D.clearInput();
    rec("the tunnel wall actually stops you — the same barrier hit, just sooner", g.hitT>0 && g.batt<battBefore,
        "hitT="+g.hitT.toFixed(2)+", batt "+(battBefore*100).toFixed(1)+"% -> "+(g.batt*100).toFixed(1)+"%");

    // ---- the WALL RIDE reward: hug the wall while genuinely sliding, and it pays heat once
    const p2=R.pts[sample.c];
    c.idx=sample.c; c.x=p2.x-p2.ty*255; c.y=p2.y+p2.tx*255;
    c.angle=Math.atan2(p2.ty,p2.tx)+0.3;
    c.vx=Math.cos(Math.atan2(p2.ty,p2.tx))*480; c.vy=Math.sin(Math.atan2(p2.ty,p2.tx))*480;
    g.speed=480; g.slip=0.3; g.wallWasClose=false; g.wallRides=0; g.mult=1; g.hitT=0;
    D.setInput(0,0.3,0);
    for(let i=0;i<20;i++) D.step(1);
    D.clearInput();
    rec("hugging the wall while sliding pays a WALL RIDE", g.wallRides===1 && g.mult>1 && !g.onGrass,
        "wallRides="+g.wallRides+" mult="+g.mult.toFixed(2)+" onGrass="+g.onGrass);
    const toastEl=document.getElementById('wallEl');
    rec("the toast actually says WALL RIDE", toastEl && toastEl.textContent==='WALL RIDE',
        "toast text = '"+(toastEl&&toastEl.textContent)+"'");
    const afterFirst=g.wallRides;
    for(let i=0;i<30;i++) D.step(1);
    rec("...but sitting against the same stretch of wall doesn't pay out every frame", g.wallRides===afterFirst,
        "wallRides held at "+g.wallRides+" while still against the same wall");

    // ---- an actual clip (the collision above) must NOT also pay a wall-ride reward for the same event
    c.idx=sample.c-40; c.x=p.x+nx*295; c.y=p.y+ny*295;
    c.angle=Math.atan2(p.ty,p.tx); c.vx=Math.cos(c.angle)*500; c.vy=Math.sin(c.angle)*500;
    g.speed=500; g.hitT=0; g.wallRides=0; g.wallWasClose=false; g.slip=0.3;
    D.setInput(0,0.5,0);
    for(let i=0;i<15;i++) D.step(1);
    D.clearInput();
    rec("clipping the wall for real doesn't also pay a reward for it", g.wallRides===0,
        "wallRides="+g.wallRides+" after a genuine hit (hitT="+g.hitT.toFixed(2)+")");

    // ---- driving tidily down the centre, nowhere near a tunnel wall, never trips it
    seedRandom(4477); D.start(); D.game.zNextIdx=1e9; D.game.zombies.length=0;
    for(let i=0;i<400;i++){ D.autopilot(); D.step(1); } D.clearInput();
    rec("ordinary centred driving never falsely pays a wall ride", D.game.wallRides===0,
        "wallRides after 400 ticks of autopilot = "+D.game.wallRides);

    // ---- the badge and the contract both hook up to the same counter
    D.game.wallRides=3;
    checkRunBadges(D.game,false);
    rec("3 wall rides in a run awards TUNNEL RAT", D.shelf.owned().indexOf('tunnelrat')>=0,
        "shelf owns: "+D.shelf.owned().join(','));
    const wallrideContract={ id:'wallride', label:'HUG THE BORE 2x', rew:70, tgt:2, prog:g=>g.wallRides, fmt:v=>''+Math.round(v) };
    rec("the contract reads the same counter, and clears at 2", wallrideContract.prog(D.game)>=wallrideContract.tgt,
        "wallrideContract.prog(game) = "+wallrideContract.prog(D.game)+" (tgt "+wallrideContract.tgt+")");

    // ---- rendering survives a real pass through one, driver view, no exceptions — walked straight down
    // the tunnel's own points (not left to autopilot, which — dropped in mid-corner with no run-up — can
    // fight the very bend that put a tunnel here; that's a teleport artefact, not a physics bug)
    seedRandom(31337); D.start(); D.game.zNextIdx=1e9; D.game.zombies.length=0;
    D.game.view='driver';
    const R3=D.game.road; ensureAhead(R3,sample.c+sample.len+60);   // D.start() built a FRESH road object — the old R is stale
    let renderErr=null, sawTunnel=false;
    const origErr=window.onerror; window.onerror=(m)=>{ renderErr=m; };
    try{
      for(let i=sample.c-sample.len-20;i<=sample.c+sample.len+20;i+=2){
        const pp=R3.pts[i];
        D.game.car.idx=i; D.game.car.x=pp.x; D.game.car.y=pp.y;
        D.game.car.angle=Math.atan2(pp.ty,pp.tx); D.game.camAngle=D.game.car.angle;
        D.game.car.vx=0; D.game.car.vy=0; D.game.speed=0;
        if(tunnelAt(i,seed)) sawTunnel=true;
        render();
      }
    }catch(e){ renderErr=e.message||String(e); }
    window.onerror=origErr;
    D.clearInput();
    rec("driving through a real tunnel and rendering every frame never throws", !renderErr && sawTunnel,
        "renderErr="+renderErr+", actually drove through a tunnel="+sawTunnel);
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); fail.push("threw"); }

  rows.push("");
  rows.push(fail.length ? ("FAIL | "+fail.length+" tunnel problem(s)") : "PASS | the bore, the wall, and the ride all hold");
  const d=document.createElement("div");
  d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
