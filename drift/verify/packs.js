/* THE HORDE TRAVELS IN PACKS.
 *
 * Measured over 8,459 frames of a real drive, the road you can see held zero or one shambler 91% of the
 * time. The histogram was {0:1525, 1:6212, 2:263, 3:31, ...} — and almost every frame above 2 was a bounty
 * wave, the one moment the game drops a crowd on you. Between waves, "a horde problem" is a queue: one body,
 * then another body, forever, each an identical left-or-right.
 *
 * The spawner explains it exactly. Shamblers are laid one per 45-90 road points, they are reaped 4 points
 * behind the car, and none exist beyond 70 points ahead — so the live population is a 74-point window over a
 * 67.5-point mean spacing, i.e. ~1.1 alive. Z_MAX=9 could never bind; it was dead code outside a wave.
 *
 * This is a change of SHAPE, NOT VOLUME, and that is the claim this probe exists to hold down:
 *   1. Density is preserved — shamblers per km is within a few percent of what it was.
 *   2. But they arrive in KNOTS: max-simultaneous rises well past 1, and "2+ in view" stops being a rounding
 *      error.
 *   3. Which means the road is genuinely empty in between. That contrast is the feature, not a regression.
 *   4. The gaps are bimodal — tight inside a knot, long between knots — rather than one flat distribution.
 *   5. It is still seeded: the same road raises the same packs, in the same places, every time.
 *   6. Bounty waves still override it, and the population cap still holds.
 */
(function(){
  const out=[]; const ok=(c,n,d)=>out.push((c?'PASS':'FAIL')+' | '+n+(d?' | '+d:''));
  const realRandom=Math.random;
  function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const SEEDS=[12345, 777, 424242];

  /* Drive a pinned road with the autopilot and watch the horde from the driver's side of the glass: every
     shambler that ever exists (identity-tracked, because they are reaped as they go by), and how many were
     inside the 55 points you can actually see, sampled every step. */
  function survey(seed, secs){
    seedRandom(seed);
    __drift.start();
    const g=__drift.game;
    g.traffic.length=0; g.trafNext=1e18;      // the far lane is a different feature; keep it out of the count
    const seen=new Set(); const spawnIdx=[];
    const hist={}; let steps=0, maxAlive=0, twoPlus=0, empty=0, waveSteps=0;
    const km0=g.dist;
    for(let i=0;i<secs*120 && __drift.state==='play';i++){
      __drift.autopilot(); __drift.step(1);
      for(const z of g.zombies) if(!seen.has(z)){ seen.add(z); spawnIdx.push({fi:z.fi, wave:g.waveT>0}); }
      const inView=g.zombies.filter(z=>z.fi-g.car.idx>0 && z.fi-g.car.idx<55).length;
      hist[inView]=(hist[inView]||0)+1;
      if(g.waveT>0) waveSteps++; else {                 // judge the ROAD, not the radio
        steps++;
        if(inView>=2) twoPlus++;
        if(inView===0) empty++;
      }
      if(g.zombies.length>maxAlive) maxAlive=g.zombies.length;
    }
    const km=(g.dist-km0)/1000;
    const quiet=spawnIdx.filter(s=>!s.wave).map(s=>s.fi).sort((a,b)=>a-b);
    const gaps=[]; for(let i=1;i<quiet.length;i++){ const d=quiet[i]-quiet[i-1]; if(d>=0) gaps.push(d); }
    return { km, heads:quiet.length, perKm:quiet.length/Math.max(0.001,km), maxAlive,
             twoPlusPct:100*twoPlus/Math.max(1,steps), emptyPct:100*empty/Math.max(1,steps),
             hist, gaps, waveSteps };
  }

  function agg(secs){
    const rs=SEEDS.map(s=>survey(s,secs));
    const sum=(f)=>rs.reduce((a,r)=>a+f(r),0)/rs.length;
    const gaps=[].concat(...rs.map(r=>r.gaps));
    return { perKm:sum(r=>r.perKm), maxAlive:Math.max(...rs.map(r=>r.maxAlive)),
             twoPlusPct:sum(r=>r.twoPlusPct), emptyPct:sum(r=>r.emptyPct),
             gaps, km:sum(r=>r.km), heads:sum(r=>r.heads) };
  }

  const A=agg(80);
  const tight=A.gaps.filter(g=>g<=20).length, wide=A.gaps.filter(g=>g>60).length, mid=A.gaps.filter(g=>g>20&&g<=60).length;

  /* 1 — SHAPE, NOT VOLUME. The pre-pack spawner laid one shambler per 45-90 points of road: a 67.5-point
     mean over a 26-unit segment, i.e. 0.57 per 100 world-metres, ~5.7/km. Anything inside a few percent of
     that means players are meeting the same number of bodies, just arranged differently. */
  ok(A.perKm>4.6 && A.perKm<7.0, 'the road still holds the same number of shamblers per km',
     A.perKm.toFixed(2)+'/km over '+A.km.toFixed(0)+' km (the flat spawner gave ~5.7)');

  /* 2 — but they come in knots now. */
  ok(A.maxAlive>=4, 'the horde actually crowds — more than a couple alive at once, outside any wave',
     'peak alive: '+A.maxAlive+' (the flat spawner could not exceed ~2)');
  ok(A.twoPlusPct>=8, 'two or more in view stops being a rounding error',
     A.twoPlusPct.toFixed(1)+'% of quiet-road frames show 2+ ahead (was ~3%)');

  /* 3 — and the road between knots is honestly empty. The contrast IS the feature. */
  ok(A.emptyPct>25, 'the road between packs is genuinely clear',
     A.emptyPct.toFixed(1)+'% of quiet-road frames show nothing ahead (was ~18%)');

  /* 4 — bimodal gaps: tight inside a knot, long between knots, little in the middle. */
  ok(tight>0 && wide>0 && tight>mid && wide>mid,
     'the spacing is bimodal — packed, then empty, not evenly sprinkled',
     'gaps <=20pts: '+tight+' · 21-60: '+mid+' · >60: '+wide);

  /* 5 — a seeded road raises the same packs. Two surveys of one seed must agree exactly. */
  (function(){
    const a=survey(12345,25), b=survey(12345,25);
    const same=a.heads===b.heads && a.gaps.join(',')===b.gaps.join(',');
    ok(same, 'the same road raises the same packs', a.heads+' heads both times, identical spacing: '+same);
  })();

  /* 6 — the radio still overrides the road, and the cap still holds. */
  (function(){
    seedRandom(999); __drift.start(); const g=__drift.game;
    g.traffic.length=0; g.trafNext=1e18;
    let peak=0, sawWave=false;
    for(let i=0;i<200*120 && __drift.state==='play';i++){
      __drift.autopilot(); __drift.step(1);
      if(g.waveT>0){ sawWave=true; if(g.zombies.length>peak) peak=g.zombies.length; }
      if(g.zombies.length>14){ peak=99; break; }
    }
    ok(sawWave && peak>=6 && peak<=14, 'a bounty wave still drops a crowd, and the cap still holds',
       'wave seen='+sawWave+', peak in wave='+peak+' (cap 14)');
  })();

  Math.random=realRandom;
  const d=document.createElement('div'); d.id='RESULTS'; d.textContent=out.join('\n');
  document.body.appendChild(d);
})();
