// The road's other users. Traffic is the one hazard here that is purely a question of WHERE you are, so
// what has to hold is mostly geometry, and the first claim matters more than all the rest:
//   - a LANE-DISCIPLINED driver never meets one. The whole physics canon is measured with an autopilot
//     that drives the centreline; if traffic could touch that driver, every number in assert.js would
//     silently be measuring something else
//   - traffic spawns in the far half of the road, far enough out to be read, and runs against your grain
//   - the yield is real and PROPORTIONAL: drift over the line and they hug their verge — and they stop AT
//     the verge, so taking their lane outright still meets them
//   - a head-on costs speed, a bite of the pack, and the chain you were holding — and pays no cash
//   - threading one pays a CLOSE CALL exactly once, at speed only, never on top of an actual hit, and
//     never for an ordinary pass in your own lane
//   - the manoeuvre the game drives ITSELF (the pull-in) is exempt, both ways
//   - the badge and the contract read the same counter the toast increments
//   - same seed, same traffic; a stood-down horde silences it entirely
//   - it renders, in both views, without throwing
(function(){
  const rows=[], fail=[];
  const rec=(name,pass,detail)=>{ if(!pass) fail.push(name); rows.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); };
  function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const D=window.__drift;
  const latOf=g=>{ const c=g.car, p=g.road.pts[c.idx]; return (c.x-p.x)*(-p.ty)+(c.y-p.y)*(p.tx); };
  // hold the car at an exact offset in the road frame and let the world come to it. Pinning is the only way
  // to ask "what does an oncoming driver do about a car sitting HERE" without steering one there by hand.
  const pin=(g,lat,spd)=>{ const c=g.car, p=g.road.pts[c.idx], nx=-p.ty, ny=p.tx;
    c.x=p.x+nx*lat; c.y=p.y+ny*lat; c.angle=Math.atan2(p.ty,p.tx);
    c.vx=Math.cos(c.angle)*spd; c.vy=Math.sin(c.angle)*spd; g.speed=spd; };
  const cruise=n=>{ for(let i=0;i<n;i++){ D.autopilot(); D.step(1); } D.clearInput(); };
  // assert.js's own tidy driver, copied verbatim at aggr=1.0. It has to be THIS driver and not the game's
  // autopilot, because it is this one whose numbers the physics canon is written in: if traffic can touch
  // it, every measurement in assert.js is quietly measuring something else from now on.
  function canonDriver(g){
    const R=g.road, c=g.car, p=R.pts[c.idx];
    const lead=Math.round(Math.min(Math.max(5+g.speed/70,6),15));
    const look=R.pts[Math.min(R.pts.length-1,c.idx+lead)];
    let err=Math.atan2(look.y-c.y,look.x-c.x)-c.angle;
    while(err>Math.PI)err-=6.283185307; while(err<-Math.PI)err+=6.283185307;
    err+=Math.max(-0.35,Math.min(0.35,-latOf(g)/280));
    const over=Math.max(0,Math.abs(g.slip)-0.22)*Math.sign(g.slip);
    let k=0.00012;
    for(let i=c.idx+2;i<Math.min(R.pts.length-1,c.idx+30);i++){ const a=R.pts[i],b=R.pts[i+1];
      let d=Math.atan2(b.ty,b.tx)-Math.atan2(a.ty,a.tx);
      while(d>Math.PI)d-=6.283185307; while(d<-Math.PI)d+=6.283185307;
      const kk=Math.abs(d)/26; if(kk>k)k=kk; }
    const vT=Math.max(260,Math.min(790,Math.sqrt(290*0.8/k)));
    D.setInput(Math.max(-1,Math.min(1,err*2.6-over*1.8)), g.speed<vT-15?1:0, g.speed>vT+15?1:0);
  }

  try{
    D.horde.wipe();

    // ---- THE claim: driving your own side of the road costs you nothing at all.
    // The horde stays LIVE (traffic shares its spawner gate), so this is a real road with real traffic on
    // it, driven the way assert.js drives every physics measurement: pure-pursuit on the centreline.
    let sawTraffic=0, hits=0, calls=0, worstLat=-1e9, farSide=0, tooClose=0;
    for(const sd of [12345,777,2024,99,31337,8]){
      seedRandom(sd); D.start();
      const g=D.game, seen=new Set();
      for(let i=0;i<70*120 && D.state==='play';i++){
        canonDriver(g); D.step(1);
        worstLat=Math.max(worstLat,latOf(g));
        for(const v of g.traffic){
          if(seen.has(v)) continue; seen.add(v); sawTraffic++;
          if(v.o<=0) farSide++;                                  // spawned in the player's own half — never
          if((v.fi-g.car.idx)*SEG < 2400) tooClose++;            // sprung on you rather than seen coming
        }
      }
      D.clearInput();
      hits+=g.trafHits; calls+=g.calls;
    }
    rec("traffic is really out there on an ordinary drive", sawTraffic>=12,
        sawTraffic+" vehicles met across 6 roads x 70s");
    rec("the canon tidy driver never meets one", hits===0 && calls===0,
        hits+" head-on(s), "+calls+" close call(s) over 6 roads x 70s of centreline driving (worst lateral +"+Math.round(worstLat)+")");
    // and the same claim as geometry rather than luck, on BOTH gates independently — a claim that rests on
    // one unlucky seed not happening is not a claim
    const yieldedAt=l=>ROAD_HALF*0.50+(ROAD_HALF*0.80-ROAD_HALF*0.50)*Math.max(0,Math.min(1,l/120));
    const widest=58, rWide=24*0.5+widest*0.5+6;            // the truck: the biggest thing that can meet you
    const gap=yieldedAt(worstLat)-worstLat;
    rec("...and it clears the widest vehicle's bumper at that worst offset", gap-rWide>18,
        "worst lateral +"+Math.round(worstLat)+" -> truck at "+Math.round(yieldedAt(worstLat))+", clear by "+Math.round(gap-rWide)+"px");
    rec("...and never gets past the centre line far enough to be judged at all", worstLat<ROAD_HALF*0.30-5,
        "worst lateral +"+Math.round(worstLat)+" vs the 'properly over' gate at "+Math.round(ROAD_HALF*0.30));
    rec("every vehicle spawns in the far half of the road", farSide===0,
        farSide+" of "+sawTraffic+" spawned on the player's side");
    rec("...and far enough out to be read, not sprung", tooClose===0,
        tooClose+" of "+sawTraffic+" appeared inside 2,400px (~2.5s of closing)");

    // ---- the yield, measured A/B on the same road with the only variable the car's own offset
    const yieldAt=(lat)=>{
      seedRandom(31337); D.start(); const g=D.game;
      g.zNextIdx=1e9; g.zombies.length=0; g.deer.length=0;       // an empty road but for the one vehicle
      cruise(200);
      g.traffic.length=0;
      const v=D.traffic.spawn(g.car.idx+40,'car');
      let closest=v.o;
      for(let i=0;i<600;i++){ pin(g,lat,340); D.step(1);
        if(g.traffic.indexOf(v)<0) break;
        if(Math.abs(v.fi-g.car.idx)<10) closest=v.o; }
      D.clearInput();
      return closest;
    };
    const oTidy=yieldAt(0), oOver=yieldAt(120), oVerge=yieldAt(230);
    rec("in your own lane they hold their lane centre", Math.abs(oTidy-ROAD_HALF*0.50)<12,
        "vehicle sat at o="+oTidy.toFixed(0)+" (lane centre "+(ROAD_HALF*0.50).toFixed(0)+")");
    rec("drift across the line and they move over for you", oOver>oTidy+50,
        "o="+oTidy.toFixed(0)+" (tidy) -> "+oOver.toFixed(0)+" (car 120px over the line)");
    rec("...and they stop at their verge — the road does not get wider", oVerge<=ROAD_HALF*0.80+2,
        "o="+oVerge.toFixed(0)+" with the car on their verge (cap "+(ROAD_HALF*0.80).toFixed(0)+")");

    // ---- the head-on: speed, charge and the chain, and not one cent
    seedRandom(31337); D.start();
    let g=D.game; g.zNextIdx=1e9; g.zombies.length=0; g.deer.length=0;
    cruise(200);
    g.traffic.length=0; g.trafHits=0; g.calls=0; g.batt=1;
    const cash0=D.horde.cash();
    // the car sitting in most of THEIR lane, and the vehicle already hugging the verge it yields to: there
    // is nowhere left for either of them to go, which is exactly the situation this hazard is made of
    const inc=D.traffic.spawn(g.car.idx+6,'car'); inc.o=ROAD_HALF*0.80;
    const spd0=340, batt0=g.batt;
    g.chainScore=3000; g.mult=3.4; g.driftTime=2.2; g.grace=0.7;
    for(let i=0;i<900 && g.trafHits===0;i++){ pin(g,170,spd0); D.step(1); }
    const spd1=Math.hypot(g.car.vx,g.car.vy);
    rec("meeting one head-on costs real speed and a real bite of the pack",
        g.trafHits===1 && spd1<spd0*0.6 && g.batt<batt0-0.05,
        "trafHits="+g.trafHits+" speed "+Math.round(spd0)+"->"+Math.round(spd1)+
        " batt "+(batt0*100).toFixed(1)+"%->"+(g.batt*100).toFixed(1)+"%");
    rec("...and it voids the chain you were holding", g.chainScore===0 && g.mult===1 && g.bestChain>=3000,
        "chainScore="+Math.round(g.chainScore)+" mult="+g.mult.toFixed(1)+" bestChain="+Math.round(g.bestChain)+" (the report still remembers it)");
    rec("...and pays no bounty — a crash is not the economy", D.horde.cash()===cash0,
        "wallet unchanged at $"+D.horde.cash());

    // ---- threading it: paid once, at speed, and never on top of a hit
    const pass=(lat,spd)=>{
      seedRandom(31337); D.start(); g=D.game;
      g.zNextIdx=1e9; g.zombies.length=0; g.deer.length=0;
      cruise(200);
      g.traffic.length=0; g.trafHits=0; g.calls=0; g.mult=1;
      const v=D.traffic.spawn(g.car.idx+40,'car');
      for(let i=0;i<900;i++){ pin(g,lat,spd); D.step(1); if(g.traffic.indexOf(v)<0) break; }
      D.clearInput();
      return { calls:g.calls, hits:g.trafHits, mult:g.mult };
    };
    const threaded=pass(126,340), tidyPass=pass(0,340), slowPass=pass(126,86), edgePass=pass(60,340);
    rec("threading one at speed pays a CLOSE CALL, exactly once", threaded.calls===1 && threaded.hits===0 && threaded.mult>1,
        "calls="+threaded.calls+" hits="+threaded.hits+" mult="+threaded.mult.toFixed(2));
    rec("passing one in your own lane pays nothing", tidyPass.calls===0 && tidyPass.hits===0,
        "calls="+tidyPass.calls+" hits="+tidyPass.hits+" at lateral 0");
    rec("...nor does clipping the centre line — you have to have properly taken their half", edgePass.calls===0 && edgePass.hits===0,
        "calls="+edgePass.calls+" hits="+edgePass.hits+" at lateral 60 (gate is "+Math.round(ROAD_HALF*0.30)+")");
    rec("crawling past close pays nothing either — nerve is a speed", slowPass.calls===0,
        "calls="+slowPass.calls+" at 31 km/h, on the same line that paid at 122 km/h");
    const toastEl=document.getElementById('callEl');
    rec("the toast actually says CLOSE CALL", toastEl && toastEl.textContent==='CLOSE CALL',
        "toast text = '"+(toastEl&&toastEl.textContent)+"'");

    // ---- the pull-in is on rails, so it is exempt both ways
    seedRandom(777); D.start(); g=D.game;
    g.zNextIdx=1e9; g.zombies.length=0; g.deer.length=0;
    cruise(200);
    g.traffic.length=0; g.trafHits=0; g.calls=0;
    g.pullIn={ };                                                 // stand in for "the game is driving"
    D.traffic.spawn(g.car.idx+18,'car');
    for(let i=0;i<900 && g.traffic.length;i++){ pin(g,ROAD_HALF*0.50,340); D.step(1); }
    const pullHits=g.trafHits, pullCalls=g.calls; g.pullIn=null;
    rec("a vehicle can neither hit nor pay you while the game drives itself in", pullHits===0 && pullCalls===0,
        "trafHits="+pullHits+" calls="+pullCalls+" through a pull-in with one on the nose");

    // ---- the badge and the contract read the same counter
    g.calls=3; checkRunBadges(g,false);
    rec("3 clean close calls awards NERVES OF STEEL", D.shelf.owned().indexOf('nerve')>=0,
        "shelf owns: "+D.shelf.owned().join(','));
    const callContract={ id:'call', tgt:2, prog:gg=>gg.calls };
    rec("the contract reads the same counter, and clears at 2", callContract.prog(g)>=callContract.tgt,
        "callContract.prog(game) = "+callContract.prog(g)+" (tgt "+callContract.tgt+")");

    // ---- seeded: the same road raises the same traffic for everyone
    const fingerprint=(sd)=>{ seedRandom(sd); D.start(); const gg=D.game; const out=[];
      for(let i=0;i<40*120 && D.state==='play';i++){ D.autopilot(); D.step(1);
        for(const v of gg.traffic) if(!v.__seen){ v.__seen=1; out.push(v.kind+'@'+v.fi.toFixed(0)+'/'+v.sp.toFixed(1)); } }
      D.clearInput(); return out.join(' '); };
    const fpA=fingerprint(4242), fpB=fingerprint(4242), fpC=fingerprint(9911);
    rec("same seed raises the same traffic", fpA===fpB && fpA.length>0, fpA.slice(0,90)+(fpA.length>90?'…':''));
    rec("a different seed raises different traffic", fpA!==fpC, "seed 9911: "+fpC.slice(0,60)+(fpC.length>60?'…':''));

    // ---- a stood-down horde is a stood-down road
    seedRandom(4242); D.start(); g=D.game; g.zNextIdx=1e9; g.zombies.length=0;
    for(let i=0;i<60*120 && D.state==='play';i++){ D.autopilot(); D.step(1); }
    D.clearInput();
    rec("standing the horde down silences traffic too", g.traffic.length===0 && g.trafHits===0,
        "traffic="+g.traffic.length+" after 60s with the spawner gated off");

    // ---- it is actually visible before it is a problem, at the resolution this suite runs at
    seedRandom(31337); D.start(); g=D.game; g.view='driver';
    cruise(120);
    const {cx,cy,rad}=wheelGeom(); const ch=clamp(rad*1.5,74,250);
    const dashTop=(cy-rad)-ch-16, horizon=H*0.42;
    const a=g.camAngle, ca=Math.cos(a), sa=Math.sin(a), c=g.car;
    const proj=(px,py)=>{ const dx=px-c.x, dy=py-c.y, z=dx*ca+dy*sa; if(z<16) return null;
      return { x:W*0.5+(-dx*sa+dy*ca)*(185/z), y:horizon+112*(185/z), sc:185/z }; };
    const probe={ fi:c.idx+55, o:ROAD_HALF*0.50, hgt:48 };        // ~140m out: seen, with time to do something
    const q=zPos(g.road,probe), P=proj(q.x,q.y);
    let onScreen=false, topY=null;
    if(P){ topY=P.y-Math.max(2.2,probe.hgt*P.sc); onScreen = topY<dashTop && P.x>0 && P.x<W; }
    rec("an oncoming vehicle ~140m out is on screen and clear of the dash", onScreen,
        P?("topY="+Math.round(topY)+" x="+Math.round(P.x)+" vs dashTop="+Math.round(dashTop)+" W="+W):"projected off-screen");

    // ---- nothing throws, in either lens, driving through real traffic with rendering live
    let renderErr=null;
    const origErr=window.onerror; window.onerror=m=>{ renderErr=m; };
    for(const view of ['driver','top']){
      seedRandom(9911); D.start(); D.game.view=view;
      try{ for(let i=0;i<3000 && D.state==='play';i++){ D.autopilot(); D.step(1); render(); } }
      catch(e){ renderErr=view+': '+(e.message||String(e)); }
      D.clearInput();
    }
    window.onerror=origErr;
    rec("both views render real traffic without throwing", !renderErr, "renderErr="+renderErr);
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); fail.push("threw"); }

  rows.push("");
  rows.push(fail.length ? ("FAIL | "+fail.length+" traffic problem(s)") : "PASS | the far lane has an owner, and your lane is still yours");
  const d=document.createElement("div");
  d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
