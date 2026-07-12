// The landscape: rivers, the bridges that span them, and the woods that thicken as you get out of town.
//
// None of it is stored — it's a pure function of the road index and the seed, so the only way to know a river
// is really there is to go and stand on it. This probe drives to one, renders the frame the player would see,
// and READS THE PIXELS BACK. A count on its own means nothing (the sky is blue too), so every pixel claim is
// made as a DELTA against a control frame shot on open road with no river in sight.
//
// What it cannot tell you: whether any of it is pretty. Look at shoot.sh's screenshots for that.
(function(){
  const rows=[], fail=[];
  const rec=(n,pass,d)=>{ if(!pass) fail.push(n); rows.push((pass?"PASS":"FAIL")+" | "+n+" | "+d); };
  const errs=[]; window.onerror=(m,s,l,c)=>{ errs.push(String(m)+" @"+l+":"+c); };
  const D=window.__drift;

  // pin the seed: the road is drawn from Math.random(), so an unpinned run measures a different world each time
  let a=20260712; Math.random=function(){ a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
  D.start();
  const g=D.game, seed=g.seed;
  g.view='driver';

  /* ---------- 1. the world is a function, not a memory ---------- */
  const twice=[0,137,470,941,2000].every(i=>{
    const x=bridgeAt(i,seed), y=bridgeAt(i,seed);
    return (!x&&!y) || (x&&y&&x.d===y.d&&x.span===y.span);
  });
  rec("the same road point always gives the same world", twice,
      "bridgeAt() is stateless — asked twice, it answers the same, so the far bank matches the near one");

  /* ---------- 2. the bridge covers every inch of the water ---------- */
  // The one thing that must never happen: a road point over open water with no deck under it. The water runs
  // +/- half points either side of the crossing and the deck +/- (half + BRIDGE_PAD), so the deck strictly
  // contains the river. Check it against every river in the first 40 blocks, not just the one we drive to.
  let gaps=0, rivers=0, narrowest=1e9;
  for(let b=0;b<40;b++){
    const r=riverBlock(b,seed); rivers++;
    narrowest=Math.min(narrowest,r.half);
    for(let i=Math.floor(r.c-r.half-2); i<=Math.ceil(r.c+r.half+2); i++){
      const overWater=Math.abs(i-r.c)<=r.half;                 // the water, in road points
      if(overWater && !bridgeAt(i,seed)) gaps++;               // ...and nothing to drive on
    }
  }
  rec("no stretch of water is left without a bridge over it", gaps===0,
      rivers+" rivers checked, "+gaps+" road points over open water with no deck (want 0); "+
      "narrowest river "+narrowest.toFixed(1)+" points");

  /* ---------- 3. rivers keep coming, and they aren't all the same river ---------- */
  const blocks=[]; for(let b=0;b<12;b++) blocks.push(riverBlock(b,seed));
  const spacings=blocks.slice(1).map((r,i)=>r.c-blocks[i].c);
  const varied=new Set(blocks.map(r=>Math.round(r.half))).size;
  rec("rivers recur, and each is cut differently", spacings.every(s=>s>200) && varied>=3,
      "gaps between crossings "+Math.min(...spacings)+".."+Math.max(...spacings)+" road points, "+
      varied+" distinct widths across 12 rivers");

  /* ---------- 4. what a tree knows about water ---------- */
  // Trees are placed by formula and refuse to take root in the river. That refusal leans entirely on wet(),
  // so pin its contract: the middle of a river is wet, and open road a long way from one is not.
  const rv=nearRivers(g,80,3000);
  const mid=rv.length? rv[0] : null;
  const dryPt=(()=>{ for(let i=g.car.idx;i<g.road.pts.length;i++){ if(!bridgeAt(i,seed) && !bridgeAt(i+40,seed) && !bridgeAt(i-40,seed)) return g.road.pts[i]; } return null; })();
  rec("the water knows what is standing in it",
      !!mid && wet(rv,mid.p.x,mid.p.y,0) && !!dryPt && !wet(rv,dryPt.x,dryPt.y,0),
      mid? "the middle of a river reads wet, and open road well clear of one reads dry" : "no river found to test");

  /* ---------- 5. the woods thicken as you get out of town ---------- */
  const f0=forestAt(0,seed), fLate=[];
  for(let i=2600;i<9000;i+=100) fLate.push(forestAt(i,seed));
  const peak=Math.max(...fLate), inRange=fLate.every(v=>v>=0&&v<=1);
  rec("you start in open country and drive into the trees", f0===0 && peak>0.5 && inRange,
      "density 0.00 at the start, peaking at "+peak.toFixed(2)+" out on the road (all values within 0..1)");

  /* ---------- the pixels: three frames, and what changed between them ---------- */
  // Count only BELOW the horizon. Above it is sky, which is also blue — counting it would let a frame with no
  // river in it "pass" a water test forever.
  const horizonPx=Math.round(H*HORIZON_F*DPR);
  function shot(){
    render();
    const px=ctx.getImageData(0,horizonPx,cv.width,cv.height-horizonPx).data;
    let water=0, magenta=0;
    for(let i=0;i<px.length;i+=4){
      const r=px[i], gg=px[i+1], b=px[i+2];
      if(r>200&&gg<60&&b>200) magenta++;
      if(b>150 && b>r+30 && gg>110 && gg<215 && r<175) water++;
    }
    return { water, magenta, tot:(cv.width*(cv.height-horizonPx)) };
  }
  // drive until bridgeAt(car + ahead) is true — the seed decides where the river is, so you cannot get there
  // by driving for a fixed number of seconds
  function driveTo(pred, cap){
    for(let n=0;n<(cap||300*120);n++){
      if(D.state!=='play') return false;
      if(pred(D.game.car.idx)) return true;
      D.autopilot(); D.step(1);
    }
    return false;
  }

  const clear=driveTo(i=>![-1,0,1].some(k=>bridgeAt(i+k*30,seed)) && !bridgeAt(i+60,seed) && !bridgeAt(i+90,seed), 60*120);
  const control=shot();                                        // open road, no river anywhere ahead
  const gotApproach=driveTo(i=>bridgeAt(i+18,seed));           // the span is just ahead of us
  const approach=shot();
  const gotSpan=driveTo(i=>{ const b=bridgeAt(i,seed); return b && Math.abs(b.t-1)<0.35; });  // now stood on it
  const onSpan=shot();

  rows.push("");
  rows.push("open road   water-blue "+(100*control.water/control.tot).toFixed(2)+"%   (the control: no river in sight)");
  rows.push("approaching water-blue "+(100*approach.water/approach.tot).toFixed(2)+"%");
  rows.push("on the span water-blue "+(100*onSpan.water/onSpan.tot).toFixed(2)+"%");
  rows.push("");

  rec("driving up to a river actually puts water on the screen",
      clear && gotApproach && approach.water > control.water*4 && approach.water > 1500,
      "the water rises from "+control.water+"px on open road to "+approach.water+"px on the approach — "+
      "a count on its own would just be measuring the sky, so this is the jump that matters");

  // The regression this was written for: the water quads were being DROPPED whole when a corner of one fell
  // behind the camera, so the river vanished from under you at exactly the moment you drove out over it.
  rec("the river is still there when you are standing over it",
      gotSpan && onSpan.water > control.water*4 && onSpan.water > 1500,
      gotSpan? ("mid-span, "+onSpan.water+"px of water is on screen (near-plane clipping holds; it used to "+
                "blink out here)") : "never reached mid-span");

  rec("no debug fill left in the water",
      control.magenta===0 && approach.magenta===0 && onSpan.magenta===0,
      "magenta pixels: "+control.magenta+" / "+approach.magenta+" / "+onSpan.magenta+" (the river was filled "+
      "with #ff00ff while it was being built)");

  /* ---------- the parapet is what keeps you out of the river ---------- */
  // The posts stop at the abutment and a solid parapet takes over. It has to hold: drive at the edge, hard.
  let maxLat=0, wentIn=false;
  if(gotSpan){
    for(let n=0;n<220;n++){
      D.setInput(1,1,0); D.step(1);                            // full lock, full throttle, straight at the edge
      const c=D.game.car, p=D.game.road.pts[c.idx];
      const lat=Math.abs((c.x-p.x)*(-p.ty)+(c.y-p.y)*p.tx);
      maxLat=Math.max(maxLat,lat);
      if(lat>BARRIER+CAR_W) wentIn=true;
    }
    D.clearInput();
  }
  rec("the parapet holds — you cannot drive off a bridge into the river", gotSpan && !wentIn,
      "steering full-lock at the edge for ~2s, the car got "+maxLat.toFixed(0)+"px off centre; the parapet is "+
      "at "+BARRIER+"px");

  /* ---------- and the deck drives like concrete, not like a field ---------- */
  // You can see deck out to the parapet, so being off the tarmac up there must NOT behave like a ploughed
  // field. If the picture and the physics disagree, one of them is lying to the player.
  let deckGrass=null, fieldGrass=null;
  if(gotSpan){
    const c=D.game.car, p=D.game.road.pts[c.idx];
    c.x=p.x-p.ty*(ROAD_HALF+40); c.y=p.y+p.tx*(ROAD_HALF+40);  // put it on the deck, off the tarmac
    D.step(1); deckGrass=D.game.onGrass;
    if(driveTo(i=>!bridgeAt(i,seed)&&!bridgeAt(i+40,seed), 40*120)){
      const c2=D.game.car, p2=D.game.road.pts[c2.idx];
      c2.x=p2.x-p2.ty*(ROAD_HALF+40); c2.y=p2.y+p2.tx*(ROAD_HALF+40);   // same place, but out in the country
      D.step(1); fieldGrass=D.game.onGrass;
    }
  }
  rec("off the tarmac is grass in a field, and concrete on a bridge",
      deckGrass===false && fieldGrass===true,
      "same offset from the centre line: onGrass="+deckGrass+" on the deck, "+fieldGrass+" out in the fields");

  rec("nothing threw while drawing any of it", errs.length===0, errs.length? errs.join(" ; ") : "no errors");

  rows.push("");
  rows.push(fail.length ? ("=== "+fail.length+" FAILING") : "the landscape is really there, and you can drive over it");
  const d=document.createElement("div");
  d.id="RESULTS"; d.textContent=rows.join(String.fromCharCode(10));
  document.body.appendChild(d);
})();
