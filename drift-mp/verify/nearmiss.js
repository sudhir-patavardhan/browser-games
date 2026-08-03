// The CLOSE SHAVE, choreographed: zombies are placed by hand (the spawner is stood down) and the car is
// driven past them at known speeds and offsets. What must hold:
//   - passing a live shambler close (inside BUZZ_R, outside the strike radius) at speed pays a buzz:
//     the counter ticks, the multiplier bumps, the pop shows
//   - passing WIDE pays nothing, passing SLOW pays nothing, and each shambler pays at most once
//   - hitting one is a bounty, not a shave — the two rewards never double up
//   - the grace refresh genuinely BRIDGES a chain: same setup, with and without a shave in the gap,
//     the chain survives only with it
(function(){
  const rows=[], fail=[];
  const rec=(name,pass,detail)=>{ if(!pass) fail.push(name); rows.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); };
  function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const D=window.__drift;
  // the board is settled up front for the same reason the spawner is stood down: this probe's cash
  // arithmetic must be PURE. A seeded contract (e.g. TOUCH 225 km/h) crossing mid-choreography pays real
  // cashRun and fails "a shave is not a kill" on road luck — which is the contracts suite's business, not
  // this one's. (The deer feature shifted the seeded rng universe and surfaced exactly that.)
  const fresh=()=>{ seedRandom(31337); D.start(); D.game.zNextIdx=1e9; D.game.zombies.length=0;
    for(const c of D.game.contracts) c.done=true; };
  const launch=(steps)=>{ for(let i=0;i<steps;i++){ D.autopilot(); D.setInput(D.game.forceSteer,1,0); D.step(1); } };
  // place a shambler `o` px off the road centre a few segments ahead, then drive past it on the line —
  // flat out by default, or coasting (gas 0) so a slow car STAYS slow through the pass
  const pass=(o,coast)=>{ const fi=D.game.car.idx+9;
    D.horde.spawn(fi,o); const z=D.game.zombies[D.game.zombies.length-1];
    z.sp=0; z.dir=1;                                    // nail it to the spot: this is a measurement, not a hunt
    for(let i=0;i<340 && D.game.car.idx<fi+4;i++){ D.autopilot(); D.setInput(D.game.forceSteer,coast?0:1,0); D.step(1); }
    return z; };

  try{
    D.horde.wipe(); D.garage.wipe();

    // ---- the shave itself
    fresh(); launch(400);
    const spd=Math.round(D.game.speed*0.36);
    const m0=D.game.mult, b0=D.game.buzzes;
    pass(85);
    rec("a close pass at speed is a CLOSE SHAVE", D.game.buzzes===b0+1,
        "passed at ~85px off the line doing "+spd+" km/h: buzzes "+b0+" -> "+D.game.buzzes);
    rec("a shave bumps the heat", D.game.mult>=m0+0.4 || D.game.mult===8,
        "mult "+m0.toFixed(1)+" -> "+D.game.mult.toFixed(1));
    rec("the pop fired", document.getElementById('buzzEl').classList.contains('show'),
        "buzzEl text='"+document.getElementById('buzzEl').textContent+"'");
    rec("a shave is not a kill", D.game.zCarKills===0 && D.horde.run()===0,
        "kills="+D.game.zCarKills+" cashRun=$"+D.horde.run());

    // ---- one shave per shambler, even if you linger behind it
    const b1=D.game.buzzes;
    for(let i=0;i<120;i++){ D.autopilot(); D.setInput(D.game.forceSteer,1,0); D.step(1); }
    rec("each shambler pays at most once", D.game.buzzes===b1, "buzzes still "+b1+" after driving on");

    // ---- wide pass: nothing
    fresh(); launch(400);
    pass(230);
    rec("a wide pass is just driving", D.game.buzzes===0, "230px off the line: buzzes="+D.game.buzzes);

    // ---- slow pass: nothing (nerve needs speed)
    fresh(); launch(120);
    for(let i=0;i<200;i++){ D.autopilot(); D.setInput(D.game.forceSteer,0,1); D.step(1); }   // haul it down
    const slowSpd=Math.round(D.game.speed*0.36);
    D.game.stall=0;
    const zs=pass(85,true);
    rec("a slow pass pays nothing", D.game.buzzes===0 && slowSpd<101,
        "braked to "+slowSpd+" km/h, coasted past at "+Math.round((zs.minSpd||0)*0.36)+" km/h: buzzes="+D.game.buzzes);

    // ---- a hit is a bounty, never also a shave
    fresh(); launch(400);
    pass(10);
    rec("a hit pays the bounty, not the shave", D.game.zCarKills===1 && D.game.buzzes===0,
        "kills="+D.game.zCarKills+" buzzes="+D.game.buzzes+" cashRun=$"+D.horde.run());

    // ---- the bridge: a chain that would die in the gap survives if you shave the gap
    const gap=(withZombie)=>{
      fresh(); launch(400);
      D.game.chainScore=900; D.game.mult=3; D.game.grace=0.45; D.game.driftTime=0;   // a drift just ended
      if(withZombie) { const fi=D.game.car.idx+9; D.horde.spawn(fi,85);
        const z=D.game.zombies[D.game.zombies.length-1]; z.sp=0; }
      for(let i=0;i<84;i++){ D.autopilot(); D.setInput(D.game.forceSteer,1,0); D.step(1); }   // 0.7s of straight
      return D.game.chainScore; };
    const without=gap(false), withS=gap(true);
    rec("a shave BRIDGES the chain through the gap", without===0 && withS===900,
        "0.45s of grace + 0.7s of straight: chain dies bare ("+without+") and survives shaved ("+withS+")");

    D.horde.wipe();
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); fail.push("threw"); }

  rows.push("");
  rows.push(fail.length ? ("FAIL | "+fail.length+" near-miss problem(s)") : "PASS | nerve pays, and only nerve");
  const d=document.createElement("div");
  d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
