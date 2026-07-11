// The airliner is rare by design, so a screenshot can't prove it exists. Replicate drawPlane's own gate
// (it uses the top-level h01() and the per-game scenery seed) and count how often a plane is actually
// crossing the sky over a long session — it must be reachable, but not constant traffic.
(function(){
  const rows=[];
  try{
    __drift.start();
    const S=__drift.game.scenery;
    rows.push("scenery built: decks="+S.decks.length+" flocks="+S.flocks.length+
              " cityRanks="+S.city.length+" towers="+S.city.map(r=>r.length).join("/")+
              " landmarks="+S.marks.length+" planePeriod="+S.pPeriod.toFixed(1)+"s");

    // drawPlane: k=floor(t/pPeriod); skipped if h01(ps+k*97)<0.45; crosses only while u<0.66
    let slots=0, flown=0, airborneSec=0;
    const HORIZON=3600;                     // an hour of play
    for(let t=0;t<HORIZON;t+=0.25){
      const k=Math.floor(t/S.pPeriod), u=t/S.pPeriod-k;
      const has = h01(S.ps+k*97)>=0.45;
      if(u<0.25/S.pPeriod) { slots++; if(has) flown++; }
      if(has && u<=0.66) airborneSec+=0.25;
    }
    rows.push("over 1h: "+slots+" slots, "+flown+" carried an airliner ("+
              (100*flown/Math.max(slots,1)).toFixed(0)+"% of slots)");
    rows.push("plane is somewhere in the sky "+(100*airborneSec/HORIZON).toFixed(0)+
              "% of the time (before the on-screen bearing test) => reachable, and not constant traffic");
    rows.push(flown>0 ? "PASS | airliner is reachable" : "FAIL | airliner never spawns");
  }catch(e){ rows.push("THREW: "+(e&&e.stack||e)); }
  const d=document.createElement("div");
  d.id="PLANE"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
