// Pause doesn't freeze the world — the car pulls off at the next rest area, parks, and plugs in. That means
// pausing has a price (you have to get there) and a cost (charging spends score at the game's own drift
// payback rate, run backwards), which is what stops "pause, top up, resume" from deleting the fail state.
(function(){
  const rows=[], fail=[];
  const rec=(name,pass,detail)=>{ if(!pass) fail.push(name); rows.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); };
  function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const D=window.__drift;
  // tidy driving on the road's own line — an off-road straight line was leaving pullInDrive nothing sane
  // to steer back onto, which is not what this probe is testing
  const cruise=(n)=>{ for(let i=0;i<n;i++){ D.autopilot(); D.step(1); } D.clearInput(); };
  // drive to a stop: pull the trigger, then let the car drive itself in until it parks or we give up. Which
  // rest area (or hard shoulder) a given seed's road happens to offer nearby isn't this probe's business —
  // that's covered by knowing the geometry pins down `paved`/`wallAt` (land.js). What has to hold regardless
  // is that asking to stop always ends with the car actually stopped.
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
    const steps=pullIn(4000);
    rec("the car drives itself in and parks", D.state==='paused',
        "reached state="+D.state+" after "+steps+" ticks");
    if(D.state!=='paused') throw new Error("never parked — nothing below can run");

    const cardEl=document.getElementById('pauseCard');
    rec("the pause card is showing, not a full-screen scrim", cardEl && !cardEl.classList.contains('hidden'),
        "pauseCard hidden="+(cardEl&&cardEl.classList.contains('hidden')));
    rec("arriving and parking doesn't trip the spin-out clock", D.game.stall<=0.5,
        "stall="+D.game.stall.toFixed(2)+" state="+D.state);

    // ---- charging math, pinned directly rather than left to whichever stop this seed's road happens to
    // offer: force a charger under the parked car and prove the exchange rate to the point. A big score
    // first, or the floor-at-zero (tested separately, below) would clip the very thing being measured.
    D.game.parked={ charger:true, taken:0, paid:0 };
    D.game.batt=0.40; D.game.score=1e6;
    const score0=D.game.score;
    D.charge(10);
    const gained=D.game.batt-0.40, spent=score0-D.game.score;
    rec("sitting at the post fills the pack", gained>0.001, "10s at the post: 40.0% -> "+(D.game.batt*100).toFixed(1)+"%");
    rec("...and it isn't free — it costs score at the drift payback rate (11,000 pts/pack)", Math.abs(spent-gained*11000)<1,
        "gained "+(gained*100).toFixed(2)+"% for "+spent.toFixed(0)+" pts (want "+(gained*11000).toFixed(0)+")");

    // ---- it tapers off and stops at the cap rather than filling to a full tank
    D.charge(600);
    rec("charging tapers off at the cap, not a full tank", D.game.batt>=0.79 && D.game.batt<=0.81,
        "batt settled at "+(D.game.batt*100).toFixed(1)+"% (cap 80%)");
    const scoreAtCap=D.game.score;
    D.charge(30);
    rec("once capped, sitting there costs nothing more", D.game.score===scoreAtCap,
        "score unchanged at "+D.game.score+" after 30 more seconds parked");

    // ---- score never goes negative, even charging on empty pockets
    D.game.parked={ charger:true, taken:0, paid:0 }; D.game.batt=0.10; D.game.score=5;
    D.charge(5);
    rec("score floors at zero, it never goes negative", D.game.score>=0 && D.game.batt>0.10,
        "score="+D.game.score+" batt="+(D.game.batt*100).toFixed(1)+"%");

    // ---- no post, no free charge — the hard shoulder doesn't quietly become a charger
    D.game.parked={ charger:false, taken:0, paid:0 }; D.game.batt=0.30;
    const batt1=D.game.batt, score1=D.game.score;
    D.charge(10);
    rec("no charger on the hard shoulder means no free charge", D.game.batt===batt1 && D.game.score===score1,
        "batt unchanged ("+(D.game.batt*100).toFixed(1)+"%), score unchanged ($"+D.game.score+")");

    // ---- resume hands the wheel back and clears the parked state
    D.resume();
    rec("resume hands the wheel back", D.state==='play' && !D.game.parked,
        "state="+D.state+" parked="+D.game.parked);
    const spdBefore=D.game.speed;
    D.setInput(0,1,0); D.step(60); D.clearInput();
    rec("...and the car actually drives again", D.game.speed>spdBefore,
        "speed "+spdBefore.toFixed(0)+" -> "+D.game.speed.toFixed(0));

    // ---- running the pack dry mid-drive still ends the run cleanly with no pause state left dangling
    D.game.batt=0.02;
    for(let i=0;i<8*120 && D.state==='play';i++){ D.setInput(1,1,0); D.step(1); }   // off-road burn, same as assert.js
    D.clearInput();
    rec("running dry still ends the run, pause state and all", D.state==='over' && !D.game.pullIn && !D.game.parked,
        "state="+D.state+" pullIn="+D.game.pullIn+" parked="+D.game.parked);
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); fail.push("threw"); }

  rows.push("");
  rows.push(fail.length ? ("FAIL | "+fail.length+" pause/charging problem(s)") : "PASS | pulling in and charging up hold together");
  const d=document.createElement("div");
  d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
