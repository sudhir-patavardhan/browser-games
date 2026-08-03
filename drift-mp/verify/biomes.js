// The biomes: three new counties (rain, snow, desert) beside the farmland, and the borders between them.
// Held to the discipline everything else out here lives by: the sequence is a PURE function of the seed
// (same seed, same journey), a border is a ~1 km crossfade and never a cut, both camera lenses render
// every biome, and the tyres agree with the sky — the rain belt taxes grip like a wet day, snow country
// half as hard.
//
// The harness entry points (__drift.start / startDaily) pin the canonical temperate world, because every
// physics band, choreography and score in the other suites was measured on it. This probe unlocks the
// weather ON PURPOSE via __drift.bio.lock(false) — that unlock is itself the first thing under test.
(function(){
  const rows=[], fail=[];
  const rec=(n,pass,d)=>{ if(!pass) fail.push(n); rows.push((pass?"PASS":"FAIL")+" | "+n+" | "+d); };
  const errs=[]; window.onerror=(m,s,l,c)=>{ errs.push(String(m)+" @"+l+":"+c); };
  const D=window.__drift;

  // pin the dice, or every start below is a different road
  let a=20260802; Math.random=function(){ a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };

  const NAMES=['temperate','rain','snow','desert'];
  const PTS=D.bio.PTS, BLEND=D.bio.BLEND;

  /* ---------- 1. harness runs stay canonical until the weather is asked for ---------- */
  D.start();
  const seed=D.game.seed;
  rec("a harness start pins the canonical temperate world",
      D.bio.locked() && D.bio.mix(PTS*3+50,seed)[0]===1,
      "locked="+D.bio.locked()+" and three zones out the mix is still "+JSON.stringify(D.bio.mix(PTS*3+50,seed)));
  D.bio.lock(false);
  rec("...and bio.lock(false) turns the weather on", !D.bio.locked() && D.bio.mix(PTS*3+50,seed)[0]!==1,
      "unlocked, zone 3 is "+NAMES[D.bio.zone(3,seed)]);

  /* ---------- 2. the sequence: seeded, deterministic, varied, never stuttering ---------- */
  rec("a zone is ~5 km and a border is ~1 km",
      Math.abs(PTS*SEG*0.1-5000)<60 && Math.abs(BLEND*SEG*0.1-1000)<30,
      "BIO_PTS="+PTS+" pts ("+Math.round(PTS*SEG*0.1)+" m), BIO_BLEND="+BLEND+" pts ("+Math.round(BLEND*SEG*0.1)+" m)");
  const seqOf=s=>{ const q=[]; for(let z=0;z<14;z++) q.push(D.bio.zone(z,s)); return q; };
  rec("the same seed always drives the same journey",
      seqOf(4242).join('')===seqOf(4242).join('') && seqOf(seed).join('')===seqOf(seed).join(''),
      "seed 4242 -> "+seqOf(4242).join('')+" twice");
  let stutter=0; const starts=new Set(), covered=new Set();
  for(let s=1;s<=60;s++){ const q=seqOf(s); starts.add(q[0]);
    for(let z=0;z<q.length;z++){ covered.add(q[z]); if(z && q[z]===q[z-1]) stutter++; } }
  rec("no zone ever repeats its neighbour", stutter===0, stutter+" stutters across 60 seeds x 14 zones");
  rec("the starting biome is the seed's own pick", starts.size===4,
      "60 seeds open in "+starts.size+"/4 different biomes");
  rec("every biome takes its turn", covered.size===4, "seen across those seeds: "+[...covered].sort().map(b=>NAMES[b]).join(', '));

  /* ---------- 3. a border is a crossfade, not a cut ---------- */
  const z0=D.bio.zone(0,seed), z1=D.bio.zone(1,seed);
  const deep=D.bio.mix(PTS>>1,seed);
  rec("deep inside a zone the land is pure", deep[z0]===1,
      "mid-zone-0 ("+NAMES[z0]+") weights "+JSON.stringify(deep));
  let sumBad=0, mono=true, prev=-1;
  for(let u=0;u<=BLEND;u+=Math.max(1,BLEND>>5)){
    const w=D.bio.mix(PTS-BLEND+u,seed);
    if(Math.abs(w[0]+w[1]+w[2]+w[3]-1)>1e-9) sumBad++;
    if(w[z1]<prev-1e-9) mono=false; prev=w[z1];
  }
  rec("weights sum to one all the way through a border", sumBad===0, sumBad+" bad samples across the first border");
  rec("the incoming biome only ever gains ground", mono, NAMES[z1]+"'s share rises monotonically across the border");
  const before=D.bio.mix(PTS-BLEND-2,seed), mid=D.bio.mix(PTS-(BLEND>>1),seed), end=D.bio.mix(PTS-1,seed);
  rec("the crossfade starts where it should and lands where it must",
      before[z1]===0 && end[z1]>0.95,
      "2 pts before the window "+NAMES[z1]+"="+before[z1]+", at the border "+end[z1].toFixed(4));
  rec("mid-border, both counties hold real ground", mid[z0]>0.3 && mid[z1]>0.3,
      "at the window's centre "+NAMES[z0]+"="+mid[z0].toFixed(2)+" / "+NAMES[z1]+"="+mid[z1].toFixed(2));

  /* ---------- 4. the tyres agree with the sky ---------- */
  // wetness by county: the rain belt fully, snow country half, everything else dry. (The wetness->grip
  // multiplier itself is weather.js territory — g.wet drives the same 1-0.12*wet path this feeds.)
  const zoneIdxOf=b=>{ for(let z=0;z<80;z++) if(D.bio.zone(z,seed)===b) return z*PTS+(PTS>>1); return -1; };
  const sites=[0,1,2,3].map(b=>({b, idx:zoneIdxOf(b)})).sort((p,q)=>p.idx-q.idx);
  function goTo(idx){ const g=D.game, R=g.road, c=g.car;
    ensureAhead(R,idx);                                   // grow the road out to the site
    const p=R.pts[idx];
    c.x=p.x; c.y=p.y; c.idx=idx; c.vx=p.tx*430; c.vy=p.ty*430; c.angle=Math.atan2(p.ty,p.tx);
    g.cam.x=p.x; g.cam.y=p.y;                             // the top camera only walks during rendered frames
    D.step(1);
  }
  const wetWant={0:0, 1:1, 2:0.5, 3:0};
  for(const s of sites){
    if(s.idx<0){ rec("a "+NAMES[s.b]+" zone exists within 80 zones", false, "never drawn for seed "+seed); continue; }
    goTo(s.idx);
    const got=D.game.bio.wet;
    rec("in "+NAMES[s.b]+" country the tyres feel wet="+wetWant[s.b], Math.abs(got-wetWant[s.b])<0.01,
        "at idx "+s.idx+" bio.wet="+got.toFixed(3));
    D.hud();
    const we=document.getElementById('wetEl'), vis=we.style.display!=='none';
    if(s.b===1) rec("...and the HUD flies the wet flag in the rain belt", vis && we.textContent.indexOf('WET ROAD')>=0, "'"+we.textContent+"'");
    if(s.b===2) rec("...and names the snow when it's snow", vis && we.textContent.indexOf('SNOW')>=0, "'"+we.textContent+"'");
    if(s.b===0) rec("...and stays quiet on a dry temperate road", !vis, "display="+we.style.display);
  }

  /* ---------- 5. both lenses show every biome — and the world really changes colour ---------- */
  // classify the frame instead of trusting one pixel: how much of it is cold-bright (snow) or warm (sand)
  function shares(){ render();
    const px=ctx.getImageData(0,0,cv.width,cv.height).data;
    let cold=0, warm=0, tot=px.length/4;
    for(let i=0;i<px.length;i+=4){ const r=px[i], g2=px[i+1], b=px[i+2];
      if(r>195&&g2>200&&b>=r) cold++;
      else if(r>150&&r-b>25) warm++; }
    return { cold:cold/tot, warm:warm/tot };
  }
  const look={};
  for(const s of sites){ if(s.idx<0) continue;
    goTo(s.idx);
    D.game.view='driver'; render();
    D.game.view='top'; look[s.b]=shares();
    D.game.view='driver';
  }
  if(look[2]) rec("snow country reads white from above", look[2].cold>0.25,
      (100*look[2].cold).toFixed(1)+"% of the top frame is cold-bright (want >25%)");
  if(look[3]) rec("the desert reads sand from above", look[3].warm>0.25,
      (100*look[3].warm).toFixed(1)+"% of the top frame is warm (want >25%)");
  if(look[0]) rec("the farmland reads as neither", look[0].cold<0.1 && look[0].warm<0.1,
      "temperate top frame: "+(100*look[0].cold).toFixed(1)+"% cold, "+(100*look[0].warm).toFixed(1)+"% warm");

  rec("nothing threw along the way", errs.length===0, errs.length? errs.join(" ; ") : "clean across "+sites.length+" sites x 2 views");

  rows.push("");
  rows.push(fail.length? "the weather is lying somewhere" : "the weather is honest");
  const div=document.createElement('div'); div.id='RESULTS';
  div.textContent=rows.join("\n"); document.body.appendChild(div);
})();
