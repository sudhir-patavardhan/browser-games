// Physics/behaviour assertions, injected into a copy of drift/index.html.
// Sync-only so the rAF loop can't interleave and perturb the sim.
(function(){
  const out=[], errs=[];
  window.onerror=(m,s,l,c,e)=>{ errs.push(String(m)+" @"+l+":"+c); };
  const D=window.__drift, HZ=120;

  // ---------- a scripted driver that actually follows the road ----------
  // Pure-pursuit steering + a countersteer catch, and — crucially — a corner speed ANTICIPATED from the
  // curvature ahead (v <= sqrt(grip/k)), not a fixed number. A fixed target is not a driver: the tightest
  // corners only support ~300px/s at the limit, so a fixed-640 driver is just a scripted crash.
  // `aggr` is how far past the grip limit this driver is willing to arrive: 1.0 = tidy, >1 = sending it.
  function follower(aggr, opts){
    opts=opts||{};
    return function(t,g){
      const R=g.road, c=g.car;
      const p=R.pts[c.idx];
      const lead=Math.round(Math.min(Math.max(5+g.speed/70,6),15));
      const look=R.pts[Math.min(R.pts.length-1,c.idx+lead)];
      const desired=Math.atan2(look.y-c.y, look.x-c.x);
      const nx=-p.ty, ny=p.tx, off=(c.x-p.x)*nx+(c.y-p.y)*ny;
      let err=desired-c.angle; while(err>Math.PI)err-=6.283185307; while(err<-Math.PI)err+=6.283185307;
      err += Math.max(-0.35,Math.min(0.35,-off/280));
      const over=Math.max(0,Math.abs(g.slip)-0.22)*Math.sign(g.slip);   // catch the slide
      const steer=Math.max(-1,Math.min(1, err*2.6 - over*1.8));
      // worst curvature in the next ~30 points — this is the lookahead that lets you brake EARLY
      let k=0.00012;
      for(let i=c.idx+2;i<Math.min(R.pts.length-1,c.idx+30);i++){
        const a=R.pts[i], b=R.pts[i+1];
        let d=Math.atan2(b.ty,b.tx)-Math.atan2(a.ty,a.tx);
        while(d>Math.PI)d-=6.283185307; while(d<-Math.PI)d+=6.283185307;
        const kk=Math.abs(d)/26; if(kk>k) k=kk;
      }
      const grip=290*0.8;                                   // LAT0 * GAS_GRIP, i.e. the budget under power
      const vT=Math.max(260, Math.min(790, Math.sqrt(grip/k)*aggr));
      const tight = k>0.0016;
      let gas=0, brake=0;
      if(g.speed < vT-15) gas=1;
      else if(g.speed > vT+15) brake=1;
      // an aggressive driver stabs the brake on corner entry to rotate the car
      if(opts.stab && tight && g.speed>380 && Math.abs(err)>0.06){ brake=1; gas=0; }
      return [steer,gas,brake];
    };
  }

  // newGame() draws its road seed from Math.random(), so every stint would otherwise get a DIFFERENT road
  // and no A/B comparison would mean anything. Pin it: same seed => same road for every stint.
  function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

  function stint(secs, drive, opts){
    opts=opts||{};
    seedRandom(opts.seed===undefined?12345:opts.seed);
    D.start();
    if(opts.view) D.game.view=opts.view;
    const g=D.game;
    let maxSlip=0, score0=g.score, grassF=0, n=0, alive=true, driftT=0;
    let bigSlip=false, recovered=false;      // did we provoke a real slide, and did it ever come back?
    const N=Math.round(secs*HZ);
    for(let i=0;i<N;i++){
      if(D.state!=='play'){ alive=false; break; }
      const inp=drive(i/HZ, D.game);
      D.setInput(inp[0], inp[1], inp[2]);
      D.step(1);
      const gg=D.game, s=Math.abs(gg.slip);
      if(s>maxSlip) maxSlip=s;
      if(s>0.5) bigSlip=true;
      if(bigSlip && s<0.18 && gg.speed>150) recovered=true;
      if(s>0.16 && gg.speed>240 && !gg.onGrass) driftT+=1/HZ;
      if(gg.onGrass) grassF++;
      n++;
    }
    const g2=D.game;
    return { maxSlip, scoreGain:g2.score-score0, grass:n?grassF/n:0, speed:g2.speed,
             slip:Math.abs(g2.slip), alive: alive && D.state==='play', dist:g2.dist,
             state:D.state, over:g2.overReason||null, driftT, survived:n/HZ, bigSlip, recovered };
  }
  function rec(name, pass, detail){ out.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); }

  // ---- A: hard cornering at speed breaks the tail loose
  const hard = stint(1.2, ()=>[1,1,0]);
  rec("hard corner at speed slides", hard.maxSlip>0.25,
      "maxSlip="+hard.maxSlip.toFixed(3)+" score="+hard.scoreGain.toFixed(0));

  // ---- B/C: tidy vs aggressive, over SEVERAL roads so one lucky seed can't carry the result.
  // The meaningful claim isn't an absolute score, it's the SEPARATION: driving tidily must score
  // ~nothing, and pushing hard must light the board up — on the same road, with the same car.
  const SEEDS=[12345, 777, 2024, 99, 31337, 8];
  const sum=a=>a.reduce((x,y)=>x+y,0);
  const band=(aggr,stab)=>{
    const rs=SEEDS.map(s=>stint(50, follower(aggr,{stab:!!stab}), {seed:s}));
    return { lived:rs.filter(r=>r.alive).length,
             score:sum(rs.map(r=>r.scoreGain))/SEEDS.length,
             drift:sum(rs.map(r=>r.driftT))/SEEDS.length,
             life:sum(rs.map(r=>r.survived))/SEEDS.length,
             maxSlip:Math.max.apply(null,rs.map(r=>r.maxSlip)) };
  };
  const tidy=band(1.00,false);     // stay inside the grip limit
  const push=band(1.15,true);      // lean on it — the intended way to play
  const wild=band(1.45,true);      // send it with no regard for the corner

  rec("tidy driving is safe and scores ~nothing",
      tidy.lived===SEEDS.length && tidy.score<250,
      "survived "+tidy.lived+"/"+SEEDS.length+" roads, avg score="+tidy.score.toFixed(0)+
      " (want <250), drift="+tidy.drift.toFixed(1)+"s");
  // bar is an order of magnitude, not a number plucked from the air: at 1.15x it's ~18x, at 1.20x it's ~85x
  rec("pushing past the grip limit drifts for real and pays 10x+",
      push.drift>4 && push.score > 10*Math.max(tidy.score,1),
      "at 1.15x grip: drift="+push.drift.toFixed(1)+"s/50s (want >4), score="+push.score.toFixed(0)+
      " vs tidy "+tidy.score.toFixed(0)+" ("+(push.score/Math.max(tidy.score,1)).toFixed(0)+"x)");
  rec("pushing is survivable with skill (not a coin flip)",
      push.lived>=Math.ceil(SEEDS.length/2),
      "survived "+push.lived+"/"+SEEDS.length+" roads, avg life="+push.life.toFixed(0)+"s/50s");
  rec("risk is real: recklessness kills you far more than tidiness",
      wild.lived < tidy.lived && wild.life < tidy.life,
      "reckless(1.45x): "+wild.lived+"/"+SEEDS.length+" survived, avg life="+wild.life.toFixed(0)+
      "s  vs tidy: "+tidy.lived+"/"+SEEDS.length+", "+tidy.life.toFixed(0)+"s");

  // ---- D: trail-braking rotates the car more than lifting, at a MATCHED point in the turn.
  // short stab (0.3s), not a long brake — a long brake just scrubs the speed the slide needs.
  const stabOff = stint(0.3, ()=>[0.8,0,0]);
  const stabOn  = stint(0.3, ()=>[0.8,0,1]);
  rec("trail-braking initiates the slide", stabOn.slip > stabOff.slip*1.10,
      "brake-stab slip="+stabOn.slip.toFixed(3)+" (spd "+stabOn.speed.toFixed(0)+") vs lift slip="+
      stabOff.slip.toFixed(3)+" (spd "+stabOff.speed.toFixed(0)+") — want brake >10% more rotation");

  // ---- E: power-on holds the slide; lifting lets it snap back
  const holdGas  = stint(1.9, t => t<0.7 ? [1,0,1] : [0.35,1,0]);
  const holdLift = stint(1.9, t => t<0.7 ? [1,0,1] : [0.35,0,0]);
  rec("power-on holds the slide", holdGas.slip > holdLift.slip,
      "on power="+holdGas.slip.toFixed(3)+" vs coasting="+holdLift.slip.toFixed(3));

  // ---- F: a big slide is catchable. We judge the SLIDE (did countersteer bring it back?), not the
  // eventual barrier — a car provoked into a full-lock slide can still run out of road, and that's the road's
  // doing, not the tyres'. `recovered` = it went past 0.5 rad and came back under 0.18 while still rolling.
  const recov = stint(3.0, (t,g)=> t<0.8 ? [1,0,1] : [-Math.sign(g.slip||1)*0.9, 0.35, 0]);
  rec("a big slide is catchable by countersteer",
      recov.bigSlip && recov.recovered,
      "provoked slide to "+recov.maxSlip.toFixed(2)+" rad; caught it="+recov.recovered+
      " (final slip="+recov.slip.toFixed(3)+")");

  // ---- G: a bang-bang KEYBOARD player (steer is only -1/0/+1) can still hold a line, on every road.
  // this is what the desktop player actually has, and it's the snappiest case to get wrong.
  const kbs = SEEDS.map(s => stint(50, function(t,g){
    const f=follower(1.0,{stab:false})(t,g);
    return [ f[0]>0.30?1:(f[0]<-0.30?-1:0), f[1], f[2] ];   // quantise the steering to keys
  }, {seed:s}));
  const kbLived=kbs.filter(r=>r.alive).length;
  const kbDrift=sum(kbs.map(r=>r.driftT))/SEEDS.length;
  rec("bang-bang keyboard player can hold a line", kbLived>=SEEDS.length-1,
      "survived "+kbLived+"/"+SEEDS.length+" roads :: "+
      kbs.map((r,i)=>SEEDS[i]+":"+(r.alive?"ok":r.over+"@"+r.survived.toFixed(0)+"s")).join(" ")+
      " — and gets "+kbDrift.toFixed(1)+"s of drift for free from snappy ±1 steering");

  // ---- H: pedals do what they say
  const acc = stint(1.5, ()=>[0,1,0]), dec = stint(1.5, ()=>[0,0,1]), cst = stint(1.5, ()=>[0,0,0]);
  rec("throttle accelerates", acc.speed>460, "WOT 1.5s: "+acc.speed.toFixed(0)+" (from 430)");
  rec("brake decelerates but doesn't stop you dead", dec.speed<330 && dec.speed>60,
      "brake 1.5s: "+dec.speed.toFixed(0)+" (want 60..330 — stopping dead makes trail-braking useless)");
  rec("coasting bleeds speed slowly", cst.speed<430 && cst.speed>dec.speed,
      "coast="+cst.speed.toFixed(0)+" vs brake="+dec.speed.toFixed(0));

  // ---- I: no auto-throttle left
  const idle = stint(6, ()=>[0,0,0]);
  rec("no auto-throttle (idling stalls you out)", idle.state==='over' || idle.speed<200,
      "6s no input: speed="+idle.speed.toFixed(0)+" state="+idle.state+" reason="+idle.over);

  const div=document.createElement('div');
  div.id='RESULTS'; div.textContent=out.join("\n"); document.body.appendChild(div);

  // ---- J: driver-view scenery renders without throwing. render() only runs in the game's own rAF loop,
  // so hand back to it, force driver view, and sweep the wheel through a wide yaw arc.
  const errDiv=document.createElement('div');
  errDiv.id='RENDER'; errDiv.textContent='render: (not reached)'; document.body.appendChild(errDiv);
  D.start(); D.game.view='driver';
  let frames=0;
  (function spin(){
    if(D.state!=='play'){ D.start(); D.game.view='driver'; }
    D.autopilot();
    if(frames%90<45) D.game.forceSteer=Math.sin(frames/30);   // force a hard yaw sweep across the panorama
    frames++;
    errDiv.textContent='render: '+frames+' frames, errors='+errs.length+(errs.length?(' :: '+errs.join(' ;; ')):'');
    requestAnimationFrame(spin);
  })();
})();
