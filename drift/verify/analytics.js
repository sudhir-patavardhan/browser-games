// Analytics, which is the least important code in the repo and the only code that depends on a third party
// being reachable. So the claims are mostly about what it must NOT do:
//   - on file:// it must be completely silent: no gtag, no dataLayer, no script tag, no network. That is
//     both honest (GA4 has no stable client_id without a cookie, and file: origins get none) and
//     load-bearing — these probes drive the page from file:// under Chrome's virtual clock, and a pending
//     request can stall it
//   - the game must never be able to tell whether analytics worked. track() with the transport missing,
//     with a gtag that throws, with circular params — none of it may reach the game loop
//   - and then the part that has to be RIGHT: a real run, driven to a real death, reports a run_end whose
//     numbers match the run's own state and whose reason is the actual reason
//
// This probe asserts against the LOCAL log (bgAnalytics.log), which analytics.js keeps whether or not a hit
// went out. That is the point of the log: what the game believes it reported is checkable without a network.
(function(){
  const rows=[], fail=[];
  const rec=(name,pass,detail)=>{ if(!pass) fail.push(name); rows.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); };
  function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const D=window.__drift, A=window.bgAnalytics;

  try{
    // ---- it loaded at all, from the game's own folder
    rec("the shared analytics file is actually wired into the game", !!A && typeof window.bgTrack==='function',
        "bgAnalytics="+(!!A)+" bgTrack="+(typeof window.bgTrack)+" id="+(A&&A.id));
    rec("...carrying the measurement ID", !!A && /^G-[A-Z0-9]+$/.test(A.id), "id="+(A&&A.id));

    // ---- silent on file://, which is where this suite runs
    rec("on a file:// page it does not go live", location.protocol!=='file:' || (A && A.live()===false),
        "protocol="+location.protocol+" live="+(A&&A.live()));
    rec("...and injects no gtag tag, no dataLayer, no request",
        location.protocol!=='file:' ||
          (!window.dataLayer && typeof window.gtag!=='function' &&
           document.querySelectorAll('script[src*="googletagmanager"]').length===0),
        "dataLayer="+(typeof window.dataLayer)+" gtag="+(typeof window.gtag)+
        " gtm tags="+document.querySelectorAll('script[src*="googletagmanager"]').length);

    // ---- track() cannot be made to throw, however badly it is called
    let threw=null;
    try{
      window.bgTrack();                                   // no name at all
      window.bgTrack('x');                                // no params
      window.bgTrack('x', null);
      const circ={}; circ.self=circ; window.bgTrack('x', circ);   // unserialisable
      const evil={}; Object.defineProperty(evil,'boom',{ get(){ throw new Error('nope'); }, enumerable:true });
      window.bgTrack('x', evil);                          // a param that throws on read
    }catch(e){ threw=e.message||String(e); }
    rec("track() swallows everything — no call shape can throw at a game", threw===null, "threw="+threw);

    // ---- and it still cannot throw when the transport itself is broken
    const savedGtag=window.gtag, savedLive=A.live();
    threw=null;
    try{
      window.gtag=function(){ throw new Error('ad blocker ate it'); };
      window.bgTrack('transport_test', { a:1 });
    }catch(e){ threw=e.message||String(e); }
    if(savedGtag===undefined) delete window.gtag; else window.gtag=savedGtag;
    rec("...and a gtag that throws is swallowed too", threw===null && A.last('transport_test')!==null,
        "threw="+threw+" (still logged locally: "+(A.last('transport_test')!==null)+")");

    // ---- the local log is a ring, so a long session cannot grow it without bound
    A.clear();
    for(let i=0;i<260;i++) window.bgTrack('flood', { i });
    const flooded=A.log();
    rec("the local log is capped, so a long session can't leak memory",
        flooded.length<=200 && flooded[flooded.length-1].params.i===259,
        "kept "+flooded.length+" of 260, newest is i="+flooded[flooded.length-1].params.i);

    // ---- starting a run reports what KIND of run it is
    A.clear(); D.shelf.wipe(); D.horde.wipe(); D.garage.wipe();
    seedRandom(31337); D.start();
    const rs=A.last('run_start');
    rec("starting a run reports run_start, with the mode",
        !!rs && rs.params.mode==='endless' && rs.params.guns_owned===0,
        rs? JSON.stringify(rs.params) : "no run_start logged");

    // ---- a REAL death reports a run_end whose numbers are the run's own
    const g=D.game;
    g.zNextIdx=1e9; g.zombies.length=0; g.deer.length=0;   // a clean road, so the numbers are readable
    for(let i=0;i<40*120 && D.state==='play';i++){ D.autopilot(); D.step(1); }
    D.clearInput();
    g.batt=0.004; D.setInput(0,1,0);                        // run the pack flat: a real OUT OF CHARGE
    for(let i=0;i<2400 && D.state==='play';i++) D.step(1);
    D.clearInput();
    const re=A.last('run_end');
    rec("the run really ended, and reported it", D.state==='over' && !!re,
        "state="+D.state+" run_end="+(!!re));
    rec("...with the actual reason it ended", !!re && re.params.reason===D.game.overReason,
        "reported '"+(re&&re.params.reason)+"' vs the game's '"+D.game.overReason+"'");
    // compared against the run's FINAL state, not a snapshot taken earlier — the car goes on driving while
    // the pack empties, so anything sampled before the death is a different run to the one being reported
    const f=D.game;
    rec("...and numbers that match the run, not invented ones",
        !!re && Math.abs(re.params.distance_km - f.dist/10000)<0.02 &&
                Math.abs(re.params.top_speed - Math.round(f.vmax*0.36))<=1 &&
                Math.abs(re.params.duration_s - Math.round(f.time))<=1 &&
                re.params.score===Math.round(f.score) && re.params.mode==='endless',
        re? ("distance_km="+re.params.distance_km+" (run "+(f.dist/10000).toFixed(2)+") top_speed="+
             re.params.top_speed+" (run "+Math.round(f.vmax*0.36)+") duration_s="+re.params.duration_s+
             " (run "+Math.round(f.time)+") score="+re.params.score+" (run "+Math.round(f.score)+")") : "-");
    rec("...and every value is a scalar GA4 can actually store", !!re &&
        Object.keys(re.params).every(k=>{ const v=re.params[k];
          return (typeof v==='number' && isFinite(v)) || (typeof v==='string' && v.length<=100); }),
        re? (Object.keys(re.params).length+" params, all numbers or short strings") : "-");
    rec("...reported exactly once for the run", A.log().filter(e=>e.name==='run_end').length===1,
        A.log().filter(e=>e.name==='run_end').length+" run_end event(s)");

    // ---- the daily mode is distinguishable, which is the whole point of having the field
    A.clear(); D.startDaily();
    const rsd=A.last('run_start');
    rec("a daily run is reported as a daily run", !!rsd && rsd.params.mode==='daily',
        rsd? JSON.stringify(rsd.params) : "no run_start logged");

    // ---- the economy's sinks, and the shelf
    A.clear(); D.horde.give(3000); D.horde.buy('p9');
    const sb=A.last('shop_buy');
    rec("buying from the armory reports the sink and what was left",
        !!sb && sb.params.kind==='gun' && sb.params.item==='p9' && sb.params.price===250 && sb.params.cash_left>=0,
        sb? JSON.stringify(sb.params) : "no shop_buy logged");
    A.clear(); D.garage.buy('pack');
    const mb=A.last('shop_buy');
    rec("...and so does the garage", !!mb && mb.params.kind==='mod' && mb.params.item==='pack',
        mb? JSON.stringify(mb.params) : "no shop_buy logged");
    // wipe first: the run above touched 225 km/h, so 225 CLUB is already on the shelf and awardBadge would
    // (correctly) do nothing. A test of "reports it once" has to start from not owning it.
    D.shelf.wipe(); A.clear();
    awardBadge('tonup');
    const bd=A.last('badge_earned');
    rec("earning a badge reports it once", !!bd && bd.params.badge==='tonup',
        bd? JSON.stringify(bd.params) : "no badge_earned logged");
    A.clear(); awardBadge('tonup');
    rec("...and re-awarding the same badge reports nothing", A.last('badge_earned')===null,
        "events after a duplicate award: "+A.log().length);

    D.horde.wipe(); D.garage.wipe(); D.shelf.wipe();
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); fail.push("threw"); }

  rows.push("");
  rows.push(fail.length ? ("FAIL | "+fail.length+" analytics problem(s)") : "PASS | it measures the run and cannot touch it");
  const d=document.createElement("div");
  d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
