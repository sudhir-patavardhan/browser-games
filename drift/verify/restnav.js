// The dash knows where it's going now: a trip meter for the run, a charger distance on the nav, and a pause
// that will TURN AROUND for a bay you just blew past rather than settling for the hard shoulder. The turn-back
// is the risky bit — a U-turn against the road's grain, driven entirely by the same pure-pursuit that pulls in
// forwards — so what's pinned here is the decision (nearest bay wins, with a margin), the trip (it actually
// arrives, on the apron, at a charger), and the readouts (they count in the same 1px≈0.1m the game counts in).
(function(){
  const rows=[], fail=[];
  const rec=(name,pass,detail)=>{ if(!pass) fail.push(name); rows.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); };
  function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const D=window.__drift;
  const cruise=(n)=>{ for(let i=0;i<n;i++){ D.autopilot(); D.step(1); } D.clearInput(); };

  try{
    D.horde.wipe();

    // ---- the readouts: trip and next-rest, counted on the game's own scale
    seedRandom(4242); D.start(); D.game.zNextIdx=1e9; D.game.zombies.length=0;
    cruise(300);
    const g=D.game;
    rec("the car keeps a charger lookahead at all", !!g.rest,
        "g.rest="+JSON.stringify(g.rest));
    D.hud();
    const tripWant='TRIP '+(g.dist/10000).toFixed(1)+' km';
    rec("the HUD trip meter counts the run in km, 1px = 0.1m", document.getElementById('tripEl').textContent===tripWant,
        "hud says '"+document.getElementById('tripEl').textContent+"', dist says '"+tripWant+"'");
    const rTxt=document.getElementById('restEl').textContent;
    const rWant='⚡ REST '+restFmt((g.rest&&g.rest.ahead!=null)?(g.rest.ahead-g.car.idx)*SEG*0.1:null);
    rec("...and the next rest stop is on it, in metres you can trust", rTxt===rWant,
        "hud says '"+rTxt+"', road says '"+rWant+"'");

    // ---- the schedule: the county builds at the 3rd, 7th, 12th, 18th… km — each gap one km longer —
    // nudged off a river only, never scattered. And each bay has a REAL exit: a tongue that ramps in off
    // the shoulder, a full-width stand, and an end (no apron before the lane starts).
    let sched=true, taper=true, signs=true;
    for(let n=1;n<=4;n++){
      const r=restBlock(n,g.seed), want=Math.round(restKm(n)*KM_PTS);
      if(!r.ok || Math.abs(r.c-want)>180) sched=false;
      const bay=restGeom(r.c,g.seed);
      const lane=restGeom(r.c-r.len-Math.round(REST_IN/2),g.seed);       // half-way down the drive in
      const before=restGeom(r.c-r.len-REST_IN-4,g.seed);                 // upstream of the gore: plain road
      // a real facility: the drive is a lane OFF the road (grass between it and the carriageway), it runs
      // ~200 m, and it ends in a big lot SET BACK from the road — not a widened shoulder
      if(!bay || bay.lane || bay.in<ROAD_HALF+80 || (bay.out-bay.in)<430) taper=false;
      if(!lane || !lane.lane || lane.in<=ROAD_HALF+6 || (lane.out-lane.in)>170) taper=false;
      if(before || REST_IN*SEG*0.1<190) taper=false;
      // every bay announces itself: the gore gantry plus a full 3-2-1 countdown, each post standing on
      // dry land (nudged off a bridge, never dropped) and answering signAt at its own index
      if(!r.signs || r.signs.length!==4) signs=false;
      else for(const s of r.signs){
        const got=signAt(s.at,g.seed);
        if(!got || got.km!==s.km) signs=false;
        for(let j=s.at-8;j<=s.at+8;j++) if(bridgeAt(j,g.seed)) signs=false;
        if(s.km>0 && Math.abs(s.at-(r.c-KM_PTS*s.km))>90) signs=false;   // nudged, not wandered
      }
    }
    rec("bays keep the county's schedule: km 3, 7, 12, 18 (± a nudge off a river)", sched,
        [1,2,3,4].map(n=>{const r=restBlock(n,g.seed);return "n"+n+"@"+r.c+" (milestone "+Math.round(restKm(n)*KM_PTS)+")";}).join(", "));
    rec("each bay is a real facility: a ~200 m drive in, then a big set-back lot", taper,
        "geometry checked before the gore, half-way down the drive, and on the lot, bays 1-4");
    rec("every bay carries its full signage: gore gantry + 3-2-1 km, all on dry land", signs,
        [1,2,3,4].map(n=>"n"+n+":"+restBlock(n,g.seed).signs.map(s=>s.km).sort().join("/")).join("  "));

    // ---- the decision: drive just past a bay, and pause should choose to go BACK to it
    let setup=null;
    for(let guard=0; guard<24000 && !setup; guard++){
      D.autopilot(); D.step(1);
      const c=D.game.car.idx, r=restNear(D.game,520);
      if(r.behind!=null){
        const dB=c-r.behind, dA=r.ahead!=null?r.ahead-c:Infinity;
        if(dB>=50 && dB<=120 && dA>dB+60) setup={bay:r.behind, dB, dA};
      }
    }
    D.clearInput();
    rec("found a road position just past a bay to test from", !!setup,
        setup? ("bay "+setup.bay+" is "+setup.dB+" pts back, next one "+setup.dA+" pts on") : "never happened in 24k ticks");
    if(!setup) throw new Error("no test position — nothing below can run");

    const pick=nextRest(D.game);
    rec("pause picks the bay behind when it's clearly nearer", !!pick && pick.dir===-1 && pick.c===setup.bay,
        "picked "+JSON.stringify(pick)+" want c="+setup.bay+" dir=-1");

    // ---- the trip back: U-turn, run the road down, park ON the apron at a live charger
    const idx0=D.game.car.idx;
    D.pause();
    rec("the pill owns up to the U-turn", document.getElementById('pullPill').textContent==='TURNING BACK…',
        "pill says '"+document.getElementById('pullPill').textContent+"'");
    let n=0; while(D.game.pullIn && D.state==='play' && n<8000){ D.step(1); n++; }
    rec("the car turns around, drives back, and parks", D.state==='paused',
        "state="+D.state+" after "+n+" ticks");
    if(D.state!=='paused') throw new Error("never parked — nothing below can run");
    rec("...at the bay it aimed for, not somewhere en route", Math.abs(D.game.car.idx-setup.bay)<=6,
        "parked at idx "+D.game.car.idx+", bay at "+setup.bay+" (started from "+idx0+")");
    rec("...on the apron, plugged in — going back earns a charger, not a shoulder", !!D.game.parked && D.game.parked.charger===true,
        "parked="+JSON.stringify(D.game.parked));

    // ---- and the ordinary case is untouched: a bay comfortably ahead is still taken forwards
    D.resume();
    seedRandom(777); D.start(); D.game.zNextIdx=1e9; D.game.zombies.length=0;
    cruise(250);
    const fwd=nextRest(D.game);
    rec("with nothing worth turning for, pause still pulls in ahead", !fwd || fwd.dir===1,
        "picked "+JSON.stringify(fwd));
    if(fwd){
      D.pause(); let m=0; while(D.game.pullIn && D.state==='play' && m<4000){ D.step(1); m++; }
      rec("...and that trip still ends parked, same as it ever did", D.state==='paused',
          "state="+D.state+" after "+m+" ticks");
    }
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); fail.push("threw"); }

  rows.push("");
  rows.push(fail.length ? ("FAIL | "+fail.length+" rest-nav problem(s)") : "PASS | the trip meter, the charger distance, and the turn-back all hold");
  const d=document.createElement("div");
  d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
