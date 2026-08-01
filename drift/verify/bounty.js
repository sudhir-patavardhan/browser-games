/* THE BOUNTY RIDES THE MULTIPLIER.
 *
 * The wallet is the only progression Drift keeps: guns, and garage hardware that bolts on for good. Until
 * now it paid a flat rate per head, which meant the permanent half of the game was payable by the one
 * activity the game itself says scores nothing — five minutes of tidy autopilot banks four figures and a
 * score of 25. This probe pins the fix and, just as importantly, pins what the fix must NOT do.
 *
 * The claims, in order of how much they matter:
 *   1. x1.0 pays exactly what it paid before. This is a ceiling raise, not a nerf — nobody's rate drops.
 *   2. Pay is linear in the multiplier: the same head at x4 is worth 4x the same head at x1.
 *   3. Rank and the wave still compose the way they did, on top.
 *   4. Driven for real, the separation is REAL: the same road, same seed, same distance, driven tidily and
 *      driven sideways, and the sideways run must earn materially more per head.
 *   5. The multiplier a bounty pays at is the one the HUD was showing, not some private number.
 */
(function(){
  const out=[]; const ok=(c,n,d)=>out.push((c?'PASS':'FAIL')+' | '+n+(d?' | '+d:''));
  const near=(a,b,tol)=>Math.abs(a-b)<=(tol||0.001)*Math.max(1,Math.abs(b));

  // a head killed under controlled conditions: pin the multiplier, pin the speed, count the money
  function payFor(opts){
    __drift.start();
    const g=__drift.game;
    g.traffic.length=0; g.trafNext=1e18;         // an empty road: nothing to perturb the money
    g.zombies.length=0; g.zNextIdx=1e9;          // and no spawner topping it up behind us
    g.waveT=opts.wave?18:0; g.waveKills=0;
    const before=__drift.horde.cash();
    g.mult=opts.mult;
    // put the speed where we want it without driving there (pay reads g.speed for a car strike)
    g.speed=opts.speed||400;
    __drift.horde.spawn(g.car.idx+40, 0);
    const z=g.zombies[g.zombies.length-1];
    z.kind=opts.kind||'walker'; z.hp=opts.kind==='brute'?2:1;
    __drift.horde.kill(g, z, opts.by||'car');
    return __drift.horde.cash()-before;
  }

  __drift.horde.wipe();

  /* 1 — x1.0 is the old rate, to the cent. base = (20 + speed*0.02) * rank for a car strike. */
  const base=payFor({mult:1, speed:400, kind:'walker'});
  ok(base===28, 'x1.0 pays the old flat rate exactly', 'walker at 400: $'+base+' (was 20+round(400*.02)=28)');
  const gunBase=payFor({mult:1, speed:400, kind:'walker', by:'gun'});
  ok(gunBase===40, 'the marksman rate is untouched at x1.0', 'gun walker: $'+gunBase+' (was 40)');

  /* 2 — linear in the multiplier, which is the whole point: the money is the driving. */
  const rows=[1,2,4,8].map(m=>({m, pay:payFor({mult:m, speed:400, kind:'walker'})}));
  const linear=rows.every(r=>near(r.pay, base*r.m, 0.02));
  ok(linear, 'the bounty is linear in the multiplier',
     rows.map(r=>'x'+r.m+'=$'+r.pay).join(' · ')+' (base $'+base+')');
  ok(rows[3].pay>=base*7.5, 'the ceiling is real — a held chain is worth many times a cruise',
     'x8 pays $'+rows[3].pay+' vs $'+base+' idle, a '+(rows[3].pay/base).toFixed(1)+'x spread');

  /* 3 — rank and the wave still compose on top, unchanged in kind. */
  const runner=payFor({mult:2, speed:400, kind:'runner'});
  const brute =payFor({mult:2, speed:400, kind:'brute'});
  ok(near(runner, base*2*2, 0.02) && near(brute, base*2*3, 0.02),
     'rank still multiplies on top of it', 'runner $'+runner+' (want '+(base*4)+'), brute $'+brute+' (want '+(base*6)+')');
  const waved=payFor({mult:2, speed:400, kind:'walker', wave:true});
  ok(near(waved, base*2*2, 0.02), 'a bounty wave still doubles the whole thing',
     'x2 in a wave: $'+waved+' (want '+(base*4)+')');

  /* 5 — the number that paid you is the number you were shown. */
  (function(){
    __drift.start(); const g=__drift.game;
    g.zombies.length=0; g.zNextIdx=1e9; g.traffic.length=0; g.trafNext=1e18;
    g.mult=3.7; __drift.hud();
    const shown=document.getElementById('multEl').textContent;
    const before=__drift.horde.cash();
    g.speed=400; __drift.horde.spawn(g.car.idx+40,0);
    __drift.horde.kill(g, g.zombies[g.zombies.length-1], 'car');
    const paid=(__drift.horde.cash()-before)/base;
    ok(shown==='x3.7' && near(paid,3.7,0.02), 'you are paid at the multiplier the HUD is showing',
       'HUD said '+shown+', the head paid '+paid.toFixed(2)+'x rate');
  })();

  /* 4 — the claim that matters, driven rather than asserted. Same road, same seed, same distance: one run
     held tidy (the autopilot every physics measurement is written in), one run pushed until it slides.
     Tidy must still earn — a beginner still saves toward a gun — but sideways must earn MORE PER HEAD. */
  // newGame() draws its road seed from Math.random(), so an A/B on two different roads would mean nothing.
  // Pin it the way the rest of the harness does: same seed => same road, same horde, both stints.
  const realRandom=Math.random;
  function seedRandom(s){ let a=s|0; Math.random=function(){ a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

  /* The driver model is assert.js's `follower`, verbatim in spirit: pure-pursuit for the line, and a corner
     speed taken from the grip budget times `aggr`. Driving BADLY is not the same as driving sideways — a
     first cut of this probe just mangled the steering, which produced a slower, spun-out car that earned
     LESS per head and told us nothing. What makes a car drift is carrying more speed than the corner wants
     (aggr>1) and stabbing the brake on entry to rotate it, which is exactly what `stab` does. */
  function follower(aggr, stab){
    return function(g){
      const R=g.road, c=g.car, p=R.pts[c.idx];
      const lead=Math.round(clamp(5+g.speed/70,6,15));
      const look=R.pts[Math.min(R.pts.length-1,c.idx+lead)];
      const desired=Math.atan2(look.y-c.y, look.x-c.x);
      const nx=-p.ty, ny=p.tx, off=(c.x-p.x)*nx+(c.y-p.y)*ny;
      let err=desired-c.angle; while(err>Math.PI)err-=6.283185307; while(err<-Math.PI)err+=6.283185307;
      err+=clamp(-off/280,-0.35,0.35);
      const over=Math.max(0,Math.abs(g.slip)-0.22)*Math.sign(g.slip);
      g.forceSteer=clamp(err*2.6-over*1.8,-1,1);
      let k=0.00012;
      for(let i=c.idx+2;i<Math.min(R.pts.length-1,c.idx+30);i++){
        const a=R.pts[i], b=R.pts[i+1];
        let d=Math.atan2(b.ty,b.tx)-Math.atan2(a.ty,a.tx);
        while(d>Math.PI)d-=6.283185307; while(d<-Math.PI)d+=6.283185307;
        const kk=Math.abs(d)/26; if(kk>k) k=kk;
      }
      const vT=clamp(Math.sqrt(290*0.8/k)*aggr,260,790);
      const tight=k>0.0016;
      g.forceGas = g.speed<vT-15 ? 1 : 0;
      g.forceBrake = g.speed>vT+15 ? 1 : 0;
      if(stab && tight && g.speed>380 && Math.abs(err)>0.06){ g.forceBrake=1; g.forceGas=0; }
    };
  }

  function drive(seed, aggr, stab){
    seedRandom(seed);
    __drift.start(); const g=__drift.game;
    const drv=follower(aggr, stab);
    const c0=__drift.horde.cash();
    let multAtKill=0, heads=0;
    const kills=()=>g.zCarKills+g.gunKills;
    let prev=kills();
    for(let i=0;i<160*120 && __drift.state==='play';i++){
      drv(g); __drift.step(1);
      const k=kills();
      if(k>prev){ multAtKill+=g.mult*(k-prev); heads+=k-prev; prev=k; }
      if(g.zombies.length<5) __drift.horde.spawn(g.car.idx+50+((g.zrng()*40)|0));
    }
    return { cash:__drift.horde.cash()-c0, heads, drift:g.driftTotal,
             multAtKill:heads?multAtKill/heads:0, km:g.dist/1000, alive:__drift.state==='play' };
  }
  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }

  const SEEDS=[12345, 777, 424242];
  let tidyPer=0, sendPer=0, n=0, detail='';
  for(const seed of SEEDS){
    __drift.horde.wipe();
    const tidy=drive(seed,1.00,false);
    __drift.horde.wipe();
    const send=drive(seed,1.15,true);
    if(!tidy.heads||!send.heads) continue;
    const tp=tidy.cash/tidy.heads, sp=send.cash/send.heads;
    tidyPer+=tp; sendPer+=sp; n++;
    detail+=seed+': tidy $'+Math.round(tp)+'/head @x'+tidy.multAtKill.toFixed(1)
      +' vs sent $'+Math.round(sp)+'/head @x'+send.multAtKill.toFixed(1)
      +' (drift '+tidy.drift.toFixed(0)+'s → '+send.drift.toFixed(0)+'s) · ';
  }
  tidyPer/=Math.max(1,n); sendPer/=Math.max(1,n);
  ok(sendPer>tidyPer*1.35, 'driven for real, sideways pays materially more per head than tidy',
     'averaged over '+n+' roads: $'+Math.round(tidyPer)+' → $'+Math.round(sendPer)+'/head, a '
     +(sendPer/Math.max(1,tidyPer)).toFixed(2)+'x separation · '+detail.trim());
  ok(tidyPer>0, 'tidy driving still earns — the beginner is still saving toward a gun',
     'tidy averages $'+Math.round(tidyPer)+'/head');
  Math.random=realRandom;

  const d=document.createElement('div'); d.id='RESULTS'; d.textContent=out.join('\n');
  document.body.appendChild(d);
})();
