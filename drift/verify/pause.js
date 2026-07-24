// Pause doesn't freeze the world — the car pulls off at the next rest area, parks, and plugs in. That means
// pausing has a price (you have to get there) and a cost: the charger is a METERED DC fast-charge post that
// bills the WALLET per kWh as the energy flows — hookup fee, taper, idle fees and all — which is what stops
// "pause, top up, resume" from deleting the fail state. No money, no electrons.
(function(){
  const rows=[], fail=[];
  const rec=(name,pass,detail)=>{ if(!pass) fail.push(name); rows.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); };
  function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const D=window.__drift;
  // tidy driving on the road's own line — an off-road straight line was leaving pullInDrive nothing sane
  // to steer back onto, which is not what this probe is testing
  const cruise=(n)=>{ for(let i=0;i<n;i++){ D.autopilot(); D.step(1); } D.clearInput(); };
  // drive to a stop: pull the trigger, then let the car drive itself in until it parks or we give up. The
  // budget is big now on purpose: the facility's own 10 km/h limit makes the last leg a long, slow crawl.
  const pullIn=(budget)=>{ D.pause(); let n=0; while(D.game.pullIn && D.state==='play' && n<budget){ D.step(1); n++; } return n; };

  try{
    D.horde.wipe();

    // ---- asking to stop sends the car looking for somewhere to do it, hands off the wheel
    seedRandom(777); D.start(); D.game.zNextIdx=1e9; D.game.zombies.length=0;
    cruise(250);           // get up to a real cruising speed first, actually following the road
    const before=D.state;
    D.pause();
    rec("pause sends the car looking for somewhere to stop", before==='play' && !!D.game.pullIn && D.state==='play',
        "pullIn target set: "+JSON.stringify(!!D.game.pullIn));

    // ---- pressing it again on the way in cancels the trip, no stop made
    const hadTarget=!!D.game.pullIn;
    D.pause();
    rec("asking again on the way in cancels the trip", hadTarget && !D.game.pullIn && D.state==='play',
        "pullIn cleared, state="+D.state);

    // ---- it actually arrives and parks (state -> paused), all under its own steering, whatever the road
    // nearby actually offers (a real bay or, failing that, the shoulder)
    const steps=pullIn(40000);
    rec("the car drives itself in and parks", D.state==='paused',
        "reached state="+D.state+" after "+steps+" ticks");
    if(D.state!=='paused') throw new Error("never parked — nothing below can run");

    const cardEl=document.getElementById('pauseCard');
    rec("the pause card is showing, not a full-screen scrim", cardEl && !cardEl.classList.contains('hidden'),
        "pauseCard hidden="+(cardEl&&cardEl.classList.contains('hidden')));
    rec("arriving and parking doesn't trip the spin-out clock", D.game.stall<=0.5,
        "stall="+D.game.stall.toFixed(2)+" state="+D.state);

    // ---- the METER, pinned directly rather than left to whichever stop this seed's road happens to offer:
    // force a charger under the parked car, fund the wallet, and prove every line of the bill. The pack is
    // PACK_KWH·mod.cap; energy delivered is metered in kWh and billed at CHG_PRICE_KWH plus the one-off
    // hookup fee — out of the WALLET, never out of the score.
    const packK=PACK_KWH*D.game.mod.cap;
    D.game.parked={ charger:true, kwh:0, cost:0, idle:0, plugged:false };
    D.game.batt=0.40; D.game.score=1e6; D.horde.give(200);
    const score0=D.game.score, cash0=D.horde.cash();
    D.charge(10);
    const gained=D.game.batt-0.40, spent=cash0-D.horde.cash(), P=D.game.parked;
    rec("sitting at the post fills the pack", gained>0.001, "10s at the post: 40.0% -> "+(D.game.batt*100).toFixed(1)+"%");
    rec("...and the meter counts it in real kWh", Math.abs(P.kwh-gained*packK)<0.01,
        "meter says "+P.kwh.toFixed(2)+" kWh, the pack gained "+(gained*packK).toFixed(2));
    rec("...billed to the wallet: $"+CHG_PRICE_KWH.toFixed(2)+"/kWh + $"+CHG_HOOKUP.toFixed(2)+" hookup",
        Math.abs(spent-(P.kwh*CHG_PRICE_KWH+CHG_HOOKUP))<0.02 && Math.abs(spent-P.cost)<0.02,
        "wallet paid $"+spent.toFixed(2)+" for "+P.kwh.toFixed(2)+" kWh (want $"+(P.kwh*CHG_PRICE_KWH+CHG_HOOKUP).toFixed(2)+")");
    rec("...and the score is never touched", D.game.score===score0,
        "score still "+D.game.score);

    // ---- it tapers off and stops at the cap rather than filling to a full tank
    D.charge(600);
    rec("charging tapers off at the cap, not a full tank", D.game.batt>=0.79 && D.game.batt<=0.81,
        "batt settled at "+(D.game.batt*100).toFixed(1)+"% (cap 80%)");

    // ---- idle billing: a grace long enough to read the receipt, then the network charges by the minute
    P.idle=0; const cashCap=D.horde.cash();
    D.charge(20);
    rec("once capped, the grace period costs nothing", Math.abs(D.horde.cash()-cashCap)<0.001,
        "wallet unchanged at $"+D.horde.cash().toFixed(2)+" after 20s (grace is "+IDLE_GRACE+"s)");
    P.idle=0; const cashIdle=D.horde.cash();
    D.charge(IDLE_GRACE+60);
    const idlePaid=cashIdle-D.horde.cash();
    rec("...but squatting on the post past it bills the idle fee", Math.abs(idlePaid-IDLE_FEE_MIN)<0.03,
        "a minute past grace cost $"+idlePaid.toFixed(2)+" (fee $"+IDLE_FEE_MIN.toFixed(2)+"/min)");

    // ---- no money, no electrons — an empty wallet stops the meter, it never goes negative
    D.horde.wipe();
    D.game.parked={ charger:true, kwh:0, cost:0, idle:0, plugged:false }; D.game.batt=0.10;
    D.charge(5);
    rec("an empty wallet stops the meter dead", D.game.batt===0.10 && D.horde.cash()===0 && D.game.parked.cost===0,
        "batt "+(D.game.batt*100).toFixed(1)+"%, wallet $"+D.horde.cash()+", session $"+D.game.parked.cost);

    // ---- no post, no charge — the hard shoulder doesn't quietly become a charger
    D.horde.give(50);
    D.game.parked={ charger:false, kwh:0, cost:0, idle:0, plugged:false }; D.game.batt=0.30;
    const batt1=D.game.batt, cash1=D.horde.cash();
    D.charge(10);
    rec("no charger on the hard shoulder means no charge and no bill", D.game.batt===batt1 && D.horde.cash()===cash1,
        "batt unchanged ("+(D.game.batt*100).toFixed(1)+"%), wallet unchanged ($"+D.horde.cash().toFixed(2)+")");

    // ---- resume from a hard-shoulder stop (which is what this seed's road offered) hands the wheel
    // straight back — no facility under the car means no valet trip out
    D.resume();
    rec("resume from the shoulder hands the wheel straight back", D.state==='play' && !D.game.parked && !D.game.pullOut,
        "state="+D.state+" parked="+D.game.parked+" pullOut="+D.game.pullOut);
    const spdBefore=D.game.speed;
    D.setInput(0,1,0); D.step(120); D.clearInput();
    rec("...and the car actually drives again", D.game.speed>spdBefore,
        "speed "+spdBefore.toFixed(0)+" -> "+D.game.speed.toFixed(0));

    // ---- the pack doesn't die quietly: one warning at a quarter, an alarm at the last tenth, re-armed
    // by charging back up — and the top-view HUD wears the number in colour
    const bp=document.getElementById('battPop'), be=document.getElementById('battEl');
    D.game.batt=0.60; D.game.battWarn=0; D.step(1);
    D.game.batt=0.24; D.step(1); D.hud();
    rec("the low-charge warning fires at a quarter pack", D.game.battWarn===1 && bp.classList.contains('show') && !bp.classList.contains('crit'),
        "battWarn="+D.game.battWarn+" pop='"+bp.textContent+"'");
    rec("...and the HUD charge readout turns amber", be.textContent.indexOf('⚡ CHARGE')===0 && be.style.color!=='',
        "battEl='"+be.textContent+"' color='"+be.style.color+"'");
    D.game.batt=0.09; D.step(1);
    rec("the alarm goes critical at the last tenth", D.game.battWarn===2 && bp.classList.contains('crit'),
        "battWarn="+D.game.battWarn+" pop='"+bp.textContent+"'");
    D.game.batt=0.70; D.step(1);
    rec("charging back up re-arms the alarm", D.game.battWarn===0, "battWarn="+D.game.battWarn);

    // ---- running the pack dry mid-drive still ends the run cleanly with no pause state left dangling
    D.game.batt=0.02;
    for(let i=0;i<8*120 && D.state==='play';i++){ D.setInput(1,1,0); D.step(1); }   // off-road burn, same as assert.js
    D.clearInput();
    rec("running dry still ends the run, pause state and all", D.state==='over' && !D.game.pullIn && !D.game.pullOut && !D.game.parked,
        "state="+D.state+" pullIn="+D.game.pullIn+" pullOut="+D.game.pullOut+" parked="+D.game.parked);

    // ---- AUTO-PARK: drive onto a services' own pavement and the valet takes the wheel, idles the car down
    // to the facility's 10 km/h, parks it in a stall at a live charger — and the meter is ready to run
    seedRandom(2024); D.start(); D.game.zNextIdx=1e9; D.game.zombies.length=0;
    const g2=D.game, r1=restBlock(1,g2.seed);
    if(!r1.ok) throw new Error("seed 2024 built no bay 1 — pick another seed");
    const li=r1.c-r1.len-Math.round(REST_IN/2);           // half-way down the drive in, lane fully detached
    ensureAhead(g2.road, li+2);                           // make sure the road exists out there
    const gm=restGeom(li,g2.seed), pp=g2.road.pts[li];
    const off=gm.path*gm.side;
    g2.car.idx=li; g2.car.x=pp.x-pp.ty*off; g2.car.y=pp.y+pp.tx*off;
    g2.car.angle=Math.atan2(pp.ty,pp.tx);
    g2.car.vx=pp.tx*380; g2.car.vy=pp.ty*380; g2.speed=380; g2.slip=0;
    D.step(3);
    rec("driving into the exit hands the wheel to the valet", !!g2.pullIn && g2.pullIn.auto===true,
        "pullIn="+JSON.stringify(g2.pullIn));
    D.step(260);
    rec("...which takes the speed down to the facility's 10 km/h", D.state!=='play' || g2.speed<=REST_LIMIT+4,
        "speed "+g2.speed.toFixed(0)+"px/s ("+Math.round(g2.speed*0.36)+" km/h) after ~2s on the drive, limit "+REST_LIMIT);
    let k=0; while(g2.pullIn && D.state==='play' && k<40000){ D.step(1); k++; }
    rec("...and ends parked in a stall at a live charger, meter ready", D.state==='paused' && !!g2.parked && g2.parked.charger===true,
        "state="+D.state+" after "+k+" ticks, parked="+JSON.stringify(g2.parked));
    D.horde.give(100); g2.batt=Math.min(g2.batt,0.5); const b2=g2.batt;
    D.charge(5);
    rec("...and charging starts on its own money meter, no extra ceremony", g2.parked.kwh>0 && g2.parked.cost>0,
        "5s parked: "+g2.parked.kwh.toFixed(2)+" kWh for $"+g2.parked.cost.toFixed(2)+" (batt "+(b2*100).toFixed(0)+"% -> "+(g2.batt*100).toFixed(0)+"%)");

    // ---- and resume from a REAL lot is the full valet exit: across the lot, up the out-drive, and the
    // wheel handed back only once the car is back in the traffic lane
    D.resume();
    rec("resume from the lot sends the car to see itself out", D.state==='play' && !!g2.pullOut,
        "state="+D.state+" pullOut="+JSON.stringify(!!g2.pullOut));
    let m2=0; while(g2.pullOut && D.state==='play' && m2<40000){ D.step(1); m2++; }
    const c2=g2.car, p2=g2.road.pts[c2.idx];
    const latOut=Math.abs((c2.x-p2.x)*(-p2.ty)+(c2.y-p2.y)*p2.tx);
    rec("...and the trip out ends back in the traffic lane, wheel returned", !g2.pullOut && D.state==='play' && latOut<ROAD_HALF,
        "pullOut done after "+m2+" ticks, "+latOut.toFixed(0)+"px off centre (road half "+ROAD_HALF+")");
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); fail.push("threw"); }

  rows.push("");
  rows.push(fail.length ? ("FAIL | "+fail.length+" pause/charging problem(s)") : "PASS | pulling in, the metered charge, and the drive back out all hold");
  const d=document.createElement("div");
  d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
