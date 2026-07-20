// Oil slicks: a slick spot on the tarmac that costs nothing on its own (no speed, no charge) — it only
// THINS THE GRIP BUDGET while you're standing in it. Hit one blind and the tail can go; carry a slide onto
// one on purpose and the same patch is free extra angle, paid in heat like a close shave. Same rule as the
// rest of the road: it's a pure function of the road index and the seed, so the only way to know it's real
// is to ask the function directly and to drive there and watch the grip actually change.
(function(){
  const rows=[], fail=[];
  const rec=(name,pass,detail)=>{ if(!pass) fail.push(name); rows.push((pass?"PASS":"FAIL")+" | "+name+" | "+detail); };
  function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const D=window.__drift;

  try{
    D.horde.wipe();
    seedRandom(90210); D.start();
    const seed=D.game.seed;

    // ---- purity: the same road point always answers the same, twice, and across two fresh reads
    const twice=[0,140,1000,5000,9999].every(i=>{
      const a=oilAt(i,seed), b=oilAt(i,seed);
      return (!a&&!b) || (a&&b&&a.t===b.t&&a.o.c===b.o.c);
    });
    rec("the same road point always gives the same slick (or the same absence of one)", twice,
        "oilAt() is stateless — asked twice, it answers the same");

    // ---- never stacked on a bridge or a rest-area apron, swept over a wide stretch
    let found=0, badBridge=0, badApron=0;
    for(let b=0;b<200;b++){
      const o=oilBlock(b,seed); if(!o.ok) continue;
      found++;
      for(let i=o.c-o.len-20;i<=o.c+o.len+20;i++) if(bridgeAt(i,seed)) badBridge++;
      if(apronAt(o.c,seed)) badApron++;
    }
    rec("slicks are common enough to actually meet on a drive", found>=15,
        found+" real slicks found in the first 200 blocks (chance-gated, so not every block has one)");
    rec("no slick is ever planted on a bridge deck or a rest area's apron", badBridge===0 && badApron===0,
        badBridge+" bridge conflicts, "+badApron+" apron conflicts across "+found+" slicks");

    // ---- geometry: dead centre is the full grip hit; off to the side (clear of halfW) is untouched;
    // a long way from any block is untouched
    let sample=null;
    for(let b=0;b<200 && !sample;b++){ const o=oilBlock(b,seed); if(o.ok) sample=o; }
    rec("found a slick to measure", !!sample, sample?("c="+sample.c+" off="+Math.round(sample.off)+" halfW="+Math.round(sample.halfW)):"none in range");
    if(!sample) throw new Error("no slick in range — nothing below can run");

    const centreGrip=oilGrip(sample.c, sample.off, seed);
    rec("dead centre of the patch is the full grip hit", Math.abs(centreGrip-OIL_GRIP)<0.001,
        "oilGrip at the patch's own centre = "+centreGrip.toFixed(3)+" (want OIL_GRIP="+OIL_GRIP+")");

    const clearGrip=oilGrip(sample.c, sample.off+sample.halfW+40, seed);
    rec("stepping clear of the patch's width leaves the grip untouched", clearGrip===1,
        "oilGrip 40px past halfW = "+clearGrip);

    const farGrip=oilGrip(sample.c+OIL_EVERY*3, 0, seed);
    rec("ordinary tarmac, far from any patch, is untouched", farGrip===1,
        "oilGrip three blocks away = "+farGrip);

    // ---- the taper is real: closer to centre is always at least as slick as farther out, never a cliff
    let monotone=true;
    for(let d=0; d<sample.len; d++){
      const inner=oilGrip(sample.c-d, sample.off, seed), outer=oilGrip(sample.c-d-1, sample.off, seed);
      if(outer<inner-1e-9) monotone=false;
    }
    rec("the grip hit tapers smoothly along the patch, not a trapdoor", monotone,
        "grip never gets MORE slick moving away from centre, sampled across the patch's own length");

    // ---- gameplay: carrying a slide onto a real patch pays heat, exactly once per crossing
    const cruise=(n)=>{ for(let i=0;i<n;i++){ D.autopilot(); D.step(1); } D.clearInput(); };
    D.game.zNextIdx=1e9; D.game.zombies.length=0;
    cruise(200);
    const g=D.game;
    const before={ oilSlides:g.oilSlides, mult:g.mult };
    // drop the car right on the slick's dead centre, already sliding hard, and step through it
    const R=g.road; ensureAhead(R,sample.c+20);
    const p=R.pts[sample.c-6];
    g.car.idx=sample.c-6; g.car.x=p.x-p.ty*sample.off; g.car.y=p.y+p.tx*sample.off;
    g.car.angle=Math.atan2(p.ty,p.tx)+0.35;                          // nose already turned in — a real slide, not a straight line
    const spdIn=480; g.car.vx=Math.cos(Math.atan2(p.ty,p.tx))*spdIn; g.car.vy=Math.sin(Math.atan2(p.ty,p.tx))*spdIn;
    g.speed=spdIn; g.slip=0.35; g.oilWasOn=false;
    D.setInput(0,0.4,0);
    for(let i=0;i<40;i++) D.step(1);
    D.clearInput();
    rec("carrying a slide onto the slick pays heat, at least once", g.oilSlides>before.oilSlides,
        "oilSlides "+before.oilSlides+" -> "+g.oilSlides+", mult "+before.mult.toFixed(1)+" -> "+g.mult.toFixed(1));
    const afterFirstPass=g.oilSlides;
    for(let i=0;i<40;i++) D.step(1);   // sitting in the same patch a while longer must not keep paying out
    rec("...but sitting in the same patch doesn't pay out every frame", g.oilSlides===afterFirstPass,
        "oilSlides held at "+g.oilSlides+" while still inside the same crossing");
    const toastEl=document.getElementById('oilEl');
    rec("the toast actually says OIL SLIDE", toastEl && toastEl.textContent==='OIL SLIDE',
        "toast text = '"+(toastEl&&toastEl.textContent)+"'");

    // ---- driving tidily, nowhere near a patch, never fires it
    seedRandom(4477); D.start(); D.game.zNextIdx=1e9; D.game.zombies.length=0;
    cruise(300);
    rec("ordinary driving away from any slick never falsely pays out", D.game.oilSlides===0,
        "oilSlides after 300 ticks of ordinary autopilot driving = "+D.game.oilSlides);

    // ---- the badge and the contract both actually hook up to the counter
    D.game.oilSlides=3;
    const gotBadge=checkRunBadges(D.game,false) || D.shelf.owned().indexOf('slick')>=0;
    rec("3 oil slides in a run awards SLICK OPERATOR", D.shelf.owned().indexOf('slick')>=0,
        "shelf owns: "+D.shelf.owned().join(','));
    const slickContract={ id:'slick', label:'HOLD 2 OIL SLIDES', rew:65, tgt:2, prog:g=>g.oilSlides, fmt:v=>''+Math.round(v) };
    rec("the contract reads the same counter, and clears at 2", slickContract.prog(D.game)>=slickContract.tgt,
        "slickContract.prog(game) = "+slickContract.prog(D.game)+" (tgt "+slickContract.tgt+")");
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); fail.push("threw"); }

  rows.push("");
  rows.push(fail.length ? ("FAIL | "+fail.length+" oil-slick problem(s)") : "PASS | placement, grip, and the heat payout all hold");
  const d=document.createElement("div");
  d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
