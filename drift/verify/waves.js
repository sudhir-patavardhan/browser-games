// The county radio, held to its word: waves arrive on a seeded schedule, drop a real pack on the road,
// pay DOUBLE while the clock runs, clear for exactly +$120 at five heads, pass quietly at four or
// fewer, and re-arm further down the road. And when a probe stands the horde down, the radio stays off.
(function(){
  const rows=[], fail=[];
  const rec=(name,pass,detail)=>{ if(!pass) fail.push(name); rows.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); };
  function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const D=window.__drift;
  const driveTo=(dist,cap)=>{ for(let i=0;i<(cap||120)*120 && D.state==='play' && D.game.dist<dist; i+=8){
    D.autopilot(); D.setInput(D.game.forceSteer,1,0); D.step(8); } };
  // place one head ON THE CAR'S OWN LINE (the autopilot cuts corners, so road-centre can miss the
  // bumper in a bend), with the rest of the road swept clear so the pay reading is exactly one head.
  const lat=()=>{ const R=D.game.road,c=D.game.car,p=R.pts[c.idx];
    return (c.x-p.x)*(-p.ty)+(c.y-p.y)*(p.tx); };
  const mow=()=>{ for(let a=0;a<4;a++){
      D.game.zombies.length=0;
      const c0=D.horde.run();
      D.horde.spawn(D.game.car.idx+8, lat()); const z=D.game.zombies[0]; z.sp=0;
      const until=D.game.car.idx+12;
      for(let i=0;i<300 && D.game.car.idx<until;i++){ D.autopilot(); D.setInput(D.game.forceSteer,1,0); D.step(1); }
      if(D.horde.run()>c0) return { pay:D.horde.run()-c0, kind:z.kind };
    } return { pay:0, kind:'none' }; };

  try{
    D.horde.wipe(); D.garage.wipe();

    // ---- the schedule is the seed's
    seedRandom(31337); D.start(); const call1=D.game.waveNext;
    seedRandom(31337); D.start();
    rec("the radio keeps a seeded schedule", D.game.waveNext===call1 && call1>11000 && call1<19000,
        "first call at "+Math.round(call1/10000*10)/10+"km, twice over");

    // ---- baseline pay, out of any wave, then the wave arrives
    for(let i=0;i<300;i++){ D.autopilot(); D.setInput(D.game.forceSteer,1,0); D.step(1); }
    const base=mow();
    const basePay=base.pay;
    rec("a quiet road pays base rates", D.game.waveT<=0 && basePay>=25 && basePay<=110,
        "one "+base.kind+", no wave: $"+basePay);
    const zBefore=D.game.zombies.length;
    driveTo(D.game.waveNext+10, 90);
    rec("the wave ARRIVES on schedule", D.game.waveT>0 && D.game.waveT<=18,
        "waveT="+D.game.waveT.toFixed(1)+"s at dist "+(D.game.dist/10000).toFixed(2)+"km");
    rec("it drops a real pack", D.game.zombies.length>=zBefore+5 && D.game.zombies.length<=14,
        zBefore+" -> "+D.game.zombies.length+" shamblers on the road");
    rec("the banner went up", document.getElementById('wavePop').textContent.indexOf('BOUNTY WAVE')>=0,
        "'"+document.getElementById('wavePop').textContent+"'");
    D.hud();
    rec("the HUD counts it down", document.getElementById('waveEl').textContent.indexOf('WAVE')>=0,
        "'"+document.getElementById('waveEl').textContent+"'");

    // ---- double pay, and five heads clears for exactly +$120
    const wv=mow();
    const rankMul={walker:1,runner:2,brute:3,none:0}[wv.kind]||1;
    rec("wave rates are DOUBLE", wv.pay>0 && wv.pay/rankMul>basePay*1.55 && wv.pay/rankMul<basePay*2.6,
        "same mow in-wave: $"+wv.pay+" ("+wv.kind+") vs $"+basePay+" base");
    while(D.game.waveKills<5 && D.game.waveT>0.5) mow();
    rec("five heads inside the window", D.game.waveKills>=5, D.game.waveKills+" kills, "+D.game.waveT.toFixed(1)+"s left");
    const cashPre=D.horde.run();
    D.game.waveT=0.01; D.step(3);
    rec("the clear pays exactly +$120", D.horde.run()-cashPre===120 &&
        document.getElementById('wavePop').textContent.indexOf('CLEARED')>=0,
        "+$"+(D.horde.run()-cashPre)+" · '"+document.getElementById('wavePop').textContent+"'");
    const next=D.game.waveNext;
    rec("the radio re-arms further out", next>D.game.dist+10000, "next call "+((next-D.game.dist)/10000).toFixed(1)+"km ahead");

    // ---- a wave let slip by pays nothing
    D.game.dist=next-50; driveTo(next+10, 30);
    rec("the second wave arrives too", D.game.waveT>0, "waveT="+D.game.waveT.toFixed(1));
    const cashPre2=D.horde.run();
    D.game.waveT=0.01; D.step(3);
    rec("no heads, no bonus", D.horde.run()-cashPre2===0 &&
        document.getElementById('wavePop').textContent.indexOf('PASSED')>=0,
        "'"+document.getElementById('wavePop').textContent+"' and $0");

    // ---- stood down means STOOD DOWN
    seedRandom(31337); D.start(); D.game.zNextIdx=1e9; D.game.zombies.length=0;
    const target=D.game.waveNext+2000;
    driveTo(target, 90);
    rec("when the horde is stood down, the radio is off", D.game.waveT<=0 && D.game.zombies.length===0,
        "drove to "+(D.game.dist/10000).toFixed(2)+"km past the call: no wave, no shamblers");

    D.horde.wipe();
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); fail.push("threw"); }

  rows.push("");
  rows.push(fail.length ? ("FAIL | "+fail.length+" wave problem(s)") : "PASS | the radio keeps its word");
  const d=document.createElement("div");
  d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
