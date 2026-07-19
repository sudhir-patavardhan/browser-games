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
