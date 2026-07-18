// The garage, bought and then DRIVEN: wallet cash fits permanent hardware to the car, and each part must
// actually change what the car does — measured A/B on pinned roads with identical forced inputs. Battery
// state never feeds back into the physics (until it hits zero), so a stock run and an upgraded run of the
// same stint are the same trajectory, and the battery arithmetic can be held to tight ratios:
//   - LONG-RANGE PACK (+30%): the same tidy stint drains ~1.3x slower, in %
//   - REGEN TUNE (+50%): the same braking stint shows ~1.5x the peak regen kW, and claws back more charge
//   - TRACK TYRES (+8% grip): the same provoked corner breaks away measurably less
// Plus the shop rules: no credit, no double-buys, fitted for good (survives newGame), stock until paid.
(function(){
  const rows=[], fail=[];
  const rec=(name,pass,detail)=>{ if(!pass) fail.push(name); rows.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); };
  function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const D=window.__drift;

  // The three stints, each fully deterministic under a pinned seed + forced inputs. Each mod is measured
  // FITTED ALONE against stock, so the A/B compares two runs of the exact same trajectory (capacity and
  // regen never steer the car) — which is what lets the pack ratio be held to ±0.02 of its spec.
  const drain=()=>{ seedRandom(12345); D.start(); D.game.zNextIdx=1e9; D.game.zombies.length=0;
    for(let t=0;t<15*120 && D.state==='play';t+=10){ D.autopilot(); D.step(10); }
    return 1-D.game.batt; };
  const braking=()=>{ seedRandom(4242); D.start(); D.game.zNextIdx=1e9; D.game.zombies.length=0;
    // steer the road's own line the whole way (pedals stay forced) — a stint in the weeds measures the
    // off-road burn, not the brakes
    for(let i=0;i<150;i++){ D.autopilot(); D.setInput(D.game.forceSteer,1,0); D.step(1); }
    D.game.batt=0.8; let peak=0;
    for(let i=0;i<240;i++){ D.autopilot(); D.setInput(D.game.forceSteer,0,1); D.step(1); peak=Math.min(peak,D.game.kw); }
    const grass=D.game.onGrass;
    D.clearInput(); return { peak, gain:D.game.batt-0.8, grass }; };
  const corner=()=>{ seedRandom(31337); D.start(); D.game.zNextIdx=1e9; D.game.zombies.length=0;
    for(let i=0;i<350;i++){ D.autopilot(); D.setInput(D.game.forceSteer,1,0); D.step(1); }   // warm up ON the road
    let ms=0; for(let i=0;i<200;i++){ D.setInput(0.62,1,0); D.step(1); ms=Math.max(ms,Math.abs(D.game.slip)); }
    D.clearInput(); return ms; };
  const fitOnly=(id)=>{ D.garage.wipe(); if(id){ D.horde.give(9000); D.garage.buy(id); } };

  try{
    D.horde.wipe(); D.garage.wipe();

    // ---- stock means STOCK
    seedRandom(1); D.start();
    const m0=D.game.mod;
    rec("an unpaid car is the stock car", m0.cap===1 && m0.regen===1 && m0.lat===1,
        "mod={cap:"+m0.cap+", regen:"+m0.regen+", lat:"+m0.lat+"}");
    rec("the garage is on the shop card", document.querySelectorAll('[data-m]').length>=3,
        document.querySelectorAll('[data-m]').length+" mod cards in the DOM");

    // ---- no credit
    const broke=D.garage.buy('pack');
    rec("no cash, no hardware", broke===false && D.garage.owned().length===0,
        "buy returned "+broke+", owned="+D.garage.owned().join(",")+" (wallet $"+D.horde.cash()+")");

    // ---- stock baselines
    const dropStock=drain(), brStock=braking(), slipStock=corner();

    // ---- buy the lot, watch the wallet
    D.horde.give(5000);
    const c0=D.horde.cash();
    const okAll=D.garage.buy('pack') && D.garage.buy('regen') && D.garage.buy('tyres');
    rec("buying fits the part and debits the wallet", okAll && c0-D.horde.cash()===4900,
        "spent $"+(c0-D.horde.cash())+" of $"+c0+" for "+D.garage.owned().join("+"));
    rec("no double-buys", D.garage.buy('pack')===false && D.horde.cash()===c0-4900,
        "second buy refused, wallet still $"+D.horde.cash());
    let stored=''; try{ stored=localStorage.getItem('drift.mods')||''; }catch(e){}
    rec("fitted hardware persists", stored.indexOf('pack')>=0 && stored.indexOf('tyres')>=0,
        "localStorage drift.mods="+stored);
    seedRandom(1); D.start();
    const m1=D.game.mod;
    rec("a fresh run drives on the fitted car", m1.cap===1.30 && m1.regen===1.50 && m1.lat===1.08,
        "mod={cap:"+m1.cap+", regen:"+m1.regen+", lat:"+m1.lat+"}");

    // ---- and each part, fitted ALONE, does what its card says
    fitOnly('pack');
    const dropUp=drain();
    const ratio=dropStock/dropUp;
    rec("LONG-RANGE PACK: the same stint drains 1.3x slower, exactly", ratio>1.28 && ratio<1.32,
        "15s stint: stock -"+(dropStock*100).toFixed(1)+"% vs fitted -"+(dropUp*100).toFixed(1)+"% ("+ratio.toFixed(3)+"x slower — identical trajectory, so the ratio is the spec)");
    fitOnly('regen');
    const brUp=braking();
    const kwRatio=brUp.peak/brStock.peak;
    rec("REGEN TUNE: ~1.5x the peak regen on the same braking", kwRatio>1.45 && kwRatio<1.55,
        "peak "+brStock.peak.toFixed(0)+"kW -> "+brUp.peak.toFixed(0)+"kW ("+kwRatio.toFixed(2)+"x)"+(brStock.grass?" [stint left the road!]":""));
    rec("REGEN TUNE: more charge actually comes back", brUp.gain>brStock.gain,
        "2s of braking: stock "+(brStock.gain*100).toFixed(3)+"% vs tuned "+(brUp.gain*100).toFixed(3)+"%");
    fitOnly('tyres');
    const slipUp=corner();
    rec("TRACK TYRES: the same provoked corner breaks away less", slipUp<slipStock-0.01,
        "max slip "+slipStock.toFixed(3)+" stock vs "+slipUp.toFixed(3)+" on tyres");

    // ---- wipe restores the stock car
    D.garage.wipe(); seedRandom(1); D.start();
    rec("selling up restores the stock car", D.game.mod.cap===1 && D.game.mod.regen===1 && D.game.mod.lat===1,
        "mod all 1 after wipe");
    D.horde.wipe();
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); fail.push("threw"); }

  rows.push("");
  rows.push(fail.length ? ("FAIL | "+fail.length+" garage problem(s)") : "PASS | the garage delivers what it sells");
  const d=document.createElement("div");
  d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
