// The cabin, and the road it is not allowed to eat.
//
// The car's interior is sized off cabK(), which grows with min(W/2, H) so a desktop pane doesn't get a toy
// wheel adrift in a metre of glass. That growth had no floor under it: a WIDE, SHORT window makes min(W/2,H)
// large while leaving little height to spend, so the wheel and the cluster stacked up until the dash lip
// reached the horizon and the road disappeared completely — at 2000x1005 the band between the two came to
// ONE pixel, and on anything shorter the dash covered the horizon outright.
//
// A single-resolution check can't see that (headless lays out ~500px wide, which was never the broken case),
// so this probe drives the layout itself: it sets the viewport, asks the real wheelGeom()/clusterH() where
// the cabin lands, and then RENDERS AT THAT SIZE and reads the tarmac back out of the pixels.
(function(){
  const rows=[], fail=[];
  const rec=(n,pass,d)=>{ if(!pass) fail.push(n); rows.push((pass?"PASS":"FAIL")+" | "+n+" | "+d); };
  const errs=[]; window.onerror=(m,s,l,c)=>{ errs.push(String(m)+" @"+l+":"+c); };
  const D=window.__drift;

  // pin the seed, or every frame below is shot on a different road
  let a=20260731; Math.random=function(){ a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };

  // take the viewport over from the window: same work resize() does, minus the window it reads from
  function layout(w,h){ W=w; H=h; DPR=1;
    cv.width=W; cv.height=H; cv.style.width=W+'px'; cv.style.height=H+'px'; ctx.setTransform(1,0,0,1,0,0); }
  function cabin(){ const {cy,rad}=wheelGeom(); const ch=clusterH(rad);
    return { rad, ch, dashTop:(cy-rad)-ch-16, horizon:H*HORIZON_F }; }
  function at(w,h){ layout(w,h); const c=cabin(); c.band=(c.dashTop-c.horizon)/h; return c; }

  /* ---------- 1. every shape of window keeps a road band ---------- */
  // phones, tablets, laptops, an ultrawide, and the two panes that were actually broken
  const SIZES=[[360,640],[390,780],[414,896],[768,1024],[1024,768],[1280,720],[1366,768],
               [1440,900],[1512,982],[1800,905],[1920,1080],[2000,1005],[2560,1080],[1440,1440]];
  let worst=null;
  for(const [w,h] of SIZES){ const c=at(w,h); if(!worst || c.band<worst.band) worst={...c,w,h}; }
  rec("no window shape lets the cabin close on the horizon",
      worst.band>=0.19,
      "tightest of "+SIZES.length+" sizes is "+worst.w+"x"+worst.h+" at "+(worst.band*100).toFixed(1)+
      "% of the screen left as road (want >=19%); before the floor, 2000x1005 gave 0.1% and 1800x905 gave -2.8%");

  // the sizes the bug was reported on, called out one by one so a regression names itself
  for(const [w,h] of [[2000,1005],[1800,905],[1280,720]]){
    const c=at(w,h);
    rec("a "+w+"x"+h+" window shows road between the horizon and the dash",
        c.dashTop-c.horizon>60,
        "horizon y="+Math.round(c.horizon)+", dash top y="+Math.round(c.dashTop)+
        " — "+Math.round(c.dashTop-c.horizon)+"px of road (want >60)");
  }

  /* ---------- 2. the floor bites only where it must ---------- */
  const phone=at(390,780), tall=at(1440,1440), wide=at(1920,1080);
  rec("a phone is left exactly as it was", Math.round(phone.rad)===78 && Math.round(phone.dashTop)===517,
      "390x780: wheel r="+phone.rad.toFixed(1)+" dash top="+Math.round(phone.dashTop)+
      " (the pre-fix numbers were 78 and 517) — the height fraction never binds here");
  rec("...and so is a tall desktop pane", Math.round(tall.rad)===138,
      "1440x1440: wheel r="+tall.rad.toFixed(1)+", the full cabK() size, because there is height to spend");
  rec("a big pane still gets a bigger cabin than a phone", wide.rad>phone.rad*1.4,
      "1920x1080 wheel r="+wide.rad.toFixed(1)+" vs a phone's "+phone.rad.toFixed(1)+
      " — the floor caps the growth, it does not undo it");

  /* ---------- 3. the pixels: render wide, and look for tarmac ---------- */
  // Geometry says there is room. This drives the real renderer at the broken size and counts road-grey
  // pixels in the band, because "the dash top is at 0.63H" is only a proxy for "you can see the road".
  D.start(); D.game.view='driver';
  for(let i=0;i<40*120 && D.state==='play';i++){ D.autopilot(); D.step(1); }

  // tarmac is a near-neutral grey with a touch of blue in it (#c1c6ce -> #a1a7b3); grass is green (g>r) and
  // sky is emphatically blue, so neither can be mistaken for it
  function tarmacIn(y0,y1){
    render();
    const top=Math.max(0,Math.round(y0)), h=Math.max(1,Math.round(y1)-top);
    const px=ctx.getImageData(0,top,cv.width,Math.min(h,cv.height-top)).data;
    let n=0;
    for(let i=0;i<px.length;i+=4){ const r=px[i], g=px[i+1], b=px[i+2];
      if(r>125&&r<220 && Math.abs(r-g)<12 && b>=g-2 && b-r<30) n++; }
    return { n, tot:cv.width*Math.min(h,cv.height-top) };
  }

  const cw=at(1800,905);
  const band=tarmacIn(cw.horizon,cw.dashTop);
  const above=tarmacIn(0,cw.horizon-8);                   // the sky, as a control: no tarmac may be found here
  rows.push("");
  rows.push("1800x905  road band y="+Math.round(cw.horizon)+".."+Math.round(cw.dashTop)+
            "  tarmac "+(100*band.n/band.tot).toFixed(1)+"% of it   (sky above: "+
            (100*above.n/above.tot).toFixed(1)+"%)");
  rows.push("");
  rec("a wide window really does render road, not just room for it",
      band.n>band.tot*0.06 && band.n>above.n*8,
      "the band is "+(100*band.n/band.tot).toFixed(1)+"% tarmac (want >6%, and many times the sky's "+
      (100*above.n/above.tot).toFixed(1)+"%) — with the cabin unfloored this band did not exist at all");

  const ct=at(1440,1440);                                 // a shape the floor never touches, as an A/B
  const tallBand=tarmacIn(ct.horizon,ct.dashTop);
  rec("...and a pane the floor never touches renders the same road",
      tallBand.n>tallBand.tot*0.06,
      "1440x1440: "+(100*tallBand.n/tallBand.tot).toFixed(1)+"% of its band is tarmac");

  /* ---------- 4. drawing at any of these sizes is safe ---------- */
  for(const [w,h] of SIZES){ layout(w,h); render(); D.game.view='top'; render(); D.game.view='driver'; }
  resize();                                               // hand the window back to the window
  render();
  rec("every size renders, in both cameras, without throwing", errs.length===0,
      errs.length? errs.join(" ; ") : "no errors across "+SIZES.length+" viewports x 2 views");

  rows.push("");
  rows.push(fail.length? "the cabin is eating the road again" : "the cabin knows where to stop");
  const div=document.createElement('div'); div.id='RESULTS';
  div.textContent=rows.join("\n"); document.body.appendChild(div);
})();
